# Фикс: Текст в модале удаления и тосте ошибки

## Проблема
1. Модал удаления клиента показывает `{{ t('clients.btn_delete') }}?` ("Delete?") — непонятно кого удаляем, нет предупреждения о заказах
2. Тост ошибки generic — не показывает причину (например, "есть активные заказы")

## Изменения

### 1. ClientsListPage.vue — модал удаления
Показывать имя клиента и предупреждение:
```vue
<AppModal v-model="showDeleteModal" :title="t('clients.btn_delete')" size="small" data-test="clients-delete-modal">
  <p>{{ t('clients.confirm_delete', { name: deletingClientName }) }}</p>
  <p class="text-warning">{{ t('clients.delete_warning_orders') }}</p>
  <template #footer>...</template>
</AppModal>
```

### 2. Composables/useClients.ts — обработка ошибки
Читать message из ошибки и показывать в тосте:
```ts
catch (e) {
  const msg = String(e)
  if (msg.includes('CONFLICT')) {
    toast.error(t('clients.toast_error_delete_conflict'))
  } else {
    toast.error(t('clients.toast_error_delete'))
  }
}
```

### 3. i18n — добавить ключи
- `confirm_delete` — "Are you sure you want to delete {name}?"
- `delete_warning_orders` — "This client has active orders and cannot be deleted."
- `toast_error_delete_conflict` — "Cannot delete: client has active orders"

### 4. ClientsListPage.vue — добавить deletingClientName
```ts
const deletingClientName = computed(() => {
  if (!deletingId.value) return ''
  const client = items.value.find(c => c.id === deletingId.value)
  return client?.name ?? ''
})
```
