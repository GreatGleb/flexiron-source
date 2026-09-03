<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUnitLabel } from '@/composables/useUnitLabel'
import { useProductNames } from '@/composables/useProductNames'
import { useHead } from '@/composables/useHead'
import { useWarehouseCutting, type CuttingRow } from '@/composables/useWarehouseCutting'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import Pagination from '@/components/admin/ui/Pagination.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import AutoResizeTextarea from '@/components/admin/ui/AutoResizeTextarea.vue'
import '@styles/admin/warehouse_list.css'
import '@styles/admin/components/_entity-card-layout.css'

const { t } = useI18n()
const unitLabel = useUnitLabel()
const { productName } = useProductNames()
const route = useRoute()
const router = useRouter()

const {
  batches,
  batchesLoading,
  batchSearch,
  batchesPagination,
  batch,
  batchLoading,
  loadBatches,
  selectBatch,
  clearBatch,
  rows,
  form,
  addRow,
  removeRow,
  uomId,
  kerfApplies,
  countedBatch,
  derivedWeight,
  weightIsManual,
  useDerivedWeight,
  consumption,
  remainingAfter,
  problem,
  canSubmit,
  saving,
  submit,
} = useWarehouseCutting()

// Геттером, а не computed: useHead вызывает title(), ref сюда передавать нельзя.
useHead({
  title: () => `Flexiron — ${t('warehouse.modal_cutting_title')}`,
  description: () => t('warehouse.cutting_subtitle'),
})

/** Подпись единицы партии — из справочника, в текущем языке (п. 4d). */
const batchUnitLabel = computed(() => (uomId.value ? unitLabel(uomId.value) : ''))

const TYPE_OPTIONS = computed(() => [
  { value: 'linear', label: t('warehouse.offcut_type_linear') },
  { value: 'sheet', label: t('warehouse.offcut_type_sheet') },
])

/**
 * Сообщение об отказе — на языке оператора, с номером куска, а не с кодом ошибки.
 *
 * Отказы приходят из домена (`resolvePieceSize`), поэтому текст один и тот же, что бы
 * ни отказало — форма, мок или сервер.
 */
const problemMessage = computed(() => {
  const p = problem.value
  if (!p) return ''
  if (p.kind === 'no_offcuts') return t('warehouse.cutting_error_no_offcuts')
  if (p.kind === 'unit_not_supported')
    return t('warehouse.cutting_error_unit_not_supported', { unit: batchUnitLabel.value })
  if (p.kind === 'insufficient')
    return t('warehouse.cutting_error_insufficient', {
      remaining: `${p.remaining} ${batchUnitLabel.value}`,
      consumed: `${p.consumed} ${batchUnitLabel.value}`,
    })
  if (p.kind === 'negative_amount') return t('warehouse.cutting_error_negative_amount')
  if (p.kind === 'source_pieces_invalid')
    return t('warehouse.cutting_error_source_pieces', { unit: batchUnitLabel.value })
  if (p.kind === 'pieces_not_integer')
    return t('warehouse.cutting_error_pieces_not_integer', { row: p.row + 1 })
  if (p.kind === 'dimension_missing')
    return t('warehouse.cutting_error_dimension_missing', {
      row: p.row + 1,
      dimension: t(`warehouse.cutting_dim_${p.detail}`, p.detail),
    })
  return ''
})

/**
 * Подпись источника веса: расчётный, введённый руками или «расчёта нет».
 *
 * Три состояния, а не два: вывод веса отказывает по названной причине — нет
 * плотности в каталоге, нет размеров, не объявлен тип куска, — и молчаливое
 * «расчётный» на пустом поле в этом случае было бы обещанием числа, которого не
 * будет. Причина уходит в подсказку: в ячейке таблицы для неё нет места.
 */
function weightSourceLabel(row: CuttingRow): string {
  // Подписи короткие, а не те же, что в форме создания обрезка: там бейдж стоит под
  // полем во всю колонку, здесь — в ячейке таблицы, и «Выведен из размеров» ложился
  // в две строки, растягивая строку вдвое. Полная фраза осталась — в подсказке.
  if (weightIsManual(row)) return t('warehouse.weight_badge_manual')
  return derivedWeight(row).ok
    ? t('warehouse.weight_badge_derived')
    : t('warehouse.weight_badge_none')
}

/** Почему вывод веса не получился — словами, а не кодом отказа. */
function weightSourceHint(row: CuttingRow): string {
  const derived = derivedWeight(row)
  if (derived.ok) return t('warehouse.weight_derived_preview', { value: derived.weightKg })
  const key = {
    no_density: 'weight_not_derivable_no_density',
    no_dimensions: 'weight_not_derivable_no_dimensions',
    no_per_unit_weight: 'weight_not_derivable_no_per_unit',
    no_offcut_type: 'weight_not_derivable_no_type',
    unit_not_supported: 'weight_not_derivable_unit',
  }[derived.reason]
  return t(`warehouse.${key}`)
}

/** Расчётный вес прямо в пустом поле: оператор видит предложение до выбора. */
function weightPlaceholder(row: CuttingRow): string {
  const derived = derivedWeight(row)
  return derived.ok ? String(derived.weightKg) : ''
}

/** Номер куска, на котором операция встала: строка подсвечивается, а не только текст. */
const problemRow = computed(() =>
  problem.value && 'row' in problem.value ? problem.value.row : -1,
)

/**
 * Назад к выбору партии.
 *
 * Отдельная функция, а не два вызова в `@click`: многострочный обработчик в шаблоне
 * prettier переформатирует без разделителя, и шаблон перестаёт компилироваться —
 * причём ни typecheck, ни eslint этого не видят, ошибка приходит только от Vite.
 */
function backToPicker() {
  clearBatch()
  loadBatches()
}

function goToOffcuts() {
  router.push({ name: 'admin-warehouse', params: { tab: 'offcuts' } })
}

async function onExecute() {
  const done = await submit()
  if (done) goToOffcuts()
}

onMounted(() => {
  const preselected = route.query.batchId
  if (typeof preselected === 'string' && preselected) selectBatch(preselected)
  else loadBatches()
})

// Поиск по партиям перезапрашивает список — фильтрует сервер, а не страница.
watch(batchSearch, () => {
  if (!batch.value) loadBatches()
})
</script>

<template>
  <div class="page-warehouse-cutting" data-test="warehouse-cutting-page">
    <Breadcrumb
      :items="[
        { label: t('warehouse.header_title'), to: { name: 'admin-warehouse' } },
        {
          label: t('warehouse.tab_offcuts'),
          to: { name: 'admin-warehouse', params: { tab: 'offcuts' } },
        },
        { label: t('warehouse.modal_cutting_title') },
      ]"
    />

    <div class="offcut-card-header">
      <div>
        <h1 class="page-title">{{ t('warehouse.modal_cutting_title') }}</h1>
        <p class="text-muted">{{ t('warehouse.cutting_subtitle') }}</p>
      </div>
      <div class="entity-action-bar no-margin pos-static">
        <button
          type="button"
          class="btn btn-secondary"
          data-test="warehouse-cutting-cancel-btn"
          @click="goToOffcuts"
        >
          {{ t('btn.cancel') }}
        </button>
      </div>
    </div>

    <!-- ── Партия-источник: выбор, пока она не выбрана ──────────────────────── -->
    <GlassPanel
      v-if="!batch"
      :title="t('warehouse.field_source_batch')"
      :loading="batchesLoading || batchLoading"
      :skeleton-rows="3"
      data-test="warehouse-cutting-batch-panel"
    >
      <p class="text-muted cutting-hint">
        {{ t('warehouse.cutting_pick_batch_hint') }}
      </p>
      <div class="cutting-picker-search">
        <SearchInput
          v-model="batchSearch"
          :placeholder="t('warehouse.cutting_batch_search')"
          data-test="warehouse-cutting-batch-search"
        />
      </div>
      <div class="data-table-wrapper">
        <table class="data-table" data-test="warehouse-cutting-batches-table">
          <thead>
            <tr>
              <th>{{ t('warehouse.col_batch_number') }}</th>
              <th>{{ t('warehouse.col_product') }}</th>
              <th>{{ t('warehouse.col_remaining') }}</th>
              <th class="col-pick"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="batches.length === 0 && !batchesLoading">
              <td colspan="4" class="cutting-empty-cell">
                {{ t('warehouse.cutting_no_batches') }}
              </td>
            </tr>
            <tr
              v-for="b in batches"
              :key="b.id"
              :data-batch-id="b.id"
              data-test="warehouse-cutting-batch-row"
            >
              <td>{{ b.batchNumber }}</td>
              <td>{{ productName(b.productId) }}</td>
              <td>{{ b.quantityRemaining }} {{ unitLabel(b.uomId) }}</td>
              <td>
                <button
                  type="button"
                  class="btn btn-sm btn-primary"
                  data-test="warehouse-cutting-batch-pick"
                  @click="selectBatch(b.id)"
                >
                  <SvgIcon name="scissors" :width="14" :height="14" />
                  <span>{{ t('warehouse.btn_cut') }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!--
        Список партий листается сервером: раньше запрашивались первые пятьдесят и
        рисовались все разом, и партии за пятидесятой не существовало вовсе.
        Компонент и композабл общие — те же, что на остальных списках.
      -->
      <Pagination
        v-model:page="batchesPagination.page.value"
        :total-pages="batchesPagination.totalPages.value"
        :pages="batchesPagination.pageNumbers()"
        :showing-from="batchesPagination.showingFrom.value"
        :showing-to="batchesPagination.showingTo.value"
        :total="batchesPagination.total.value"
        :of-label="t('warehouse.of')"
        test-id="warehouse-cutting-batches-pagination"
        prev-test-id="warehouse-cutting-batches-prev"
        next-test-id="warehouse-cutting-batches-next"
      />
    </GlassPanel>

    <!-- ── Резка выбранной партии ───────────────────────────────────────────── -->
    <template v-else>
      <GlassPanel
        :title="t('warehouse.field_source_batch')"
        data-test="warehouse-cutting-source-panel"
      >
        <!--
          Заголовок рисует сам GlassPanel по `:title`. Раньше слот дублировал его
          вторым `panel-title`, и панель печатала «Исходная партияИсходная партия»:
          компонент рендерит и то, и другое. В слоте остаётся только кнопка.

          Обёртка `.panel-header-actions` — общая, из `_glass-panel.css`; она же
          прижимает группу вправо, поэтому инлайновый `margin-left: auto` не нужен.
        -->
        <template #header>
          <div class="panel-header-actions">
            <button
              type="button"
              class="btn btn-sm btn-secondary"
              data-test="warehouse-cutting-change-batch"
              @click="backToPicker"
            >
              {{ t('warehouse.cutting_change_batch') }}
            </button>
          </div>
        </template>
        <div class="entity-card-grid">
          <div class="entity-col-left">
            <InputGroup :label="t('warehouse.col_batch_number')">
              <div class="glass-input readonly-value" data-test="warehouse-cutting-batch-number">
                {{ batch.batchNumber }}
              </div>
            </InputGroup>
          </div>
          <div class="entity-col-center">
            <InputGroup :label="t('warehouse.col_product')">
              <div class="glass-input readonly-value" data-test="warehouse-cutting-product">
                {{ productName(batch.productId) }}
              </div>
            </InputGroup>
          </div>
          <div class="entity-col-right">
            <InputGroup :label="t('warehouse.cutting_remaining')">
              <div class="glass-input readonly-value" data-test="warehouse-cutting-remaining">
                {{ batch.quantityRemaining }} {{ batchUnitLabel }}
              </div>
            </InputGroup>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel
        :title="t('warehouse.field_offcuts')"
        class="cutting-section-gap"
        data-test="warehouse-cutting-offcuts-panel"
      >
        <div class="data-table-wrapper">
          <table class="data-table" data-test="warehouse-cutting-rows-table">
            <thead>
              <tr>
                <th>{{ t('warehouse.col_offcut_type') }}</th>
                <th>{{ t('warehouse.col_length') }}</th>
                <th>{{ t('warehouse.col_width') }}</th>
                <th>{{ t('warehouse.col_thickness') }}</th>
                <th>{{ t('warehouse.col_weight') }}</th>
                <th>
                  <span v-tooltip="t('warehouse.cutting_col_pieces_hint')">
                    {{ t('warehouse.cutting_col_pieces') }}
                  </span>
                </th>
                <th class="col-actions">{{ t('warehouse.col_actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in rows"
                :key="index"
                :class="{ 'row-invalid': problemRow === index }"
                :data-row-index="index"
                data-test="warehouse-cutting-row"
              >
                <td class="col-offcut-type">
                  <CustomSelect
                    v-model="row.offcutType"
                    :options="TYPE_OPTIONS"
                    data-test="warehouse-cutting-row-type"
                  />
                </td>
                <td>
                  <input
                    v-model.number="row.lengthMm"
                    type="number"
                    min="0"
                    class="glass-input"
                    data-test="warehouse-cutting-row-length"
                  />
                </td>
                <td>
                  <input
                    v-model.number="row.widthMm"
                    type="number"
                    min="0"
                    class="glass-input"
                    data-test="warehouse-cutting-row-width"
                  />
                </td>
                <td>
                  <input
                    v-model.number="row.thicknessMm"
                    type="number"
                    min="0"
                    class="glass-input"
                    data-test="warehouse-cutting-row-thickness"
                  />
                </td>
                <td class="col-weight">
                  <!--
                    Вес — ВЫБОР, а не просто поле. Пустое поле означает «считай сам»,
                    и расчёт живёт дальше на карточке куска; вписанное число глушит
                    расчёт навсегда, и раньше об этом на экране не говорилось ничего.
                    Бейдж называет источник, подсказка показывает предлагаемое число,
                    кнопка возвращает расчёт. Те же ключи и то же поведение, что в
                    форме создания обрезка, — расчёт один на три экрана.
                  -->
                  <input
                    v-model.number="row.weightKg"
                    type="number"
                    min="0"
                    step="0.01"
                    class="glass-input"
                    :placeholder="weightPlaceholder(row)"
                    data-test="warehouse-cutting-row-weight"
                  />
                  <div class="cutting-weight-source">
                    <span
                      class="status-pill"
                      :class="weightIsManual(row) ? 'pill-warning' : 'pill-info'"
                      :title="weightSourceHint(row)"
                      data-test="warehouse-cutting-row-weight-source"
                    >
                      {{ weightSourceLabel(row) }}
                    </span>
                    <button
                      v-if="weightIsManual(row) && derivedWeight(row).ok"
                      type="button"
                      class="btn btn-sm btn-secondary"
                      data-test="warehouse-cutting-row-weight-use-derived"
                      @click="useDerivedWeight(index)"
                    >
                      {{ t('warehouse.weight_use_derived') }}
                    </button>
                  </div>
                </td>
                <td>
                  <input
                    v-model.number="row.quantity"
                    type="number"
                    min="1"
                    step="1"
                    class="glass-input"
                    data-test="warehouse-cutting-row-pieces"
                  />
                </td>
                <td>
                  <!--
                    Строку таблицы в этом проекте удаляют иконкой-корзиной, а не
                    текстовой красной кнопкой: образец — `OrderCreatePage.vue`,
                    `action-icon-btn action-danger` + `SvgIcon name="trash"`.
                    Подпись переехала в подсказку — ключ тот же, ничего не потеряно.
                  -->
                  <button
                    v-tooltip="t('warehouse.cutting_btn_remove_row')"
                    type="button"
                    class="action-icon-btn action-danger"
                    :disabled="rows.length === 1"
                    data-test="warehouse-cutting-row-remove"
                    @click="removeRow(index)"
                  >
                    <SvgIcon name="trash" :width="14" :height="14" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <button
          type="button"
          class="btn btn-secondary cutting-add-row"
          data-test="warehouse-cutting-add-row"
          @click="addRow"
        >
          <SvgIcon name="plus-add" :width="16" :height="16" />
          <span>{{ t('warehouse.btn_add_offcut') }}</span>
        </button>
      </GlassPanel>

      <div class="cutting-bottom-grid cutting-section-gap">
        <GlassPanel
          :title="t('warehouse.cutting_losses_title')"
          data-test="warehouse-cutting-losses-panel"
        >
          <!--
            Ширина реза показывается ТОЛЬКО у партии, которая меряется по длине.
            Не полем со нулём: видимое поле, которое молча ничего не делает, —
            это ровно тот `field_kerf`, что три года лежал переведённым и
            неподключённым.
          -->
          <div class="cutting-losses-row">
            <InputGroup v-if="kerfApplies" :label="t('warehouse.field_kerf')">
              <input
                v-model.number="form.kerfMm"
                type="number"
                min="0"
                step="0.1"
                class="glass-input"
                data-test="warehouse-cutting-kerf"
              />
              <span class="field-hint">{{ t('warehouse.cutting_field_kerf_hint') }}</span>
            </InputGroup>
            <!--
              Число штук партии — ЕДИНСТВЕННОЕ место расчёта, где расход спрашивают,
              а не выводят, и стоит оно только у штучной партии. Вывести его неоткуда:
              лист, распущенный на четыре куска, забирает с партии один лист, и по
              кускам единицу не получить. У измеримой партии поля нет — там расход
              выводится из размеров, и второе число рядом с ним было бы второй правдой.
            -->
            <InputGroup
              v-else-if="countedBatch"
              :label="t('warehouse.cutting_field_source_pieces', { unit: batchUnitLabel })"
            >
              <input
                v-model.number="form.sourcePieces"
                type="number"
                min="1"
                step="1"
                class="glass-input"
                data-test="warehouse-cutting-source-pieces"
              />
              <span class="field-hint">{{ t('warehouse.cutting_field_source_pieces_hint') }}</span>
            </InputGroup>

            <InputGroup :label="t('warehouse.cutting_field_waste', { unit: batchUnitLabel })">
              <input
                v-model.number="form.wasteQuantity"
                type="number"
                min="0"
                step="0.01"
                class="glass-input"
                data-test="warehouse-cutting-waste"
              />
            </InputGroup>
          </div>

          <!--
            Отсутствие поля пропила объясняется словами, а не пустым местом: видимое
            поле, которое молча ничего не делает, — это ровно тот `field_kerf`, что
            три года лежал переведённым и неподключённым.
          -->
          <p
            v-if="!kerfApplies"
            class="field-hint cutting-kerf-note"
            data-test="warehouse-cutting-kerf-absent"
          >
            {{ t('warehouse.cutting_kerf_only_linear', { unit: batchUnitLabel }) }}
          </p>

          <InputGroup :label="t('warehouse.cutting_field_notes')">
            <AutoResizeTextarea v-model="form.notes" data-test="warehouse-cutting-notes" />
          </InputGroup>
        </GlassPanel>

        <GlassPanel
          :title="t('warehouse.cutting_summary_title')"
          data-test="warehouse-cutting-summary"
        >
          <!--
            Расход не вводится — он выводится. Два поля, которые обязаны совпадать,
            расходятся ровно тогда, когда их два.
          -->
          <!--
            Площади отдельной строкой здесь НЕТ сознательно: у партии в м² размер
            куска И ЕСТЬ площадь, и она уже стоит выше как расход. Второе число рядом
            с тем же числом только путает.
          -->
          <dl v-if="consumption" class="cutting-summary">
            <div>
              <dt>{{ t('warehouse.cutting_summary_pieces') }}</dt>
              <dd data-test="warehouse-cutting-total-pieces">
                {{ consumption.offcutTotal }} {{ batchUnitLabel }}
              </dd>
            </div>
            <div>
              <dt>{{ t('warehouse.cutting_summary_cuts') }}</dt>
              <dd data-test="warehouse-cutting-cuts">{{ consumption.cuts }}</dd>
            </div>
            <div v-if="kerfApplies">
              <dt>{{ t('warehouse.cutting_summary_kerf') }}</dt>
              <dd data-test="warehouse-cutting-total-kerf">
                {{ consumption.kerfTotal }} {{ batchUnitLabel }}
              </dd>
            </div>
            <div>
              <dt>{{ t('warehouse.cutting_summary_waste') }}</dt>
              <dd data-test="warehouse-cutting-total-waste">
                {{ consumption.waste }} {{ batchUnitLabel }}
              </dd>
            </div>
            <div class="cutting-summary-total">
              <dt>{{ t('warehouse.cutting_summary_total') }}</dt>
              <dd data-test="warehouse-cutting-consumed">
                {{ consumption.consumed }} {{ batchUnitLabel }}
              </dd>
            </div>
            <div v-if="remainingAfter !== null">
              <dt>{{ t('warehouse.cutting_summary_remaining') }}</dt>
              <dd data-test="warehouse-cutting-remaining-after">
                {{ remainingAfter }} {{ batchUnitLabel }}
              </dd>
            </div>
          </dl>

          <p v-if="problemMessage" class="cutting-problem" data-test="warehouse-cutting-problem">
            {{ problemMessage }}
          </p>

          <button
            type="button"
            class="btn btn-primary cutting-submit"
            :class="{ loading: saving }"
            :disabled="!canSubmit"
            data-test="warehouse-cutting-execute"
            @click="onExecute"
          >
            <SvgIcon name="scissors" :width="18" :height="18" />
            <span>{{ t('warehouse.cutting_btn_execute') }}</span>
          </button>
        </GlassPanel>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Показанное значение, а не поле: правится оно в карточке партии, не здесь. */
.readonly-value {
  display: flex;
  align-items: center;
  opacity: 0.7;
  cursor: default;
}

.cutting-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.cutting-summary > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.cutting-summary dt {
  color: var(--text-dim);
}

/* Цвет — ЯВНО. Наследовать его здесь не от кого: `body` в приложении чёрный, а
   тёмный фон даёт не он, а `.bg-image` под содержимым. Подпись `dt` цвет себе
   назначала, число `dd` — нет, и пять чисел расчёта печатались чёрным по
   тёмному. Правило шире этого места: на тёмной подложке текст без своего
   `color` — это чёрный текст, а не «как у соседей». */
.cutting-summary dd {
  margin: 0;
  color: var(--text, #fff);
  font-variant-numeric: tabular-nums;
}

.cutting-summary-total {
  padding-top: 8px;
  border-top: 1px solid var(--glass-border, rgba(255, 255, 255, 0.12));
  font-weight: 600;
}

/* Пояснение вместо поля: подпись — общая `.field-label`, текст — общий
   `.field-hint`. Свой у него только прижатый к подписи верхний отступ: у
   `.field-hint` он рассчитан на положение ПОД полем, а здесь поля нет. */
.cutting-kerf-note {
  margin-top: 0;
  margin-bottom: 20px;
}

/* Два коротких числа — в ряд: растянутое на всю панель поле «Отходы» выглядит
   полем для текста, а не для числа. Примечание ниже занимает всю ширину — ему
   она нужна. */
.cutting-losses-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
  align-items: start;
}

@media (max-width: 600px) {
  .cutting-losses-row {
    grid-template-columns: 1fr;
  }
}

.cutting-problem {
  margin-top: 12px;
  color: var(--danger, #e5484d);
}

.row-invalid td {
  background: rgba(229, 72, 77, 0.08);
}

/* ─── Отступы и ширины: классами, а не инлайновым `style=` ──────────────────
   Их было одиннадцать штук россыпью по шаблону. Инлайновый стиль нельзя ни
   переопределить, ни найти грепом по имени, ни поменять разом — а здесь это
   были обычные отступы между секциями, у которых нет причин быть особенными.
   Блок scoped: классы страничные и чужим файлам не нужны (питфолл #63). */

.cutting-hint {
  margin-bottom: 12px;
}

.cutting-picker-search {
  margin-bottom: 12px;
}

.cutting-add-row {
  margin-top: 12px;
}

/* Главное действие страницы — во всю ширину сводки и отбитое от чисел, чтобы не
   читалось как ещё одна строка расчёта. */
.cutting-submit {
  width: 100%;
  justify-content: center;
  margin-top: 16px;
}

/* Промежуток между секциями страницы — тот же, что между панелями. */
.cutting-section-gap {
  margin-top: 16px;
}

/* ─── Нижний ряд: параметры операции и расчёт ───────────────────────────────
   Здесь стояла общая `.entity-card-grid` (1fr 2fr 1fr) на двух панелях, и
   третья колонка оставалась пустой: справа висели 300 px пустоты, а форма
   слева жалась в самую узкую колонку макета и переносила подсказку на три
   строки. Колонок ровно столько, сколько панелей. Форма шире расчёта:
   в расчёте подпись и число, и на широкой колонке они разъезжаются по краям. */
.cutting-bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 24px;
  align-items: start;
}

/* Разводит панели `gap`, а не их собственный нижний отступ: в сетке он лишний
   и добавляет пустую полосу под рядом. */
.cutting-bottom-grid > .glass-panel {
  margin-bottom: 0;
}

@media (max-width: 992px) {
  .cutting-bottom-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

/* Панель сама держит внутренний отступ — нижний отступ последнего поля и
   вложенной сетки к нему прибавляется и читается как пустая полоса. */
.panel-body > .entity-card-grid:last-child,
.panel-body > .input-group:last-child,
.entity-card-grid .input-group:last-child,
.cutting-losses-row .input-group:last-child {
  margin-bottom: 0;
}

.cutting-empty-cell {
  padding: 24px 0;
  text-align: center;
  opacity: 0.5;
}

/* Ширины столбцов, которые иначе разъезжаются: кнопка выбора и действия строки. */
.col-pick {
  width: 120px;
}

.col-actions {
  width: 100px;
}

.col-offcut-type {
  min-width: 140px;
}

/* Столбец веса несёт под полем строку источника — ей нужна ширина, иначе бейдж и
   кнопка переносятся по одному и строка таблицы вырастает вдвое. */
.col-weight {
  min-width: 150px;
}

/* Откуда взялся вес: бейдж и кнопка возврата к расчёту — в один ряд под полем.
   Тот же приём, что в форме создания обрезка (`.offcut-weight-source`). */
.cutting-weight-source {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
}
</style>
