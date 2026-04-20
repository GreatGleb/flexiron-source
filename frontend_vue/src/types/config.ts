export type FieldType = 'enum' | 'number' | 'text' | 'date' | 'boolean' | 'tags'

export interface FieldDefinition {
  id: string
  name: string
  type: FieldType
  required: boolean
  usageCount: number
  /** Hidden from the supplier card rendering (library-level hide). */
  hidden?: boolean
  options?: string[]
}

export interface SectionConfig {
  id: string
  name: string
  order: number
  /** UI-only: collapsed inside the config builder (not persisted to the rendered supplier card). */
  collapsed: boolean
  /** Whether the section is rendered in the actual supplier card. Default true. */
  visible: boolean
  /** System sections cannot be deleted (the delete button shows tooltip btn.system_section). */
  system?: boolean
  fields: SectionField[]
}

export interface SectionField {
  fieldId: string
  order: number
  visible: boolean
}

export type PermissionAction = 'read' | 'edit' | 'create' | 'delete'

export interface PermissionMatrix {
  roles: string[]
  /** users per role: { Admin: [...emails], Sales: [...] } */
  users: Record<string, string[]>
  /**
   * Role-level permissions per item per action.
   * { itemId: { role: { read: bool, edit: bool, create: bool, delete: bool } } }
   */
  rolePermissions: Record<string, Record<string, Record<PermissionAction, boolean>>>
  /**
   * User-level permission overrides. Only actions that differ from the role are
   * stored; missing actions fall back to the role-level value.
   * { itemId: { role: { userEmail: { action?: bool } } } }
   */
  userPermissions: Record<
    string,
    Record<string, Record<string, Partial<Record<PermissionAction, boolean>>>>
  >
  /** Items registered in matrix — sections + their fields in render order */
  items: PermissionItem[]
}

export interface PermissionItem {
  itemId: string
  name: string
  type: 'section' | 'field'
  /** For field items — parent section id */
  parentId?: string
}
