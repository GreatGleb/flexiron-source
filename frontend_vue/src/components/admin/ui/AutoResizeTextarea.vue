<script setup lang="ts">
/**
 * A textarea that follows its own text.
 *
 * The same twelve lines used to live in seven cards and modals; this is that
 * function, once. The root element IS the textarea, so `class`, `rows`,
 * `placeholder` and `data-test` land on it as fall-through attributes and every
 * selector written against the old markup keeps working.
 *
 * The root carries `glass-input` itself. It used to be the caller's job, and out
 * of 28 call sites two forgot it — the return modal on the order card and the
 * cutting page — so those two boxes were unstyled `<textarea>` among glass
 * fields. A base that every caller has to remember is not a base; a caller that
 * forgets it gets no warning from typecheck, lint or any test. Extra classes
 * from the caller still land: Vue merges fall-through `class` with the root's
 * own, so `class="batch-notes-input"` renders as both.
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

// Own CSS, not borrowed from whoever else is on the page (pitfall #16):
// `admin-core.scss` happens to load this too, but that is the layout's business.
import '@styles/admin/components/_forms.css'

const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined
    /** Past this the box stops growing and starts scrolling. */
    maxHeight?: number
  }>(),
  { maxHeight: 300 },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const el = ref<HTMLTextAreaElement | null>(null)

function resize() {
  const node = el.value
  if (!node) return
  node.style.height = 'auto'
  // A hidden box measures zero, and a zero height would survive the unhiding.
  // `.glass-panel.loading .panel-body` is display:none, and cards fill the form
  // before they drop the loading flag — so this is the ordinary case, not a rare one.
  if (node.scrollHeight === 0) return
  if (node.scrollHeight > props.maxHeight) {
    node.style.height = props.maxHeight + 'px'
    node.style.overflowY = 'auto'
  } else {
    node.style.height = node.scrollHeight + 'px'
    node.style.overflowY = 'hidden'
  }
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
  resize()
}

watch(
  () => props.modelValue,
  () => nextTick(resize),
)

/**
 * The measurement that mount could not take, taken the moment the box is shown.
 * Resizing does not change whether the element intersects, so this settles at once.
 */
let visibility: IntersectionObserver | null = null

/**
 * The same thing for the web font, which is the other reason the first
 * measurement can be wrong — and unlike the hidden box, nothing reveals it.
 *
 * `scrollHeight` is only as good as the font in use at the moment it is read,
 * and at mount that is still the fallback: the browser starts fetching a web
 * font when text that needs it is laid out, which is the very layout this
 * function forces. The number gets written into `style.height` and stays there,
 * so the box keeps the size the fallback had — the browser reflows the text
 * when Inter arrives, but an inline height is not a reflow, it is a decision.
 *
 * Measured 2026-09-24 on `/admin/clients/new`: the notes box locks at 68px and
 * re-measuring the same box after the font has landed gives 71px. Three
 * missing pixels per three-row box, and the panel around it comes out 3px
 * short. It is not new — with the stylesheet link in `index.html` the font
 * usually won this race, so it showed up as an occasional visual diff rather
 * than a constant one (the BCC email template panel, `1181 px`, ratio 0.02).
 * Moving the fonts into the bundle made the race deterministic and lost it
 * every time, which is how it finally became visible.
 */
function onFontsLoaded() {
  resize()
}

onMounted(() => {
  resize()

  // `ready` covers the font already in flight — the one this mount just asked
  // for; `loadingdone` covers a face that starts loading later, when data fills
  // a bolder or wider variant in. Both call the same idempotent resize.
  if (typeof document !== 'undefined' && document.fonts) {
    void document.fonts.ready.then(onFontsLoaded)
    document.fonts.addEventListener('loadingdone', onFontsLoaded)
  }

  if (!el.value || typeof IntersectionObserver === 'undefined') return
  visibility = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) resize()
  })
  visibility.observe(el.value)
})

onBeforeUnmount(() => {
  visibility?.disconnect()
  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.removeEventListener('loadingdone', onFontsLoaded)
  }
})

defineExpose({ resize })
</script>

<template>
  <textarea ref="el" class="glass-input" :value="modelValue ?? ''" @input="onInput" />
</template>
