'use client'

import type { ImgHTMLAttributes } from 'react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import cn from 'classnames'
import {
  MagnifyingGlassPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

type ZoomableImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string
  wrapperClassName?: string
}

const ZoomableImage = ({
  src,
  alt = '',
  className,
  wrapperClassName,
  loading = 'lazy',
  ...imageProps
}: ZoomableImageProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const closePreview = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (!isOpen)
      return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        closePreview()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closePreview, isOpen])

  const preview = (isOpen && typeof document !== 'undefined')
    ? createPortal(
      <div
        role='dialog'
        aria-modal='true'
        aria-label='图片预览'
        className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 p-3 sm:p-6'
        onMouseDown={(event) => {
          if (event.target === event.currentTarget)
            closePreview()
        }}
      >
        <div className='absolute right-3 top-3 z-10 sm:right-5 sm:top-5'>
          <button
            ref={closeButtonRef}
            type='button'
            title='关闭图片预览'
            aria-label='关闭图片预览'
            className='flex h-10 w-10 items-center justify-center rounded-md border border-white/20 bg-black/60 text-white shadow-sm transition-colors hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white'
            onClick={closePreview}
          >
            <XMarkIcon className='h-6 w-6' aria-hidden='true' />
          </button>
        </div>

        <img
          src={src}
          alt={alt}
          className='max-h-[calc(100vh-1.5rem)] max-w-[calc(100vw-1.5rem)] select-none object-contain sm:max-h-[calc(100vh-3rem)] sm:max-w-[calc(100vw-3rem)]'
        />
      </div>,
      document.body,
    )
    : null

  return (
    <div className={cn('group relative', wrapperClassName)}>
      <button
        type='button'
        title='放大查看图片'
        aria-label={alt ? `放大查看图片：${alt}` : '放大查看图片'}
        className='block h-full w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        onClick={() => setIsOpen(true)}
      >
        <img
          {...imageProps}
          src={src}
          alt={alt}
          loading={loading}
          className={className}
        />
      </button>

      <div className='absolute right-2 top-2 flex items-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'>
        <button
          type='button'
          title='放大查看图片'
          aria-label='放大查看图片'
          className='flex h-8 w-8 items-center justify-center rounded-md bg-slate-900/70 text-white shadow-sm transition-colors hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-white'
          onClick={() => setIsOpen(true)}
        >
          <MagnifyingGlassPlusIcon className='h-4 w-4' aria-hidden='true' />
        </button>
      </div>

      {preview}
    </div>
  )
}

export default React.memo(ZoomableImage)
