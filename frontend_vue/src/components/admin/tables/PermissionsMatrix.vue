<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  roles: string[]
  permissions: Record<string, Record<string, boolean>>
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:permissions': [permissions: Record<string, Record<string, boolean>>]
}>()

function onCheck(action: string, role: string, checked: boolean) {
  const next: Record<string, Record<string, boolean>> = {}
  for (const a in props.permissions) {
    next[a] = { ...props.permissions[a] }
  }
  if (!next[action]) next[action] = {}
  next[action][role] = checked
  emit('update:permissions', next)
}
</script>

<template>
  <div class="permissions-matrix" :class="{ readonly }">
    <table class="permissions-table">
      <thead>
        <tr>
          <th class="permissions-header-action">{{ t('permissions.action') }}</th>
          <th v-for="role in roles" :key="role" class="permissions-header-role">
            {{ t(`role.${role}`, role) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(roleMap, action) in permissions"
          :key="action"
          class="permissions-row"
          :data-action="action"
        >
          <td class="permissions-action-name">{{ t(`permission.${action}`, String(action)) }}</td>
          <td v-for="role in roles" :key="role" class="permissions-cell">
            <label class="permissions-checkbox">
              <input
                type="checkbox"
                :data-action="action"
                :data-role="role"
                :checked="roleMap[role] ?? false"
                :disabled="readonly"
                @change="onCheck(String(action), role, ($event.target as HTMLInputElement).checked)"
              />
              <span class="checkbox-custom" />
            </label>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
