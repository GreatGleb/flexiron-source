<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useWarehouseCutting } from '@/composables/useWarehouseCutting'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import AutoResizeTextarea from '@/components/admin/ui/AutoResizeTextarea.vue'
import '@styles/admin/warehouse_list.css'
import '@styles/admin/components/_entity-card-layout.css'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const {
  batches,
  batchesLoading,
  batchSearch,
  batch,
  batchLoading,
  loadBatches,
  selectBatch,
  clearBatch,
  rows,
  form,
  addRow,
  removeRow,
  unit,
  kerfApplies,
  consumption,
  remainingAfter,
  problem,
  canSubmit,
  saving,
  submit,
  tf,
} = useWarehouseCutting()

// Геттером, а не computed: useHead вызывает title(), ref сюда передавать нельзя.
useHead({
  title: () => `Flexiron — ${t('warehouse.modal_cutting_title')}`,
  description: () => t('warehouse.cutting_subtitle'),
})

/** Подпись единицы партии — своими ключами склада, с кодом как дефолтом. */
const unitLabel = computed(() => (unit.value ? t(`warehouse.unit_${unit.value}`, unit.value) : ''))

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
    return t('warehouse.cutting_error_unit_not_supported', { unit: unitLabel.value })
  if (p.kind === 'insufficient')
    return t('warehouse.cutting_error_insufficient', {
      remaining: `${p.remaining} ${unitLabel.value}`,
      consumed: `${p.consumed} ${unitLabel.value}`,
    })
  if (p.kind === 'pieces_not_integer')
    return t('warehouse.cutting_error_pieces_not_integer', { row: p.row + 1 })
  if (p.kind === 'dimension_missing')
    return t('warehouse.cutting_error_dimension_missing', {
      row: p.row + 1,
      dimension: t(`warehouse.cutting_dim_${p.detail}`, p.detail),
    })
  return ''
})

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
      <p class="text-muted" style="margin-bottom: 12px">
        {{ t('warehouse.cutting_pick_batch_hint') }}
      </p>
      <div style="margin-bottom: 12px">
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
              <th style="width: 120px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="batches.length === 0 && !batchesLoading">
              <td colspan="4" style="text-align: center; opacity: 0.5; padding: 24px 0">
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
              <td>{{ tf(b.productName) }}</td>
              <td>{{ b.quantityRemaining }} {{ t(`warehouse.unit_${b.unit}`, b.unit) }}</td>
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
    </GlassPanel>

    <!-- ── Резка выбранной партии ───────────────────────────────────────────── -->
    <template v-else>
      <GlassPanel
        :title="t('warehouse.field_source_batch')"
        data-test="warehouse-cutting-source-panel"
      >
        <template #header>
          <span class="panel-title">{{ t('warehouse.field_source_batch') }}</span>
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            style="margin-left: auto"
            data-test="warehouse-cutting-change-batch"
            @click="backToPicker"
          >
            {{ t('warehouse.cutting_pick_batch_hint') }}
          </button>
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
                {{ tf(batch.productName) }}
              </div>
            </InputGroup>
          </div>
          <div class="entity-col-right">
            <InputGroup :label="t('warehouse.cutting_remaining')">
              <div class="glass-input readonly-value" data-test="warehouse-cutting-remaining">
                {{ batch.quantityRemaining }} {{ unitLabel }}
              </div>
            </InputGroup>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel
        :title="t('warehouse.field_offcuts')"
        style="margin-top: 16px"
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
                <th style="width: 100px">{{ t('warehouse.col_actions') }}</th>
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
                <td style="min-width: 140px">
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
                <td>
                  <input
                    v-model.number="row.weightKg"
                    type="number"
                    min="0"
                    step="0.01"
                    class="glass-input"
                    data-test="warehouse-cutting-row-weight"
                  />
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
                  <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    :disabled="rows.length === 1"
                    data-test="warehouse-cutting-row-remove"
                    @click="removeRow(index)"
                  >
                    {{ t('warehouse.cutting_btn_remove_row') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <button
          type="button"
          class="btn btn-secondary"
          style="margin-top: 12px"
          data-test="warehouse-cutting-add-row"
          @click="addRow"
        >
          <SvgIcon name="plus-add" :width="16" :height="16" />
          <span>{{ t('warehouse.btn_add_offcut') }}</span>
        </button>
      </GlassPanel>

      <div class="entity-card-grid" style="margin-top: 16px">
        <div class="entity-col-left">
          <GlassPanel data-test="warehouse-cutting-losses-panel">
            <!--
              Ширина реза показывается ТОЛЬКО у партии, которая меряется по длине.
              Не полем со нулём: видимое поле, которое молча ничего не делает, —
              это ровно тот `field_kerf`, что три года лежал переведённым и
              неподключённым.
            -->
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
            <p v-else class="text-muted" data-test="warehouse-cutting-kerf-absent">
              {{ t('warehouse.cutting_kerf_only_linear', { unit: unitLabel }) }}
            </p>

            <InputGroup :label="t('warehouse.cutting_field_waste', { unit: unitLabel })">
              <input
                v-model.number="form.wasteQuantity"
                type="number"
                min="0"
                step="0.01"
                class="glass-input"
                data-test="warehouse-cutting-waste"
              />
            </InputGroup>

            <InputGroup :label="t('warehouse.cutting_field_notes')">
              <AutoResizeTextarea v-model="form.notes" data-test="warehouse-cutting-notes" />
            </InputGroup>
          </GlassPanel>
        </div>

        <div class="entity-col-center">
          <GlassPanel
            :title="t('warehouse.cutting_summary_title')"
            data-test="warehouse-cutting-summary"
          >
            <!--
              Расход не вводится — он выводится. Два поля, которые обязаны совпадать,
              расходятся ровно тогда, когда их два.
            -->
            <dl v-if="consumption" class="cutting-summary">
              <div>
                <dt>{{ t('warehouse.cutting_summary_pieces') }}</dt>
                <dd data-test="warehouse-cutting-total-pieces">
                  {{ consumption.offcutTotal }} {{ unitLabel }}
                </dd>
              </div>
              <div>
                <dt>{{ t('warehouse.cutting_summary_cuts') }}</dt>
                <dd data-test="warehouse-cutting-cuts">{{ consumption.cuts }}</dd>
              </div>
              <div v-if="kerfApplies">
                <dt>{{ t('warehouse.cutting_summary_kerf') }}</dt>
                <dd data-test="warehouse-cutting-total-kerf">
                  {{ consumption.kerfTotal }} {{ unitLabel }}
                </dd>
              </div>
              <div>
                <dt>{{ t('warehouse.cutting_summary_waste') }}</dt>
                <dd data-test="warehouse-cutting-total-waste">
                  {{ consumption.waste }} {{ unitLabel }}
                </dd>
              </div>
              <div class="cutting-summary-total">
                <dt>{{ t('warehouse.cutting_summary_total') }}</dt>
                <dd data-test="warehouse-cutting-consumed">
                  {{ consumption.consumed }} {{ unitLabel }}
                </dd>
              </div>
              <div v-if="remainingAfter !== null">
                <dt>{{ t('warehouse.cutting_summary_remaining') }}</dt>
                <dd data-test="warehouse-cutting-remaining-after">
                  {{ remainingAfter }} {{ unitLabel }}
                </dd>
              </div>
            </dl>

            <p v-if="problemMessage" class="cutting-problem" data-test="warehouse-cutting-problem">
              {{ problemMessage }}
            </p>

            <button
              type="button"
              class="btn btn-primary"
              style="margin-top: 12px"
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

.cutting-summary dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.cutting-summary-total {
  padding-top: 8px;
  border-top: 1px solid var(--glass-border, rgba(255, 255, 255, 0.12));
  font-weight: 600;
}

.cutting-problem {
  margin-top: 12px;
  color: var(--danger, #e5484d);
}

.row-invalid td {
  background: rgba(229, 72, 77, 0.08);
}
</style>
