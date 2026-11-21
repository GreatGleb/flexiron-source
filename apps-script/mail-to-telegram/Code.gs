// Пересылка входящей почты flexiron.erp@gmail.com в Telegram. Отдельный проект Apps Script под этим
// ящиком (не привязан к таблице), запускается триггером раз в минуту. Установка — README.md рядом.
//
// Что уходит: каждое новое письмо из «Входящих» — сообщением «✉️ Письмо» (от кого, тема, текст,
// ссылка на письмо в Gmail), вложения — следом файлами. Спам и письма вне «Входящих» не пересылаются.
//
// Где граница «новых»: свойство LAST_TS — время самого позднего пересланного письма, и SEEN_AT_TS —
// id писем ровно с этим временем (у Gmail время с точностью до секунды). Сбой Telegram границу не
// двигает: неотправленное письмо уйдёт при следующем запуске.
//
// Свойства скрипта: TG_BOT_TOKEN, TG_CHAT_ID — те же, что у скрипта заявок.

const MAILBOX = 'flexiron.erp@gmail.com';
// Предел одного сообщения Telegram
const TELEGRAM_MAX = 4096;
// Предел файла, который бот может отправить
const FILE_MAX_BYTES = 50 * 1024 * 1024;
// Писем за один запуск: остальные — в следующую минуту, чтобы запуск не упирался в лимит времени
const BATCH = 20;
const TRIM_MARK = '\n…(письмо обрезано — целиком в Gmail)';

// Запустить один раз из редактора: включает пересылку с этой минуты (старые письма не шлёт),
// ставит триггер раз в минуту и присылает в Telegram проверочное сообщение.
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'forwardNewMail') ScriptApp.deleteTrigger(trigger);
  });
  const props = PropertiesService.getScriptProperties();
  props.setProperty('LAST_TS', String(Date.now()));
  props.setProperty('SEEN_AT_TS', '[]');
  ScriptApp.newTrigger('forwardNewMail').timeBased().everyMinutes(1).create();
  const sent = telegram('sendMessage', {
    chat_id: prop('TG_CHAT_ID'),
    text: '✅ Пересылка почты ' + MAILBOX + ' включена. Новые письма будут приходить сюда.',
  });
  if (!sent) throw new Error('Telegram не ответил — проверьте TG_BOT_TOKEN и TG_CHAT_ID');
}

// Выключить пересылку (снять триггер). Включить снова — setup().
function stop() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'forwardNewMail') ScriptApp.deleteTrigger(trigger);
  });
}

function forwardNewMail() {
  const props = PropertiesService.getScriptProperties();
  const lastTs = Number(props.getProperty('LAST_TS'));
  if (!lastTs) return; // setup() не запускали
  const seen = JSON.parse(props.getProperty('SEEN_AT_TS') || '[]');

  const fresh = [];
  const query = 'in:inbox after:' + Math.floor(lastTs / 1000);
  GmailApp.search(query, 0, 50).forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      const ts = message.getDate().getTime();
      if (ts < lastTs) return;
      if (ts === lastTs && seen.indexOf(message.getId()) !== -1) return;
      if (!message.isInInbox()) return;
      fresh.push(message);
    });
  });
  fresh.sort(function (a, b) {
    return a.getDate().getTime() - b.getDate().getTime();
  });

  let boundary = lastTs;
  let atBoundary = seen;
  for (let i = 0; i < fresh.length && i < BATCH; i++) {
    const message = fresh[i];
    if (!forward(message)) break; // Telegram не принял — граница остаётся, повтор в следующую минуту
    const ts = message.getDate().getTime();
    if (ts > boundary) {
      boundary = ts;
      atBoundary = [];
    }
    atBoundary.push(message.getId());
  }
  props.setProperty('LAST_TS', String(boundary));
  props.setProperty('SEEN_AT_TS', JSON.stringify(atBoundary));
}

// true — письмо доставлено (текст; вложения — по возможности, их сбой письмо не возвращает в очередь:
// иначе текст пришёл бы второй раз).
function forward(message) {
  const ok = telegram('sendMessage', {
    chat_id: prop('TG_CHAT_ID'),
    text: messageText(message),
    disable_web_page_preview: true,
  });
  if (!ok) return false;
  message.getAttachments({ includeInlineImages: false }).forEach(function (file) {
    if (file.getSize() > FILE_MAX_BYTES) {
      telegram('sendMessage', {
        chat_id: prop('TG_CHAT_ID'),
        text: '📎 ' + file.getName() + ' — больше 50 МБ, только в Gmail',
      });
      return;
    }
    telegram('sendDocument', { chat_id: prop('TG_CHAT_ID'), document: file.copyBlob() });
  });
  return true;
}

// Простой текст без разметки: письмо может содержать что угодно, экранировать нечего.
function messageText(message) {
  const head = [
    '✉️ Письмо на ' + MAILBOX,
    'От: ' + message.getFrom(),
    'Тема: ' + (message.getSubject() || '(без темы)'),
    '',
    '',
  ].join('\n');
  const link =
    '\n\nОткрыть в Gmail: https://mail.google.com/mail/?authuser=' +
    encodeURIComponent(MAILBOX) +
    '#all/' +
    message.getThread().getId();
  const body = (message.getPlainBody() || '').trim() || '(пустое письмо)';
  const room = TELEGRAM_MAX - head.length - link.length;
  const text = body.length > room ? body.slice(0, room - TRIM_MARK.length) + TRIM_MARK : body;
  return head + text + link;
}

// true — Telegram ответил 200. Токен бота стоит в адресе — из текста ошибки он вырезается.
function telegram(method, payload) {
  const token = prop('TG_BOT_TOKEN');
  if (!token || !prop('TG_CHAT_ID')) {
    console.error('TG_BOT_TOKEN или TG_CHAT_ID не заданы');
    return false;
  }
  // Файл уходит multipart'ом (payload — объект с Blob, тип UrlFetchApp ставит сам), текст — JSON
  const options = { method: 'post', muteHttpExceptions: true };
  if (method === 'sendDocument') {
    options.payload = payload;
  } else {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  try {
    const response = UrlFetchApp.fetch(
      'https://api.telegram.org/bot' + token + '/' + method,
      options,
    );
    if (response.getResponseCode() === 200) return true;
    console.error('TELEGRAM ' + method + ': http ' + response.getResponseCode());
    return false;
  } catch (err) {
    console.error('TELEGRAM ' + method + ': ' + String(err).split(token).join('***'));
    return false;
  }
}

function prop(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}
