<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import '@styles/admin/components/_datepicker.css'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const wrapRef = ref<HTMLElement | null>(null)

const viewYear = ref(0)
const viewMonth = ref(0)

const selectedDate = computed(() => {
  if (!props.modelValue) return null
  const d = new Date(props.modelValue + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
})

const displayValue = computed(() => {
  if (!selectedDate.value) return ''
  const d = selectedDate.value
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
})

const monthTitle = computed(() => {
  const d = new Date(viewYear.value, viewMonth.value)
  return d.toLocaleDateString('en', { month: 'long', year: 'numeric' })
})

const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const calendarDays = computed(() => {
  const firstDay = new Date(viewYear.value, viewMonth.value, 1)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  const daysInPrev = new Date(viewYear.value, viewMonth.value, 0).getDate()

  const days: { day: number; month: number; year: number; otherMonth: boolean }[] = []

  for (let i = startDow - 1; i >= 0; i--) {
    const m = viewMonth.value === 0 ? 11 : viewMonth.value - 1
    const y = viewMonth.value === 0 ? viewYear.value - 1 : viewYear.value
    days.push({ day: daysInPrev - i, month: m, year: y, otherMonth: true })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, month: viewMonth.value, year: viewYear.value, otherMonth: false })
  }

  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const m = viewMonth.value === 11 ? 0 : viewMonth.value + 1
    const y = viewMonth.value === 11 ? viewYear.value + 1 : viewYear.value
    days.push({ day: d, month: m, year: y, otherMonth: true })
  }

  return days
})

const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

function isToday(d: { day: number; month: number; year: number }) {
  const str = `${d.year}-${String(d.month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
  return str === todayStr
}

function isSelected(d: { day: number; month: number; year: number }) {
  if (!props.modelValue) return false
  const str = `${d.year}-${String(d.month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
  return str === props.modelValue
}

function selectDay(d: { day: number; month: number; year: number }) {
  const iso = `${d.year}-${String(d.month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
  emit('update:modelValue', iso)
  open.value = false
}

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

function toggleOpen() {
  if (!open.value) {
    const d = selectedDate.value ?? new Date()
    viewYear.value = d.getFullYear()
    viewMonth.value = d.getMonth()
  }
  open.value = !open.value
}

function onClickOutside(e: MouseEvent) {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => {
  const d = selectedDate.value ?? new Date()
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
  document.addEventListener('click', onClickOutside)
})

onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div ref="wrapRef" class="custom-datepicker-wrap">
    <div class="glass-input datepicker-trigger" @click="toggleOpen">
      <span class="date-val">{{ displayValue }}</span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        style="opacity: 0.5"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    </div>
    <div class="datepicker-popup" :class="{ open }">
      <div class="calendar-header">
        <span class="calendar-title">{{ monthTitle }}</span>
        <div class="calendar-nav">
          <button type="button" class="nav-btn" @click.stop="prevMonth">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button type="button" class="nav-btn" @click.stop="nextMonth">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
      <div class="calendar-grid">
        <div v-for="wd in weekdays" :key="wd" class="weekday">{{ wd }}</div>
        <div
          v-for="(d, i) in calendarDays"
          :key="i"
          class="calendar-day"
          :class="{
            'other-month': d.otherMonth,
            today: isToday(d),
            selected: isSelected(d),
          }"
          @click.stop="selectDay(d)"
        >
          {{ d.day }}
        </div>
      </div>
    </div>
  </div>
</template>
