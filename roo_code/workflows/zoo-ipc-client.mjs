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

const finish = (code, note) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  clearTimeout(idleTimer);
  const report = { note, clientId, usage, say, events };
  if (eventsPath) writeFileSync(eventsPath, JSON.stringify(report, null, 2));
  else console.log(JSON.stringify(report, null, 2));

  // Результат берут из последней реплики completion_result: только она означает,
  // что агент сам считает работу законченной.
  let written = false;
  if (resultPath) {
    const last = [...say].reverse().find((item) => item.sayType === "completion_result");
    const object = last ? extractJsonObject(last.text) : null;
    if (object) {
      writeFileSync(resultPath, object);
      written = true;
    } else {
      console.error("В ответе нет JSON-объекта результата");
    }
  }
  socket.end();
  process.exit(resultPath && !written ? 1 : code);
};

const timer = setTimeout(() => finish(1, "таймаут ожидания конца задачи"), timeoutMs);

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

    if (eventName === "taskCompleted") {
      send({ type: "TaskCommand", origin: "client", clientId, data: { commandName: "CloseTask" } });
      finish(0, "задача завершена (taskCompleted)");
    }
    if (eventName === "taskIdle" && started) {
      // Пауза на случай, если taskCompleted всё-таки придёт следом.
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        send({ type: "TaskCommand", origin: "client", clientId, data: { commandName: "CancelTask" } });
        finish(0, "задача остановилась (taskIdle)");
      }, 3000);
    }
    if (eventName === "taskAborted") finish(1, "задача прервана");
  }
});
