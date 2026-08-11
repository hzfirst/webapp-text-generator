'use client'

import React from 'react'
import type { RichAnswerData } from './rich-answer-utils'
import { Markdown } from '@/app/components/base/markdown'

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

type RichAnswerProps = {
  data: RichAnswerData
  compact?: boolean
  suggestionsDisabled?: boolean
  onSuggestedQuestion?: (question: string) => void
}

const RichAnswer = ({
  data,
  compact = false,
  suggestionsDisabled = false,
  onSuggestedQuestion,
}: RichAnswerProps) => {
  const images = (data.image_urls || []).filter(item => Boolean(safeUrl(item.url)))
  const videos = data.video_urls || []
  const suggestedQuestions = data.suggested_questions || []
  const answerSteps = extractNumberedSteps(data.answer)
  const canPairAnswerSteps = answerSteps.length === images.length

  return (
    <div className={compact ? 'space-y-5' : 'space-y-8'}>
      {data.answer && compact && (
        <div className='text-[15px] leading-7 text-slate-700'>
          <Markdown content={data.answer} />
        </div>
      )}

      {data.answer && !compact && (
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

      {suggestedQuestions.length > 0 && (
        <section>
          <div className='mb-2 text-xs font-medium text-slate-500'>请选择您想继续了解的内容</div>
          <div className='flex flex-col items-start gap-2'>
            {suggestedQuestions.map(question => (
              <button
                key={question}
                type='button'
                className='max-w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-sm leading-5 text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400'
                disabled={suggestionsDisabled || !onSuggestedQuestion}
                onClick={() => onSuggestedQuestion?.(question)}
              >
                {question}
              </button>
            ))}
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
