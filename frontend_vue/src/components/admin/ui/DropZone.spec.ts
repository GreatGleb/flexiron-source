// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import DropZone from './DropZone.vue'
import { uploadFile } from '@/services/uploadsService'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { dropzone: { uploading: 'Uploading...' } } },
})

/**
 * П50 (roo_code/roo-context/api/00-conventions.md §16): тот же файл, поданный в форму дважды,
 * второй раз в отправку не идёт. Сравнивается только то, что даёт `File` — имя, размер,
 * lastModified. Память живёт в экземпляре компонента (одна форма, один сеанс), поэтому каждый
 * тест монтирует DropZone заново.
 */
vi.mock('@/services/uploadsService', () => ({
  uploadFile: vi.fn(),
}))

const mockedUploadFile = vi.mocked(uploadFile)

function makeFile(name: string, size: number, lastModified: number): File {
  return new File([new Uint8Array(size)], name, { lastModified })
}

function uploadedResultFor(file: File) {
  return {
    fileId: `id-${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    mime: 'application/octet-stream',
    url: `https://example.test/${file.name}`,
    uploadedAt: new Date().toISOString(),
  }
}

describe('DropZone', () => {
  beforeEach(() => {
    mockedUploadFile.mockReset()
    mockedUploadFile.mockImplementation((f: File) => Promise.resolve(uploadedResultFor(f)))
  })

  it('тот же файл (имя, размер, дата изменения), поданный дважды, уходит на сервер один раз', async () => {
    const wrapper = mount(DropZone, { props: { hint: 'test' }, global: { plugins: [i18n] } })
    const zone = wrapper.find('.dropzone')
    const file = makeFile('report.pdf', 1024, 1_700_000_000_000)

    await zone.trigger('drop', { dataTransfer: { files: [file] } })
    await flushPromises()
    await zone.trigger('drop', { dataTransfer: { files: [file] } })
    await flushPromises()

    expect(mockedUploadFile).toHaveBeenCalledTimes(1)
    const uploadedEvents = wrapper.emitted('uploaded')
    expect(uploadedEvents).toHaveLength(1)
    expect(uploadedEvents![0]![0]).toHaveLength(1)
  })

  it('два разных файла с одинаковым именем, но разным размером — оба уходят', async () => {
    const wrapper = mount(DropZone, { props: { hint: 'test' }, global: { plugins: [i18n] } })
    const zone = wrapper.find('.dropzone')
    const smaller = makeFile('report.pdf', 1024, 1_700_000_000_000)
    const larger = makeFile('report.pdf', 2048, 1_700_000_000_000)

    await zone.trigger('drop', { dataTransfer: { files: [smaller] } })
    await flushPromises()
    await zone.trigger('drop', { dataTransfer: { files: [larger] } })
    await flushPromises()

    expect(mockedUploadFile).toHaveBeenCalledTimes(2)
    const uploadedEvents = wrapper.emitted('uploaded')
    expect(uploadedEvents).toHaveLength(2)
  })

  it('если после отсева повтора не осталось файлов — сервер не вызывается и uploading не поднимается', async () => {
    const wrapper = mount(DropZone, { props: { hint: 'test' }, global: { plugins: [i18n] } })
    const zone = wrapper.find('.dropzone')
    const file = makeFile('report.pdf', 1024, 1_700_000_000_000)

    await zone.trigger('drop', { dataTransfer: { files: [file] } })
    await flushPromises()
    mockedUploadFile.mockClear()

    await zone.trigger('drop', { dataTransfer: { files: [file] } })
    await flushPromises()

    expect(mockedUploadFile).not.toHaveBeenCalled()
    expect(wrapper.emitted('files')).toHaveLength(1)
    expect(wrapper.find('.dropzone-uploading').exists()).toBe(false)
  })
})
