import type { FC } from 'react'
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import Uploader from './uploader'
import ImageLinkInput from './image-link-input'
import ImageList from './image-list'
import { useImageFiles } from './hooks'
import { getClipboardImageFile, readAndUploadImage } from './utils'
import ImagePlus from '@/app/components/base/icons/line/image-plus'
import Link03 from '@/app/components/base/icons/line/link-03'
import {
  PortalToFollowElem,
  PortalToFollowElemContent,
  PortalToFollowElemTrigger,
} from '@/app/components/base/portal-to-follow-elem'
import type { ImageFile, VisionSettings } from '@/types/app'
import { TransferMethod } from '@/types/app'
import Toast from '@/app/components/base/toast'

type PasteImageLinkButtonProps = {
  onUpload: (imageFile: ImageFile) => void
  disabled?: boolean
}
const PasteImageLinkButton: FC<PasteImageLinkButtonProps> = ({
  onUpload,
  disabled,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const handleUpload = (imageFile: ImageFile) => {
    setOpen(false)
    onUpload(imageFile)
  }

  const handleToggle = () => {
    if (disabled)
      return

    setOpen(v => !v)
  }

  return (
    <PortalToFollowElem
      open={open}
      onOpenChange={setOpen}
      placement='top-start'
    >
      <PortalToFollowElemTrigger onClick={handleToggle}>
        <div className={`
          relative flex items-center justify-center px-3 h-8 bg-gray-100 hover:bg-gray-200 text-xs text-gray-500 rounded-lg
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
        `}>
          <Link03 className='mr-2 w-4 h-4' />
          {t('common.imageUploader.pasteImageLink')}
        </div>
      </PortalToFollowElemTrigger>
      <PortalToFollowElemContent className='z-10'>
        <div className='p-2 w-[320px] bg-white border-[0.5px] border-gray-200 rounded-lg shadow-lg'>
          <ImageLinkInput onUpload={handleUpload} />
        </div>
      </PortalToFollowElemContent>
    </PortalToFollowElem>
  )
}

type TextGenerationImageUploaderProps = {
  settings: VisionSettings
  onFilesChange: (files: ImageFile[]) => void
}
const TextGenerationImageUploader: FC<TextGenerationImageUploaderProps> = ({
  settings,
  onFilesChange,
}) => {
  const { t } = useTranslation()
  const { notify } = Toast
  const onFilesChangeRef = useRef(onFilesChange)

  const {
    files,
    onUpload,
    onRemove,
    onImageLinkLoadError,
    onImageLinkLoadSuccess,
    onReUpload,
  } = useImageFiles()

  const canPasteImage = settings.transfer_methods.includes(TransferMethod.local_file)
  const uploadLimit = settings.image_file_size_limit ? +settings.image_file_size_limit : undefined

  const handlePaste = useCallback((event: ClipboardEvent) => {
    if (!canPasteImage || files.length >= settings.number_limits)
      return

    const file = getClipboardImageFile(event.clipboardData)
    if (!file)
      return

    event.preventDefault()
    readAndUploadImage({
      file,
      limit: uploadLimit,
      onUpload,
      onLimitError: () => notify({ type: 'error', message: t('common.imageUploader.uploadFromComputerLimit', { size: uploadLimit }) }),
      onReadError: () => notify({ type: 'error', message: t('common.imageUploader.uploadFromComputerReadError') }),
      onUploadError: () => notify({ type: 'error', message: t('common.imageUploader.uploadFromComputerUploadError') }),
    })
  }, [canPasteImage, files.length, notify, onUpload, settings.number_limits, t, uploadLimit])

  useEffect(() => {
    if (!canPasteImage)
      return

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [canPasteImage, handlePaste])

  useEffect(() => {
    onFilesChangeRef.current = onFilesChange
  }, [onFilesChange])

  useEffect(() => {
    onFilesChangeRef.current(files)
  }, [files])

  const localUpload = (
    <Uploader
      onUpload={onUpload}
      disabled={files.length >= settings.number_limits}
      limit={+settings.image_file_size_limit!}
    >
      {
        hovering => (
          <div className={`
            flex items-center justify-center px-3 h-8 bg-gray-100
            text-xs text-gray-500 rounded-lg cursor-pointer
            ${hovering && 'bg-gray-200'}
          `}>
            <ImagePlus className='mr-2 w-4 h-4' />
            {t('common.imageUploader.uploadFromComputer')}
          </div>
        )
      }
    </Uploader>
  )

  const urlUpload = (
    <PasteImageLinkButton
      onUpload={onUpload}
      disabled={files.length >= settings.number_limits}
    />
  )

  return (
    <div>
      <div className='mb-1'>
        <ImageList
          list={files}
          onRemove={onRemove}
          onReUpload={onReUpload}
          onImageLinkLoadError={onImageLinkLoadError}
          onImageLinkLoadSuccess={onImageLinkLoadSuccess}
        />
      </div>
      <div className={`grid gap-1 ${settings.transfer_methods.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {
          settings.transfer_methods.map((method) => {
            if (method === TransferMethod.local_file)
              return <Fragment key={TransferMethod.local_file}>{localUpload}</Fragment>

            if (method === TransferMethod.remote_url)
              return <Fragment key={TransferMethod.remote_url}>{urlUpload}</Fragment>

            return null
          })
        }
      </div>
      {canPasteImage && (
        <div className='mt-2 text-xs text-gray-400'>
          {t('common.imageUploader.pasteImageHint')}
        </div>
      )}
    </div>
  )
}

export default TextGenerationImageUploader
