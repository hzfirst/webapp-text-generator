import type { FC } from 'react'
import React from 'react'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'
import type { PromptConfig, VisionFile, VisionSettings } from '@/types/app'
import { DEFAULT_VALUE_MAX_LEN } from '@/config'
import TextGenerationImageUploader from '@/app/components/base/image-uploader/text-generation-image-uploader'

export type IRunOnceProps = {
  promptConfig: PromptConfig
  inputs: Record<string, any>
  onInputsChange: (inputs: Record<string, any>) => void
  onSend: () => void
  visionConfig: VisionSettings
  onVisionFilesChange: (files: VisionFile[]) => void
  resetKey?: number
  disabled?: boolean
}

const SYSTEM_CONTEXT_KEYS = new Set([
  'active_topic',
  'context_summary',
  'waiting_for',
  'candidate_topics',
  'last_resolved_question',
])

const RunOnce: FC<IRunOnceProps> = ({
  promptConfig,
  inputs,
  onInputsChange,
  onSend,
  visionConfig,
  onVisionFilesChange,
  resetKey = 0,
  disabled = false,
}) => {
  const visibleVariables = promptConfig.prompt_variables.filter(variable => !SYSTEM_CONTEXT_KEYS.has(variable.key) && variable.type !== 'file')
  const questionVariable = visibleVariables.find(variable => variable.key === 'cw') || visibleVariables[0]
  const questionValue = questionVariable ? `${inputs[questionVariable.key] || ''}` : ''

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!disabled)
      onSend()
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing)
      return

    if (event.shiftKey)
      return

    event.preventDefault()
    if (!disabled)
      onSend()
  }

  return (
    <form onSubmit={handleSubmit} className='mx-auto w-full max-w-[900px]'>
      <div className='overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.08)] focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100'>
        {visionConfig?.enabled && (
          <div className='border-b border-slate-100 bg-slate-50/70 px-3 py-2'>
            <TextGenerationImageUploader
              key={resetKey}
              settings={visionConfig}
              onFilesChange={files => onVisionFilesChange(files.filter(file => file.progress !== -1).map(fileItem => ({
                type: 'image',
                transfer_method: fileItem.type,
                url: fileItem.url,
                upload_file_id: fileItem.fileId,
              })))}
            />
          </div>
        )}

        <div className='flex items-end gap-2 p-2'>
          <textarea
            rows={2}
            className='max-h-36 min-h-[52px] grow resize-none bg-transparent px-2 py-2 text-[15px] leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400'
            placeholder='请输入问题，或粘贴一张系统截图...'
            value={questionValue}
            disabled={disabled || !questionVariable}
            onChange={(event) => {
              if (questionVariable)
                onInputsChange({ ...inputs, [questionVariable.key]: event.target.value })
            }}
            onKeyDown={handleInputKeyDown}
            maxLength={questionVariable?.max_length || DEFAULT_VALUE_MAX_LEN}
            aria-label={questionVariable?.name || '当前用户问题'}
          />

          <button
            type='submit'
            className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300'
            disabled={disabled}
            title={disabled ? '正在生成回答' : '发送'}
            aria-label={disabled ? '正在生成回答' : '发送'}
          >
            <PaperAirplaneIcon className='h-5 w-5' aria-hidden='true' />
          </button>
        </div>
      </div>
      <div className='mt-2 text-center text-xs text-slate-400'>Enter 发送，Shift+Enter 换行</div>
    </form>
  )
}
export default React.memo(RunOnce)
