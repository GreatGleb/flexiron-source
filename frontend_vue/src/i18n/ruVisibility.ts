import { ref } from 'vue'

/**
 * Виден ли русский язык в программе (этап 2 лендинга, пункт 4 — решение владельца 2026-11-21,
 * roo_code/plans/landing/landing-stage-2-plan.md).
 *
 * Программу продают в Литве, где русский язык многими воспринимается болезненно, поэтому
 * литовским и английским посетителям его не показывают вовсе: ни кнопки RU в переключателях,
 * ни русского текста запасным вариантом перевода. Виден он только тем, кто пришёл с `/ru`
 * лендинга, — и тем, кто уже работал в программе по-русски (сохранённый язык `ru`).
 *
 * Хранится в браузере (`flexiron_ru = '1'`), а не в настройках сервера: это вопрос того,
 * откуда человек пришёл, а не прав. Ставит и снимает флаг уход с лендинга (useLandingAppLang).
 */
export const RU_VISIBLE_KEY = 'flexiron_ru'

function read(): boolean {
  try {
    return localStorage.getItem(RU_VISIBLE_KEY) === '1'
  } catch {
    return false
  }
}

/** Реактивно: переключатели и подстановка перевода перестраиваются сразу. */
export const ruVisible = ref(read())

export function setRuVisible(visible: boolean) {
  ruVisible.value = visible
  try {
    if (visible) localStorage.setItem(RU_VISIBLE_KEY, '1')
    else localStorage.removeItem(RU_VISIBLE_KEY)
  } catch {
    // Хранилище закрыто (приватный режим) — флаг живёт до перезагрузки.
  }
}
