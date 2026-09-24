// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

/**
 * contract-sync-config-bugs.md: БАГ-01, БАГ-06, БАГ-09, БАГ-10 (молчаливое удаление
 * отсутствующего) и БАГ-14. Каждая проверка ниже краснеет на откате своей правки —
 * см. комментарий у каждого блока.
 */

vi.mock('@/services/configService', () => ({
  getFieldLibrary: vi.fn(),
  getSections: vi.fn(),
  getPermissions: vi.fn(),
  saveFieldLibrary: vi.fn(),
  saveSections: vi.fn(),
  savePermissions: vi.fn(),
}))

import { translations } from '@/i18n/translations'
import { useToast } from '@/composables/useToast'
import { ApiRequestError } from '@/types/api'
import type { FieldDefinition, PermissionMatrix, SectionConfig } from '@/types/config'
import {
  mockDeleteField,
  mockDeleteSection,
  mockUpdateField,
  mockUpdateSection,
  mockCreateField,
  mockCreateSection,
  mockGetPermissions,
  mockSavePermissions,
} from './config'
import {
  getFieldLibrary,
  getSections,
  getPermissions,
  saveFieldLibrary,
  saveSections,
  savePermissions,
} from '@/services/configService'
import SupplierCardConfigPage from '@/views/admin/suppliers/SupplierCardConfigPage.vue'

const UNKNOWN = 'no-such-id-ever'

function assertRefusal(thrower: () => void, code: string, status: number): void {
  let caught: unknown
  try {
    thrower()
  } catch (e) {
    caught = e
  }
  expect(caught).toBeInstanceOf(ApiRequestError)
  const err = caught as ApiRequestError
  expect(err.code).toBe(code)
  expect(err.status).toBe(status)
}

// ─── БАГ-10 (часть про удаление отсутствующего) ───

describe('config mock — deleting an unknown id is refused, not silently ignored', () => {
  it('mockDeleteField answers the unknown id exactly like mockUpdateField does', () => {
    assertRefusal(() => mockDeleteField(UNKNOWN), 'FIELD_NOT_FOUND', 404)
    assertRefusal(() => mockUpdateField(UNKNOWN, { required: true }), 'FIELD_NOT_FOUND', 404)
  })

  it('mockDeleteSection answers the unknown id exactly like mockUpdateSection does', () => {
    assertRefusal(() => mockDeleteSection(UNKNOWN), 'SECTION_NOT_FOUND', 404)
    assertRefusal(() => mockUpdateSection(UNKNOWN, { collapsed: true }), 'SECTION_NOT_FOUND', 404)
  })
})

// ─── БАГ-06 ───

describe('config mock — mockSavePermissions actually saves the matrix', () => {
  let original: PermissionMatrix

  beforeEach(() => {
    original = mockGetPermissions()
  })

  afterEach(() => {
    // Restore, so this test doesn't leak state into the tests that run after it
    // in the same module instance.
    mockSavePermissions(original)
  })

  it('the next read returns exactly what was sent, and it is a copy of the store', () => {
    const sent: PermissionMatrix = {
      ...original,
      rolePermissions: {
        ...original.rolePermissions,
        'sec-general': {
          ...original.rolePermissions['sec-general'],
          Sales: { read: true, edit: true, create: false, delete: false },
        },
      },
    }
    mockSavePermissions(sent)

    // A `no-op in mock` body would leave the original Admin-only defaults in
    // place — this read would still show Sales with everything `false`.
    const readBack = mockGetPermissions()
    expect(readBack.rolePermissions['sec-general']?.Sales).toEqual({
      read: true,
      edit: true,
      create: false,
      delete: false,
    })

    // Mutating what mockGetPermissions handed back must not reach the store —
    // same isolation mockGetFieldLibrary/mockGetSections already give.
    readBack.rolePermissions['sec-general']!.Sales!.read = false
    const readAgain = mockGetPermissions()
    expect(readAgain.rolePermissions['sec-general']?.Sales?.read).toBe(true)
  })
})

// ─── БАГ-09 ───

describe('config mock — update merges into a local copy, never the caller’s patch object', () => {
  it('mockUpdateField leaves patch.name exactly as the caller sent it', () => {
    const patch: Partial<FieldDefinition> = { name: { ru: 'Новое', en: 'New', lt: 'Naujas' } }
    const sentName = { ...patch.name }
    mockUpdateField('f-company', patch)
    expect(patch.name).toEqual(sentName)
  })

  it('mockUpdateSection leaves patch.name exactly as the caller sent it', () => {
    const patch: Partial<SectionConfig> = { name: { ru: 'Новое', en: 'New', lt: 'Naujas' } }
    const sentName = { ...patch.name }
    mockUpdateSection('sec-general', patch)
    expect(patch.name).toEqual(sentName)
  })

  it('mockCreateField returns a copy — mutating the result does not touch the stored entry', () => {
    const created = mockCreateField({ name: { ru: 'X', en: 'X', lt: 'X' }, type: 'text' })
    created.required = true
    // Empty patch: mockUpdateField returns the stored entry untouched, still a copy.
    const stored = mockUpdateField(created.id, {})
    expect(stored.required).toBe(false)
  })

  it('mockCreateSection returns a copy — mutating the result does not touch the stored entry', () => {
    const created = mockCreateSection({ name: 'Y' })
    created.visible = false
    const stored = mockUpdateSection(created.id, {})
    expect(stored.visible).toBe(true)
  })
})

// ─── БАГ-14 ───

describe('config mock — new-entity ids come from a counter, not Date.now()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('two fields created back-to-back with a frozen clock get different ids', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const a = mockCreateField({ name: { ru: 'A', en: 'A', lt: 'A' }, type: 'text' })
    const b = mockCreateField({ name: { ru: 'B', en: 'B', lt: 'B' }, type: 'text' })
    expect(a.id).not.toBe(b.id)
    // Date.now() was frozen for both calls — if the id still used it, both would
    // contain the same frozen timestamp.
    expect(a.id).not.toContain('1700000000000')
    expect(b.id).not.toContain('1700000000000')
  })

  it('two sections created back-to-back with a frozen clock get different ids', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const a = mockCreateSection({ name: 'A' })
    const b = mockCreateSection({ name: 'B' })
    expect(a.id).not.toBe(b.id)
    expect(a.id).not.toContain('1700000000000')
    expect(b.id).not.toContain('1700000000000')
  })
})

// ─── БАГ-01 ───
//
// Component-level: `saveConfig()` in useCardConfig.ts must report success/failure,
// and SupplierCardConfigPage.vue's save() must show the right toast for each — not
// an unconditional "Configuration saved".

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: translations,
})

const toasts = useToast().toasts

function lastToast() {
  return toasts[toasts.length - 1]
}

const EMPTY_PERMISSIONS: PermissionMatrix = {
  roles: [],
  users: {},
  rolePermissions: {},
  userPermissions: {},
  items: [],
}

function mountPage() {
  return mount(SupplierCardConfigPage, {
    global: {
      plugins: [i18n],
      // Чужая вёрстка не проверяется — кнопка Save и тост лежат вне них.
      stubs: {
        GlassPanel: true,
        SvgIcon: true,
        ConfigSectionCard: true,
        FieldLibraryItem: true,
        AppModal: true,
        CustomSelect: true,
      },
    },
  })
}

describe('SupplierCardConfigPage — save toast reflects what saveConfig actually returned', () => {
  beforeEach(() => {
    toasts.splice(0, toasts.length)
    vi.mocked(getFieldLibrary).mockResolvedValue([])
    vi.mocked(getSections).mockResolvedValue([])
    vi.mocked(getPermissions).mockResolvedValue(structuredClone(EMPTY_PERMISSIONS))
    vi.mocked(saveFieldLibrary).mockResolvedValue(undefined)
    vi.mocked(saveSections).mockResolvedValue(undefined)
  })

  it('a failed PUT shows the failure toast — never "Configuration saved"', async () => {
    vi.mocked(savePermissions).mockRejectedValue(new Error('network down'))
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-test="supplier-card-config-save-btn"]').trigger('click')
    await flushPromises()

    expect(lastToast()?.message).toBe(i18n.global.t('notification.config_save_failed'))
    expect(lastToast()?.type).toBe('error')
    expect(toasts.some((t) => t.message === i18n.global.t('notification.config_saved'))).toBe(false)
  })

  it('a succeeding save shows "Configuration saved"', async () => {
    vi.mocked(savePermissions).mockResolvedValue(undefined)
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-test="supplier-card-config-save-btn"]').trigger('click')
    await flushPromises()

    expect(lastToast()?.message).toBe(i18n.global.t('notification.config_saved'))
    expect(lastToast()?.type).toBe('success')
  })
})
