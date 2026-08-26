import { describe, it, expect, beforeEach } from 'vitest'
import {
  mockGetWarehouseMap,
  mockSaveWarehouseMap,
  mockDeleteWarehouseMap,
  mockGetSettings,
} from './settings'
import type { WarehouseMapFile } from '@/types/settings'

/**
 * Карта склада живёт в одном месте.
 *
 * Второй реестр той же сущности — это болезнь, которую в этом проекте уже видели
 * на оплатах: две страницы показывали разные числа про одни и те же деньги. Поэтому
 * карта хранится в настройках и больше нигде, и эти тесты проверяют именно это —
 * что прочитанное через настройки и прочитанное точечно всегда одно и то же.
 */

function mapFile(over: Partial<WarehouseMapFile> = {}): WarehouseMapFile {
  return {
    fileId: 'file-1',
    name: 'warehouse-plan.png',
    mime: 'image/png',
    size: 2048,
    url: 'data:image/png;base64,AAAA',
    uploadedAt: '2026-08-17T10:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  mockDeleteWarehouseMap()
})

describe('warehouse map storage', () => {
  it('has no map until one is uploaded', () => {
    expect(mockGetWarehouseMap()).toBeNull()
    expect(mockGetSettings().warehouseMap).toBeNull()
  })

  it('keeps the uploaded map and returns it', () => {
    const saved = mockSaveWarehouseMap(mapFile())

    expect(saved.fileId).toBe('file-1')
    expect(mockGetWarehouseMap()?.url).toBe('data:image/png;base64,AAAA')
  })

  it('replaces the current map instead of keeping a history', () => {
    mockSaveWarehouseMap(mapFile())
    mockSaveWarehouseMap(mapFile({ fileId: 'file-2', url: 'data:image/png;base64,BBBB' }))

    const current = mockGetWarehouseMap()
    expect(current?.fileId).toBe('file-2')
    expect(current?.url).toBe('data:image/png;base64,BBBB')
  })

  it('removes the map on delete', () => {
    mockSaveWarehouseMap(mapFile())
    mockDeleteWarehouseMap()

    expect(mockGetWarehouseMap()).toBeNull()
    expect(mockGetSettings().warehouseMap).toBeNull()
  })

  it('is read from settings and from its own endpoint as one and the same', () => {
    mockSaveWarehouseMap(mapFile({ fileId: 'file-3' }))

    expect(mockGetSettings().warehouseMap).toEqual(mockGetWarehouseMap())
  })

  it('refuses a file that is not an image', () => {
    expect(() => mockSaveWarehouseMap(mapFile({ mime: 'application/pdf' }))).toThrow(
      'MAP_NOT_AN_IMAGE',
    )
    expect(mockGetWarehouseMap()).toBeNull()
  })

  it('hands out a copy, not the stored object', () => {
    mockSaveWarehouseMap(mapFile())

    const read = mockGetWarehouseMap()!
    read.url = 'data:image/png;base64,TAMPERED'

    expect(mockGetWarehouseMap()?.url).toBe('data:image/png;base64,AAAA')
  })
})
