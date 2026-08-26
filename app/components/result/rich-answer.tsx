'use client'

import React from 'react'
import type { MediaItem, RichAnswerData } from './rich-answer-utils'
import { getMultiCategoryAnswer } from './rich-answer-utils'
import { Markdown } from '@/app/components/base/markdown'
import ZoomableImage from '@/app/components/base/zoomable-image'

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

function getCategoryDisplayName(category: string): string {
  return category.replace(/明细$/, '').trim() || category
}

function getSectionOrdinal(index: number): string {
  const ordinals = ['第一部分', '第二部分', '第三部分', '第四部分', '第五部分', '第六部分', '第七部分', '第八部分', '第九部分', '第十部分']
  return ordinals[index] || `第 ${index + 1} 部分`
}

type ImageStepsProps = {
  items: MediaItem[]
  answer?: string
  title?: string
  headingLevel?: 2 | 3
}

const ImageSteps = ({
  items,
  answer,
  title = '图示操作步骤',
  headingLevel = 3,
}: ImageStepsProps) => {
  const images = items.filter(item => Boolean(safeUrl(item.url)))
  const answerSteps = extractNumberedSteps(answer)
  const canPairAnswerSteps = answerSteps.length === images.length
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const StepHeading = headingLevel === 2 ? 'h3' : 'h4'

  if (images.length === 0)
    return null

  return (
    <section>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='h-5 w-1 shrink-0 rounded-full bg-blue-600' />
          <Heading className='break-words text-sm font-semibold text-slate-900'>{title}</Heading>
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
                  <StepHeading className='break-words text-sm font-semibold text-slate-900'>{stepTitle}</StepHeading>
                  <p className='mt-1 break-words text-sm leading-6 text-slate-600'>{stepInstruction}</p>
                </div>
              </figcaption>

              <ZoomableImage
                src={imageUrl}
                alt={item.description || stepTitle}
                wrapperClassName='bg-slate-50'
                className='max-h-[620px] w-full object-contain'
              />
            </figure>
          )
        })}
      </div>
    </section>
  )
}

type VideoListProps = {
  items: MediaItem[]
  title?: string
  headingLevel?: 2 | 3
}

const VideoList = ({
  items,
  title = '操作视频',
  headingLevel = 3,
}: VideoListProps) => {
  const videos = items.filter(item => Boolean(safeUrl(item.url)))
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const VideoHeading = headingLevel === 2 ? 'h3' : 'h4'

  if (videos.length === 0)
    return null

  return (
    <section>
      <div className='mb-4 flex items-center gap-2'>
        <span className='h-5 w-1 shrink-0 rounded-full bg-blue-600' />
        <Heading className='break-words text-sm font-semibold text-slate-900'>{title}</Heading>
      </div>

      <div className='space-y-5'>
        {videos.map((item, index) => {
          const videoUrl = safeUrl(item.url)
          const posterUrl = safeUrl(item.poster_url)

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
                  <VideoHeading className='break-words text-sm font-semibold text-slate-900'>
                    {item.title || `操作视频${index + 1}`}
                  </VideoHeading>
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
  )
}

type SuggestedQuestionsProps = {
  questions: string[]
  disabled: boolean
  onSelect?: (question: string) => void
}

const SuggestedQuestions = ({
  questions,
  disabled,
  onSelect,
}: SuggestedQuestionsProps) => {
  if (questions.length === 0)
    return null

  return (
    <section>
      <div className='mb-2 text-xs font-medium text-slate-500'>请选择您想继续了解的内容</div>
      <div className='flex flex-col items-start gap-2'>
        {questions.map(question => (
          <button
            key={question}
            type='button'
            className='max-w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-sm leading-5 text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400'
            disabled={disabled || !onSelect}
            onClick={() => onSelect?.(question)}
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  )
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
  const videos = (data.video_urls || []).filter(item => Boolean(safeUrl(item.url)))
  const suggestedQuestions = data.suggested_questions || []
  const multiCategoryAnswer = getMultiCategoryAnswer(data)

  return (
    <div className={compact ? 'space-y-5' : 'space-y-8'}>
      {multiCategoryAnswer
        ? (
          <>
            {multiCategoryAnswer.intro && (
              <div className='text-[15px] leading-7 text-slate-700'>
                <Markdown content={multiCategoryAnswer.intro} />
              </div>
            )}

            <div className={compact ? 'space-y-7' : 'space-y-10'}>
              {multiCategoryAnswer.sections.map((section, index) => {
                const displayCategory = getCategoryDisplayName(section.category)
                const hasSectionContent = Boolean(
                  section.answer
                  || section.image_urls.length
                  || section.video_urls.length,
                )

                return (
                  <section
                    key={section.category}
                    className={index > 0 ? 'border-t border-slate-200 pt-7' : ''}
                  >
                    <header className='mb-5'>
                      <div className='text-xs font-semibold text-blue-600'>{getSectionOrdinal(index)}</div>
                      <h2 className='mt-1 break-words text-base font-semibold text-slate-900'>{displayCategory}</h2>
                    </header>

                    <div className={compact ? 'space-y-6' : 'space-y-8'}>
                      {section.answer && (
                        <section>
                          <h3 className='mb-2 text-sm font-semibold text-slate-900'>具体要怎么做</h3>
                          <div className={compact
                            ? 'text-[15px] leading-7 text-slate-700'
                            : 'rounded-lg border border-slate-100 bg-slate-50 px-5 py-4 text-[15px] leading-7 text-slate-700'}
                          >
                            <Markdown content={section.answer} />
                          </div>
                        </section>
                      )}

                      <ImageSteps
                        items={section.image_urls}
                        answer={section.answer}
                        title={`${displayCategory}对应的操作步骤`}
                      />

                      <VideoList
                        items={section.video_urls}
                        title={`${displayCategory}对应的操作视频`}
                      />

                      {!hasSectionContent && (
                        <p className='text-sm leading-6 text-slate-500'>该问题暂未召回可展示的操作资料。</p>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>

            <ImageSteps items={multiCategoryAnswer.unassigned_image_urls} title='补充图示' headingLevel={2} />
            <VideoList items={multiCategoryAnswer.unassigned_video_urls} title='补充操作视频' headingLevel={2} />
          </>
        )
        : (
          <>
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

            <SuggestedQuestions
              questions={suggestedQuestions}
              disabled={suggestionsDisabled}
              onSelect={onSuggestedQuestion}
            />
            <ImageSteps items={images} answer={data.answer} headingLevel={2} />
            <VideoList items={videos} headingLevel={2} />
          </>
        )}

      {multiCategoryAnswer && (
        <SuggestedQuestions
          questions={suggestedQuestions}
          disabled={suggestionsDisabled}
          onSelect={onSuggestedQuestion}
        />
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
