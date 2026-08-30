import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { vTooltip } from './composables/useTooltip'

/* Existing shared styles from demo */
import '@styles/erp-base.css'
import '@styles/public/public.css'
/*
 * Полосы прокрутки для Firefox — здесь, а не в `admin-core.scss`, потому что тот
 * подключается из `AdminLayout` и до публичных страниц не достаёт, а прокручиваемая
 * область есть и там (`.terms-content`). Правила внутри включаются признаком, который
 * ставит проба ниже; Chrome признака не получает и файла не замечает.
 */
import '@styles/scrollbars-firefox.css'

/*
 * Умеет ли браузер красить полосу прокрутки через `::-webkit-scrollbar`.
 *
 * Раньше это решал `@supports not selector(::-webkit-scrollbar)` внутри самого CSS, и
 * решал неверно: Firefox 154 селектор РАЗБИРАЕТ (webkit-совместимость), поэтому условие
 * у него ложно, но красить им он по-прежнему не умеет. Стандартных свойств он не получал
 * и рисовал системную серую полосу. Плейрайтовский Firefox 148 селектора ещё не знает,
 * поэтому приёмка была зелёной, пока дефект жил у владельца — версия браузера в проверке
 * и версия браузера у человека разошлись.
 *
 * Спросить движок словами нельзя вовсе: `CSS.supports('selector(::-webkit-scrollbar)')`
 * и `getComputedStyle(el, '::-webkit-scrollbar').width` в Firefox 154 отвечают ровно то
 * же, что в Chrome (`true` и `24px`) — он правило и разбирает, и сопоставляет, и
 * вычисляет, а не красит. Единственное честное свидетельство — отрисовка.
 *
 * Поэтому пробнику даётся webkit-полоса в 24px и меряется занятое ею место:
 *
 *   24  — правило красит (Chrome, Safari). Стандартные свойства не нужны, Chrome
 *         остаётся нетронутым, как решил владелец;
 *    0  — полос, занимающих место, нет вовсе: накладные полосы (headless Chrome,
 *         macOS). Красить нечего, и лезть сюда стандартными свойствами незачем;
 *  иное — движок рисует свою полосу поверх нашего правила, то есть правило он
 *         игнорирует. Это Firefox: у него жёлоб 12px при любом нашем `width`.
 *
 * Сравнение именно с числами, а не «жёлоб больше нуля»: при накладных полосах ноль
 * даёт и Chrome, и Firefox, и такая проверка соврала бы на обоих.
 *
 * Специфичность пробы (класс + псевдоэлемент) выше глобального `::-webkit-scrollbar` из
 * `utilities/_global.css`, поэтому наши же 6px замер не искажают.
 */
const WEBKIT_PROBE_WIDTH = 24

function markScrollbarStyling(): void {
  const style = document.createElement('style')
  style.textContent = `.scrollbar-probe::-webkit-scrollbar{width:${WEBKIT_PROBE_WIDTH}px}`
  const probe = document.createElement('div')
  probe.className = 'scrollbar-probe'
  probe.style.cssText =
    'position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;overflow-y:scroll'

  document.head.append(style)
  document.body.append(probe)
  const gutter = probe.offsetWidth - probe.clientWidth
  probe.remove()
  style.remove()

  const enginePaintsItsOwn = gutter !== WEBKIT_PROBE_WIDTH && gutter !== 0
  if (enginePaintsItsOwn) document.documentElement.dataset.scrollbars = 'standard'
}

// До монтирования: иначе первая отрисовка успеет показать чужую полосу.
markScrollbarStyling()

/*
 * В мок-режиме мок-слой — это и есть слой данных приложения, поэтому он грузится на
 * старте, а не первым же запросом (`apiGet` тянет его динамическим import()).
 *
 * Разница видна не в приложении, а в тестах: пока модуль не исполнился, на window нет
 * счётчика запросов, и ожидание «данные пришли» не может отличить «мок ещё не загружен»
 * от «страница ничего не спрашивает». Под нагрузкой чанк не успевал за отведённые ему
 * 2 секунды, ожидание сдавалось, и проверка гонялась с пустой страницей.
 */
if (import.meta.env.VITE_USE_MOCKS !== 'false') {
  // Синхронно — до любого ожидания: «слой данных здесь мок, счётчик запросов будет».
  // Асинхронный import() исполняется тиком позже, и без этого флага тест не может
  // отличить «модуль ещё грузится» от «моков нет вовсе», кроме как по часам.
  window.__mockMode = true
  void import('./services/mocks/index')
}

createApp(App).use(router).use(i18n).directive('tooltip', vTooltip).mount('#app')
