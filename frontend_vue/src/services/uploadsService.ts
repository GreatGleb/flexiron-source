import { apiUpload } from './api'

export interface UploadedFile {
  fileId: string
  name: string
  size: number
  mime: string
  url: string
  uploadedAt: string
}

/**
 * Generic file upload. Returns { fileId, ... } — attach to entity via save PATCH with fileIds[].
 *
 * Заголовки авторизации ставит `api.ts` — своя копия чтения токена здесь читала только
 * `localStorage` и потому давала 401 всем, кто вошёл без «запомнить меня».
 */
export async function uploadFile(file: File): Promise<UploadedFile> {
  return apiUpload<UploadedFile>('/api/uploads', file)
}
