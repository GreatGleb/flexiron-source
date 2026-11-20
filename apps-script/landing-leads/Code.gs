// Приём заявок с лендинга Flexiron. Привязан к Google Таблице, опубликован как веб-приложение.
//
//   GET                                   -> { ok: true }                 проверка развёртывания
//   POST {name, company, contact, message, page, userAgent}  (Content-Type: text/plain)
//                                         -> { ok: true } | { ok: false, error }
//
// Лист "Leads" — одна строка на заявку: Дата | Имя | Компания | Контакт | Комментарий | Страница | Браузер.
// Уведомление на почту уходит, если в свойствах скрипта задан NOTIFY_EMAIL (см. README.md).

const SHEET_NAME = 'Leads';
const HEADER = ['Дата', 'Имя', 'Компания', 'Контакт', 'Комментарий', 'Страница', 'Браузер'];

// Те же лимиты и выражения, что у формы: frontend_vue/src/domain/landingLead.ts (LIMITS, EMAIL_RE,
// PHONE_RE). Правило одно, среды исполнения две; frontend_vue/src/domain/landingLead.spec.ts
// разбирает этот файл и сверяет числа и выражения. Меняешь здесь — меняй и там.
const NAME_MAX = 100;
const COMPANY_MAX = 150;
const CONTACT_MAX = 150;
const MESSAGE_MAX = 1000;
const PHONE_MIN_DIGITS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const PHONE_RE = /^[\d\s()+.-]+$/;

// Только у сервера: страница и браузер приходят от формы без лимита, но в таблицу не пишем мегабайты.
const META_MAX = 500;

function doGet() {
  return json({ ok: true });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'bad json' });
  }
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad json' });

  const lead = {
    name: text(body.name),
    company: text(body.company),
    contact: text(body.contact),
    message: text(body.message),
    page: text(body.page).slice(0, META_MAX),
    userAgent: text(body.userAgent).slice(0, META_MAX),
  };
  const error = validate(lead);
  if (error) return json({ ok: false, error: error });

  const row = [
    new Date().toISOString(),
    lead.name,
    lead.company,
    lead.contact,
    lead.message,
    lead.page,
    lead.userAgent,
  ].map(function (value) {
    // Ведущий апостроф хранит значение как текст: "=..." никогда не исполнится как формула
    return "'" + value;
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    getSheet().appendRow(row);
  } finally {
    lock.releaseLock();
  }

  notify(lead);
  return json({ ok: true });
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validate(lead) {
  if (!lead.name) return 'name required';
  if (lead.name.length > NAME_MAX) return 'name too long';
  if (lead.company.length > COMPANY_MAX) return 'company too long';
  if (!lead.contact) return 'contact required';
  if (lead.contact.length > CONTACT_MAX) return 'contact too long';
  if (!isValidContact(lead.contact)) return 'contact invalid';
  if (lead.message.length > MESSAGE_MAX) return 'message too long';
  return '';
}

function isValidContact(value) {
  if (value.indexOf('@') !== -1) return EMAIL_RE.test(value);
  return PHONE_RE.test(value) && value.replace(/\D/g, '').length >= PHONE_MIN_DIGITS;
}

// Заявка уже в таблице; сбой почты её не отменяет и ответ формы не портит
function notify(lead) {
  const to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to) return;
  try {
    MailApp.sendEmail(
      to,
      'Заявка с лендинга Flexiron: ' + lead.name,
      [
        'Имя: ' + lead.name,
        'Компания: ' + lead.company,
        'Контакт: ' + lead.contact,
        'Комментарий: ' + lead.message,
        'Страница: ' + lead.page,
      ].join('\n'),
    );
  } catch (err) {
    console.error('NOTIFY_EMAIL: ' + err);
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  // Шапка пишется только на пустой лист: заявки, уже лежащие в строке 1, не затираются
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
