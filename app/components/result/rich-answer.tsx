'use client'

import React from 'react'
import { Markdown } from '@/app/components/base/markdown'

export type MediaItem = {
  source_id?: string
  title?: string
  url?: string
  poster_url?: string
  description?: string
  step?: string
  step_number?: string | number
  instruction?: string
}

export type RichAnswerData = {
  status?: string
  answer?: string
  image_urls?: MediaItem[]
  video_urls?: MediaItem[]
}

/**
 * 兼容：
 * 1. 直接返回对象
 * 2. 返回 JSON 字符串
 * 3. 包在 result 字段中
 * 4. 包在 structured_output 字段中
 */
export function parseRichAnswer(value: unknown): RichAnswerData | null {
  if (!value)
    return null

  if (typeof value === 'string') {
    const text = value.trim()
    if (!text.startsWith('{'))
      return null

    try {
      return parseRichAnswer(JSON.parse(text))
    }
    catch {
      return null
    }
  }

  if (typeof value !== 'object' || Array.isArray(value))
    return null

  const data = value as Record<string, unknown>
  if (data.result)
    return parseRichAnswer(data.result)
  if (data.structured_output)
    return parseRichAnswer(data.structured_output)

  const hasRichContent = typeof data.answer === 'string'
    || Array.isArray(data.image_urls)
    || Array.isArray(data.video_urls)

  if (!hasRichContent)
    return null

  return {
    status: typeof data.status === 'string' ? data.status : '',
    answer: typeof data.answer === 'string' ? data.answer : '',
    image_urls: Array.isArray(data.image_urls) ? data.image_urls as MediaItem[] : [],
    video_urls: Array.isArray(data.video_urls) ? data.video_urls as MediaItem[] : [],
  }
}

function safeUrl(value?: string): string {
  if (!value)
    return ''

  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return ''
    return url.toString()
  }
  catch {
    return ''
  }
}

function extractNumberedSteps(answer?: string): string[] {
  if (!answer)
    return []

  return answer
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .map((line) => {
      const match = line.match(/^(?:[-*]\s*)?(?:步骤|step)?\s*[（(]?(\d+)[）).、:：-]\s*(.+)$/i)
      return match?.[2]?.trim() || ''
    })
    .filter(Boolean)
}

const RichAnswer = ({ data }: { data: RichAnswerData }) => {
  const images = (data.image_urls || []).filter(item => Boolean(safeUrl(item.url)))
  const videos = data.video_urls || []
  const answerSteps = extractNumberedSteps(data.answer)
  const canPairAnswerSteps = answerSteps.length === images.length

  return (
    <div className='space-y-8'>
      {data.answer && (
        <section>
          <div className='mb-3 flex items-center gap-2'>
            <span className='h-5 w-1 rounded-full bg-blue-600' />
            <h2 className='text-base font-semibold text-slate-900'>操作说明</h2>
          </div>

          <div className='rounded-lg border border-slate-100 bg-slate-50 px-5 py-4 text-[15px] leading-7 text-slate-700'>
            <Markdown content={data.answer} />
          </div>
        </section>
      )}

      {images.length > 0 && (
        <section>
          <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
            <div className='flex items-center gap-2'>
              <span className='h-5 w-1 rounded-full bg-blue-600' />
              <h2 className='text-base font-semibold text-slate-900'>图示操作步骤</h2>
            </div>
            <div className='shrink-0 text-xs text-slate-500'>共 {images.length} 个步骤</div>
          </div>

          <div className='space-y-6'>
            {images.map((item, index) => {
              const imageUrl = safeUrl(item.url)
              const configuredStepNumber = `${item.step_number || ''}`.trim()
              const stepNumber = /^\d{1,2}$/.test(configuredStepNumber)
                ? configuredStepNumber
                : `${index + 1}`
              const stepTitle = item.title || `操作步骤 ${stepNumber}`
              const stepInstruction = item.description
                || item.instruction
                || item.step
                || (canPairAnswerSteps ? answerSteps[index] : '')
                || '请结合上方操作说明，按照图示完成此步骤。'

              return (
                <figure
                  key={`${item.source_id || 'image'}-${index}`}
                  className='overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm'
                >
                  <figcaption className='flex items-start gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-4'>
                    <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white'>
                      {stepNumber}
                    </div>
                    <div className='min-w-0 pt-0.5'>
                      <h3 className='break-words text-sm font-semibold text-slate-900'>{stepTitle}</h3>
                      <p className='mt-1 break-words text-sm leading-6 text-slate-600'>{stepInstruction}</p>
                    </div>
                  </figcaption>

                  <a className='block bg-slate-50' href={imageUrl} target='_blank' rel='noreferrer'>
                    <img
                      src={imageUrl}
                      alt={item.description || stepTitle}
                      loading='lazy'
                      className='max-h-[620px] w-full object-contain'
                    />
                  </a>
                </figure>
              )
            })}
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section>
          <div className='mb-4 flex items-center gap-2'>
            <span className='h-5 w-1 rounded-full bg-blue-600' />
            <h2 className='text-base font-semibold text-slate-900'>操作视频</h2>
          </div>

          <div className='space-y-5'>
            {videos.map((item, index) => {
              const videoUrl = safeUrl(item.url)
              const posterUrl = safeUrl(item.poster_url)
              if (!videoUrl)
                return null

              return (
                <article
                  key={`${item.source_id || 'video'}-${index}`}
                  className='overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm'
                >
                  <video
                    controls
                    playsInline
                    preload='metadata'
                    poster={posterUrl || undefined}
                    className='aspect-video w-full bg-black object-contain'
                  >
                    <source src={videoUrl} />
                    当前浏览器不支持视频播放。
                  </video>

                  <div className='flex items-start justify-between gap-4 px-5 py-4'>
                    <div className='min-w-0'>
                      <h3 className='break-words text-sm font-semibold text-slate-900'>
                        {item.title || `操作视频${index + 1}`}
                      </h3>
                      {item.description && (
                        <p className='mt-1 break-words text-xs leading-5 text-slate-500'>{item.description}</p>
                      )}
                    </div>

                    <a
                      href={videoUrl}
                      target='_blank'
                      rel='noreferrer'
                      className='shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700'
                    >
                      单独打开
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {data.status === 'unmatched'
        && !data.answer
        && images.length === 0
        && videos.length === 0 && (
        <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800'>
          暂未找到匹配的操作内容，建议联系人工支持。
        </div>
      )}
    </div>
  )
}

export default React.memo(RichAnswer)
