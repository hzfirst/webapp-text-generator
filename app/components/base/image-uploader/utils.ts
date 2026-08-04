'use client'

import { upload } from '@/service/base'

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
