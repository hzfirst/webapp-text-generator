'use client'

import { upload } from '@/service/base'
import type { ImageFile } from '@/types/app'
import { TransferMethod } from '@/types/app'

export const getClipboardImageFile = (clipboardData: DataTransfer | null): File | undefined => {
  if (!clipboardData)
    return undefined

  const imageItem = Array.from(clipboardData.items).find(item => item.kind === 'file' && item.type.startsWith('image/'))
  const file = imageItem?.getAsFile() || Array.from(clipboardData.files).find(file => file.type.startsWith('image/'))
  if (!file)
    return undefined

  if (file.name.trim())
    return file

  const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
  return new File([file], `clipboard-image.${extension}`, {
    type: file.type || 'image/png',
    lastModified: file.lastModified,
  })
}

type ImageUploadParams = {
  file: File
  onProgressCallback: (progress: number) => void
  onSuccessCallback: (res: { id: string }) => void
  onErrorCallback: () => void
}
type ImageUpload = (v: ImageUploadParams) => void
export const imageUpload: ImageUpload = ({
  file,
  onProgressCallback,
  onSuccessCallback,
  onErrorCallback,
}) => {
  const formData = new FormData()
  formData.append('file', file)
  const onProgress = (e: ProgressEvent) => {
    if (e.lengthComputable) {
      // 100% means the server has returned a usable upload_file_id.
      const percent = Math.min(99, Math.floor(e.loaded / e.total * 100))
      onProgressCallback(percent)
    }
  }

  upload({
    xhr: new XMLHttpRequest(),
    data: formData,
    onprogress: onProgress,
  })
    .then((res: { id: string }) => {
      onSuccessCallback(res)
    })
    .catch(() => {
      onErrorCallback()
    })
}

type ReadAndUploadImageParams = {
  file: File
  limit?: number
  onUpload: (imageFile: ImageFile) => void
  onLimitError: () => void
  onReadError: () => void
  onUploadError: () => void
}

export const readAndUploadImage = ({
  file,
  limit,
  onUpload,
  onLimitError,
  onReadError,
  onUploadError,
}: ReadAndUploadImageParams) => {
  if (limit && file.size > limit * 1024 * 1024) {
    onLimitError()
    return
  }

  const reader = new FileReader()
  reader.addEventListener('load', () => {
    const imageFile: ImageFile = {
      type: TransferMethod.local_file,
      _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileId: '',
      file,
      url: reader.result as string,
      base64Url: reader.result as string,
      progress: 0,
    }
    onUpload(imageFile)
    imageUpload({
      file,
      onProgressCallback: progress => onUpload({ ...imageFile, progress }),
      onSuccessCallback: res => onUpload({ ...imageFile, fileId: res.id, progress: 100 }),
      onErrorCallback: () => {
        onUploadError()
        onUpload({ ...imageFile, progress: -1 })
      },
    })
  }, false)
  reader.addEventListener('error', onReadError, false)
  reader.readAsDataURL(file)
}
