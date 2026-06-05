# План: добавить auditLog для клиентов

## Контекст

В мок-данных клиентов полностью отсутствует "История изменений" — нет ни поля в типе, ни мок-данных, ни API, ни UI-секции. Пользователь хочет полноценную реализацию: тип + мок-данные + API + сервис + UI.

## Требуемые изменения

### 1. Тип `types/client.ts` — добавить поле `auditLog`

Импортировать `StockAuditEntry` из `@/types/warehouse` и добавить в `Client`:

```ts
import type { StockAuditEntry } from '@/types/warehouse'

export interface Client {
  id: string
  name: string
  companyCode: string
  vatCode: string
  address: string
  phone: string
  email: string
  status: 'active' | 'inactive'
  notes: string | null
  createdAt: string
  /** Client change audit log */
  auditLog?: StockAuditEntry[]
}
```

### 2. Мок-данные `services/mocks/clients.ts` — добавить `auditLog`

Добавить `auditLog` для 10 клиентов с реалистичными записями:

| Client ID | Название | Записей | События |
|---|---|---|---|
| CL-001 | UAB Metalica | 3 | Создание → Статус (new→active) → Контакт (телефон) |
| CL-002 | SIA SteelWorks | 2 | Создание → Статус (new→active) |
| CL-003 | MB Statyba | 1 | Только создание |
| CL-005 | UAB Plieno Centras | 2 | Создание → Примечания |
| CL-008 | SIA Būvmateriāli | 2 | Создание → Статус (new→active) |
| CL-011 | AB Plieno Gamyba | 3 | Создание → Статус → Email |
| CL-013 | VŠĮ Statybos Centras | 2 | Создание → Статус (active→inactive) |
| CL-022 | UAB Energetikos Sistema | 2 | Создание → Примечания |
| CL-031 | SIA Latvijas Metāls | 2 | Создание → Статус |
| CL-050 | Sp. z o.o. PolStal | 1 | Только создание |

Формат записи auditLog (переиспользуем `StockAuditEntry`):
```ts
{
  timestamp: string
  user: { ru: string; en: string; lt: string }
  userInitials: string
  property: { ru: string; en: string; lt: string }
  oldValue: string
  newValue: string
}
```

Пользователи (как в products.ts):
- Иван Н. / Ivan N. / IN
- Елена К. / Elena K. / EK
- Максим В. / Maxim V. / MV
- Алекс З. / Alex Z. / AZ
- Ольга П. / Olga P. / OP
- Система / System / SY

Типовые properties для клиентов:
- Статус / Status / Būsena
- Контактное лицо / Contact person / Kontaktinis asmuo
- Телефон / Phone / Telefonas
- Email / Email / El. paštas
- Адрес / Address / Adresas
- Примечания / Notes / Pastabos
- Клиент создан / Client created / Klientas sukurtas

### 3. Функции моков `services/mocks/clients.ts`

Добавить функции:
- `mockGetClientAudit(clientId: string): StockAuditEntry[]` — возвращает auditLog из STORE
- Обновить `mockGetClient` — возвращать `structuredClone` включающий `auditLog`
- Обновить `mockCreateClient` — добавить `auditLog: []`
- Обновить `mockPatchClient` — (опционально) добавлять запись в auditLog при изменении

### 4. Мок-эндпоинт `services/mocks/index.ts`

Добавить обработку GET `/api/clients/{id}/audit`:

```ts
const clientAuditMatch = path.match(/^\/api\/clients\/([^/]+)\/audit$/)
if (clientAuditMatch) {
  return delay(mockGetClientAudit(clientAuditMatch[1] as string) as T)
}
```

### 5. Сервис `services/clientService.ts` — добавить функцию

```ts
export async function getClientAudit(clientId: string): Promise<StockAuditEntry[]> {
  return apiGet<StockAuditEntry[]>(`/api/clients/${clientId}/audit`)
}

export async function deleteClientAuditEntry(clientId: string, entryIndex: number): Promise<void> {
  return apiDelete<void>(`/api/clients/${clientId}/audit/${entryIndex}`)
}
```

### 6. Композабл `composables/useClientCard.ts`

Добавить:
- `auditLog` — reactive ref
- `auditLoading` — reactive ref
- `loadAudit(id)` — функция загрузки

### 7. UI `ClientCardPage.vue` — добавить секцию аудита

Добавить **после** `.entity-card-grid` (после строки 207) — полноширинную секцию:

```vue
<!-- Audit section -->
<div class="audit-panel" data-test="client-card-audit">
  <GlassPanel :title="t('clients.section_audit')">
    <div v-if="auditLoading" class="text-muted" style="padding: 12px 0;">
      {{ t('clients.loading') }}...
    </div>
    <div v-else class="table-responsive">
      <table class="audit-log-table" data-test="client-card-audit-table">
        <thead>
          <tr>
            <th>{{ t('clients.audit_col_date') }}</th>
            <th>{{ t('clients.audit_col_user') }}</th>
            <th>{{ t('clients.audit_col_property') }}</th>
            <th>{{ t('clients.audit_col_old_value') }}</th>
            <th>{{ t('clients.audit_col_new_value') }}</th>
            <th style="width: 40px" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(a, i) in auditLog" :key="i" data-test="client-card-audit-row">
            <td class="audit-log-ts">{{ a.timestamp }}</td>
            <td>{{ a.user.ru || a.user.en }}</td>
            <td>{{ a.property.ru || a.property.en }}</td>
            <td>{{ a.oldValue }}</td>
            <td>{{ a.newValue }}</td>
            <td>
              <button
                class="btn-icon btn-icon-danger"
                :data-test="'delete-audit-' + i"
                @click="deleteAuditEntry(i)"
              >
                ×
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!auditLoading && auditLog && auditLog.length === 0" class="text-muted" style="padding: 12px 0;">
      {{ t('clients.no_audit_entries') }}
    </p>
  </GlassPanel>
</div>
```

### 8. i18n `i18n/admin/clients.ts`

Добавить переводы:
```ts
section_audit: 'История изменений',
audit_col_date: 'Дата',
audit_col_user: 'Пользователь',
audit_col_property: 'Свойство',
audit_col_old_value: 'Старое значение',
audit_col_new_value: 'Новое значение',
no_audit_entries: 'Нет записей истории изменений',
loading: 'Загрузка...',
```

Для en и lt аналогично.

### 9. CSS `styles/admin/client_card.css`

Добавить стили для `.audit-panel` и `.audit-log-table` (по аналогии с warehouse).

## Порядок выполнения

1. Тип: `types/client.ts` — импорт + поле auditLog
2. Мок-данные: `services/mocks/clients.ts` — добавить auditLog для 10 клиентов + функции
3. Мок-эндпоинт: `services/mocks/index.ts` — роут `/api/clients/{id}/audit`
4. Сервис: `services/clientService.ts` — getClientAudit, deleteClientAuditEntry
5. Композабл: `composables/useClientCard.ts` — auditLog, auditLoading, loadAudit
6. UI: `views/admin/clients/ClientCardPage.vue` — секция аудита
7. i18n: `i18n/admin/clients.ts` — переводы
8. CSS: `styles/admin/client_card.css` — стили для таблицы аудита
