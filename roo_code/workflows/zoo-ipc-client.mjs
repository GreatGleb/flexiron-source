#!/usr/bin/env node
// Клиент Zoo Code для автономного прогона: ставит задачу и ждёт её конца без человека.
//
// Протокол снят с dist/extension.js расширения zoocodeorganization.zoo-code-3.82.2
// и проверен вживую 2026-09-22:
//   сервер поднимается при ROO_CODE_IPC_SOCKET_PATH и на подключение шлёт
//     {type:"Ack",origin:"server",data:{clientId,...}};
//   клиент шлёт {type:"TaskCommand",origin:"client",clientId,data:{commandName,data}};
//   сервер стримит {type:"TaskEvent",origin:"server",data:{eventName,payload}}.
// node-ipc кладёт конверт в {type:"message",data:<конверт>} и разделяет записи "\f".
//
// Два замера, которые нельзя вывести из имён событий (2026-09-22):
//   1. taskCompleted НЕ приходит даже когда агент закрыл задачу через attempt_completion.
//      Конец работы — taskIdle, а ответ лежит в реплике message с say="completion_result".
//   2. Сокет отдаёт события ВСЕХ задач редактора, включая прошлые: новая задача начинается
//      с taskUnfocused/taskAborted предыдущей. Клиент, не смотрящий на taskId, принимает
//      чужой обрыв за свой и уходит с пустыми руками. Поэтому события фильтруются по
//      собственному taskId, который даёт taskCreated: payload — это [taskId].
import net from "node:net";
import { writeFileSync } from "node:fs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

const socketPath = arg("socket", process.env.ROO_CODE_IPC_SOCKET_PATH);
const resultPath = arg("result");
const eventsPath = arg("events");
const timeoutMs = Number(arg("timeout", "3600")) * 1000;
const configuration = JSON.parse(arg("config", "{}"));
// Промпт даётся аргументом (проба) или приходит со stdin (прогон).
const inlineText = arg("text");

if (!socketPath) {
  console.error("Нет пути сокета: --socket <путь> или ROO_CODE_IPC_SOCKET_PATH");
  process.exit(2);
}

const DELIMITER = "\f";
const events = [];
const say = [];
let usage = null;
let clientId = null;
let buffer = "";
let settled = false;
let idleTimer = null;
let started = false;
let ownTaskId = null;

/** Достать объект результата из текста модели: она любит обрамить его разметкой. */
const extractJsonObject = (text) => {
  const stripped = text.replace(/^\s*```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
  const start = stripped.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < stripped.length; i += 1) {
    const char = stripped[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && (depth -= 1) === 0) return stripped.slice(start, i + 1);
  }
  return null;
};

/** Годен ли ответ: ядро требует ровно {status, summary, evidence} и ничего сверх. */
const matchesSchema = (text) => {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const keys = Object.keys(parsed).sort().join(",");
  return keys === "evidence,status,summary"
    && ["done", "blocked"].includes(parsed.status)
    && typeof parsed.summary === "string"
    && Array.isArray(parsed.evidence)
    && parsed.evidence.every((item) => typeof item === "string");
};

const readStdin = () =>
  new Promise((resolve) => {
    if (inlineText !== undefined) return resolve(inlineText);
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (text += chunk));
    process.stdin.on("end", () => resolve(text));
  });

const socket = net.createConnection(socketPath);
socket.setEncoding("utf8");

/** Брак ОДНОЙ задачи вместо отказа среды: ядро останавливает ночь по коду выхода,
 *  а незаконченная или нечитаемая работа — это не «CLI лёг», это одна плохая задача.
 *  Замер 2026-09-26: ночь night-2026-09-26-0206 умерла в 03:33 на второй задаче,
 *  потому что клиент вышел с кодом 1 по своему таймауту в 3600 с. */
const blockedResult = (summary, evidence) =>
  JSON.stringify({ status: "blocked", summary, evidence });

const finish = (code, note, fallback = null) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  clearTimeout(idleTimer);
  clearTimeout(graceTimer);
  const report = { note, clientId, usage, say, events };
  if (eventsPath) writeFileSync(eventsPath, JSON.stringify(report, null, 2));
  else console.log(JSON.stringify(report, null, 2));

  // Результат берут из последней реплики completion_result: только она означает,
  // что агент сам считает работу законченной.
  let written = false;
  if (resultPath) {
    // Взять ПЕРВЫЙ с конца ответ, который годится по схеме, а не просто последний с
    // фигурной скобкой. Замер 2026-09-26: модель ответила прозой, в которой стояло
    // `find ... -exec wc -l {} +`, и экстрактор честно вернул из неё литерал `{}` —
    // ядро потом ругалось «нет подтверждения выполнения: {}» вместо настоящей причины.
    const object = [...say].reverse()
      .filter((item) => item.sayType === "completion_result")
      .map((item) => extractJsonObject(item.text))
      .find((candidate) => candidate && matchesSchema(candidate)) ?? null;
    if (object) {
      writeFileSync(resultPath, object);
      written = true;
    } else if (fallback) {
      writeFileSync(resultPath, fallback);
      written = true;
      console.error(`Результат не получен, задача забракована: ${note}`);
    } else {
      console.error("В ответе нет JSON-объекта результата");
    }
  }
  socket.end();
  process.exit(resultPath && !written ? 1 : code);
};

// Отмену надо дождаться: агент, которому не сказали «стоп», продолжит писать в
// дерево уже после того, как ядро отбросит его правки, и отравит следующую задачу.
const CANCEL_GRACE_MS = 15000;
let timedOut = false;
let graceTimer = null;

const timeoutFallback = () => blockedResult(
  `Исполнитель не закончил задачу за ${Math.round(timeoutMs / 1000)} с и остановлен по таймауту.`,
  [`Клиент Zoo Code ждал конца задачи ${Math.round(timeoutMs / 1000)} с: ни taskCompleted, ни taskIdle не пришли.`,
   "Задача отменена командой CancelTask; сделанные правки ядро отбрасывает вместе с задачей.",
   "Результата исполнителя нет — судить о работе не по чему."]);

const timer = setTimeout(() => {
  timedOut = true;
  if (clientId) send({ type: "TaskCommand", origin: "client", clientId, data: { commandName: "CancelTask" } });
  // taskAborted обычно приходит раньше; это страховка на случай, если не придёт.
  graceTimer = setTimeout(() => finish(0, "таймаут ожидания конца задачи", timeoutFallback()), CANCEL_GRACE_MS);
}, timeoutMs);

const send = (envelope) => socket.write(JSON.stringify({ type: "message", data: envelope }) + DELIMITER);

socket.on("connect", () => console.error(`подключено: ${socketPath}`));
socket.on("error", (err) => finish(2, `сокет недоступен: ${err.message}`));

socket.on("data", async (chunk) => {
  buffer += chunk;
  const parts = buffer.split(DELIMITER);
  buffer = parts.pop();
  for (const part of parts) {
    if (!part.trim()) continue;
    let message;
    try {
      message = JSON.parse(part);
    } catch {
      console.error(`не JSON: ${part.slice(0, 200)}`);
      continue;
    }
    const envelope = message?.data ?? message;
    if (envelope?.type === "Ack") {
      clientId = envelope.data.clientId;
      console.error(`Ack: clientId=${clientId}, pid=${envelope.data.pid}`);
      const text = await readStdin();
      if (!text.trim()) finish(2, "пустое задание");
      send({
        type: "TaskCommand",
        origin: "client",
        clientId,
        data: { commandName: "StartNewTask", data: { configuration, text } },
      });
      continue;
    }
    if (envelope?.type !== "TaskEvent") continue;
    const { eventName, payload } = envelope.data;
    const eventTaskId = typeof payload?.[0] === "string" ? payload[0] : payload?.[0]?.taskId ?? null;
    if (eventName === "taskCreated" && ownTaskId === null && eventTaskId) ownTaskId = eventTaskId;
    const mine = ownTaskId !== null && (eventTaskId === null || eventTaskId === ownTaskId);
    events.push({ eventName, at: new Date().toISOString(), mine, taskId: eventTaskId });
    if (!mine) continue;
    if (eventName === "taskStarted") started = true;

    if (eventName === "message") {
      const item = payload?.[0]?.message ?? payload?.message;
      // Частичные куски потока отбрасываем: иначе результат соберётся из обрывков.
      if (item && item.partial === false && typeof item.text === "string") {
        say.push({ type: item.type, ask: item.ask, sayType: item.say, text: item.text });
      }
    }
    if (eventName === "taskTokenUsageUpdated") usage = payload?.[1] ?? payload;

    const unreadable = () => blockedResult(
      "Исполнитель закончил, но не вернул объект результата по схеме.",
      ["Последняя реплика completion_result не содержит разбираемого JSON-объекта — вероятно, проза вместо результата.",
       "Работа не принимается: судить о ней не по чему."]);

    if (eventName === "taskCompleted") {
      send({ type: "TaskCommand", origin: "client", clientId, data: { commandName: "CloseTask" } });
      finish(0, "задача завершена (taskCompleted)", unreadable());
    }
    if (eventName === "taskIdle" && started) {
      // Пауза на случай, если taskCompleted всё-таки придёт следом.
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        send({ type: "TaskCommand", origin: "client", clientId, data: { commandName: "CancelTask" } });
        finish(0, "задача остановилась (taskIdle)", unreadable());
      }, 3000);
    }
    if (eventName === "taskAborted")
      timedOut ? finish(0, "таймаут ожидания конца задачи", timeoutFallback())
               : finish(1, "задача прервана");
  }
});
