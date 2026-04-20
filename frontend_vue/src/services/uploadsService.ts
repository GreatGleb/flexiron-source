import { apiUpload } from './api'

export interface UploadedFile {
  fileId: string
  name: string
  size: number
  mime: string
  url: string
  uploadedAt: string
}

/** Generic file upload. Returns { fileId, ... } — attach to entity via save PATCH with fileIds[]. */
export async function uploadFile(file: File): Promise<UploadedFile> {
  return apiUpload<UploadedFile>('/api/uploads', file)
}
