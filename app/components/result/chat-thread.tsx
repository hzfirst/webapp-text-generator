'use client'

import type { FC } from 'react'
import React, { useEffect, useRef } from 'react'
import copy from 'copy-to-clipboard'
import { ClipboardDocumentIcon, SparklesIcon, UserIcon } from '@heroicons/react/24/outline'
import RichAnswer from './rich-answer'
import { getAnswerCopyText, parseRichAnswer } from './rich-answer-utils'
import { Markdown } from '@/app/components/base/markdown'
import Toast from '@/app/components/base/toast'
import type { VisionFile } from '@/types/app'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: unknown
  images?: VisionFile[]
  isError?: boolean
}

type ChatThreadProps = {
  messages: ChatMessage[]
  isLoading: boolean
  onSuggestedQuestion: (question: string) => void
}

const ChatThread: FC<ChatThreadProps> = ({
  messages,
  isLoading,
  onSuggestedQuestion,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastAssistantIndex = messages.reduce((lastIndex, message, index) => (
    message.role === 'assistant' ? index : lastIndex
  ), -1)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [isLoading, messages])

  const handleCopy = (content: unknown) => {
    copy(getAnswerCopyText(content))
    Toast.notify({ type: 'success', message: '已复制回答' })
  }

  return (
    <div className='h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-10'>
      <div className='mx-auto flex w-full max-w-[900px] flex-col gap-6'>
        {messages.length === 0 && !isLoading && (
          <div className='flex items-start gap-3'>
            <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm'>
              <SparklesIcon className='h-5 w-5' aria-hidden='true' />
            </div>
            <div className='max-w-[88%] rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm md:max-w-[760px]'>
              您好，我是宠医知识助手。请描述您遇到的问题，也可以直接粘贴一张系统截图。
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === 'user'
          const richAnswer = isUser ? null : parseRichAnswer(message.content)
          const isLastAssistant = index === lastAssistantIndex
          const userText = isUser && typeof message.content === 'string'
            ? message.content.trim()
            : ''
          const userImages = isUser
            ? (message.images || []).filter(image => Boolean(image.url))
            : []

          return (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}
            >
              {!isUser && (
                <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm'>
                  <SparklesIcon className='h-5 w-5' aria-hidden='true' />
                </div>
              )}

              <div className={`min-w-0 max-w-[88%] md:max-w-[760px] ${isUser ? 'order-first' : ''}`}>
                {isUser && (
                  <div className='flex flex-col items-end gap-2'>
                    {userImages.length > 0 && (
                      <div className='flex flex-wrap justify-end gap-2'>
                        {userImages.map((image, imageIndex) => (
                          <div
                            key={`${message.id}-image-${imageIndex}`}
                            className='overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-sm'
                          >
                            <img
                              src={image.url}
                              alt='用户上传的系统截图'
                              className='h-40 w-56 max-w-full rounded-md bg-slate-50 object-contain'
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {userText
                      ? (
                        <div className='rounded-lg bg-blue-600 px-4 py-3 text-white shadow-sm'>
                          <div className='whitespace-pre-wrap break-words text-sm leading-6'>
                            {userText}
                          </div>
                        </div>
                        )
                      : userImages.length > 0 && (
                        <div className='pr-1 text-xs text-slate-500'>已发送系统截图</div>
                      )}
                  </div>
                )}

                {!isUser && (
                  <div className={`rounded-lg px-4 py-3 shadow-sm ${
                    message.isError
                      ? 'border border-red-200 bg-red-50 text-red-700'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}>
                    {richAnswer && (
                      <RichAnswer
                        compact
                        data={richAnswer}
                        suggestionsDisabled={isLoading || !isLastAssistant}
                        onSuggestedQuestion={isLastAssistant ? onSuggestedQuestion : undefined}
                      />
                    )}

                    {!richAnswer && typeof message.content === 'string' && (
                      <div className='text-sm leading-6'>
                        <Markdown content={message.content} />
                      </div>
                    )}

                    {!richAnswer && typeof message.content !== 'string' && (
                      <pre className='overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5'>
                        {JSON.stringify(message.content, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {!isUser && !message.isError && (
                  <div className='mt-1 flex items-center'>
                    <button
                      type='button'
                      className='flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                      title='复制回答'
                      aria-label='复制回答'
                      onClick={() => handleCopy(message.content)}
                    >
                      <ClipboardDocumentIcon className='h-4 w-4' aria-hidden='true' />
                    </button>
                  </div>
                )}
              </div>

              {isUser && (
                <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600'>
                  <UserIcon className='h-5 w-5' aria-hidden='true' />
                </div>
              )}
            </div>
          )
        })}

        {isLoading && (
          <div className='flex items-start gap-3'>
            <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm'>
              <SparklesIcon className='h-5 w-5' aria-hidden='true' />
            </div>
            <div className='flex h-11 w-20 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white shadow-sm' aria-label='正在生成回答'>
              <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400' />
              <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]' />
              <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]' />
            </div>
          </div>
        )}

        <div ref={bottomRef} className='h-px' />
      </div>
    </div>
  )
}

export default React.memo(ChatThread)
