'use client'
import type { FC } from 'react'
import React, { useEffect, useRef, useState } from 'react'
import { useBoolean } from 'ahooks'
import { useTranslation } from 'react-i18next'
import produce from 'immer'
import cn from 'classnames'
import TextGenerationRes from './item'
import ChatThread from './chat-thread'
import type { ChatMessage } from './chat-thread'
import Toast from '@/app/components/base/toast'
import { sendCompletionMessage, sendWorkflowMessage, updateFeedback } from '@/service'
import type { Feedbacktype, PromptConfig, VisionFile, VisionSettings, WorkflowProcess } from '@/types/app'
import { BlockEnum, NodeRunningStatus, TransferMethod, WorkflowRunningStatus } from '@/types/app'

const REQUEST_TIMEOUT = 5 * 60 * 1000

export type IResultProps = {
  isWorkflow: boolean
  isCallBatchAPI: boolean
  isPC: boolean
  isMobile: boolean
  isError: boolean
  promptConfig: PromptConfig | null
  inputs: Record<string, any>
  controlSend?: number
  controlRetry?: number
  controlStopResponding?: number
  onShowRes: () => void
  taskId?: number
  onCompleted: (
    completionRes: any,
    taskId?: number,
    success?: boolean
  ) => void
  visionConfig: VisionSettings
  completionFiles: VisionFile[]
  onSuggestedQuestion: (question: string) => void
  onRespondingChange?: (responding: boolean) => void
}

const Result: FC<IResultProps> = ({
  isWorkflow,
  isCallBatchAPI,
  isPC,
  isMobile,
  isError,
  promptConfig,
  inputs,
  controlSend,
  controlRetry,
  controlStopResponding,
  onShowRes,
  taskId,
  onCompleted,
  visionConfig,
  completionFiles,
  onSuggestedQuestion,
  onRespondingChange,
}) => {
  const { t } = useTranslation()
  const [isResponsing, { setTrue: setResponsingTrue, setFalse: setResponsingFalse }] = useBoolean(false)
  useEffect(() => {
    if (controlStopResponding)
      setResponsingFalse()
  }, [controlStopResponding])

  const [completionRes, doSetCompletionRes] = useState<any>('')

  const completionResRef = useRef<any>('')

  const setCompletionRes = (res: any) => {
    completionResRef.current = res
    doSetCompletionRes(res)
  }

  const getCompletionRes = () => completionResRef.current
  const [workflowProcessData, doSetWorkflowProccessData] = useState<WorkflowProcess>()
  const workflowProcessDataRef = useRef<WorkflowProcess>()
  const setWorkflowProccessData = (data: WorkflowProcess) => {
    workflowProcessDataRef.current = data
    doSetWorkflowProccessData(data)
  }
  const getWorkflowProccessData = () => workflowProcessDataRef.current

  const { notify } = Toast
  const isNoData = !completionRes

  const [messageId, setMessageId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedbacktype>({
    rating: null,
  })
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const messageSequenceRef = useRef(0)

  const nextChatMessageId = (role: ChatMessage['role']) => {
    messageSequenceRef.current += 1
    return `${role}-${messageSequenceRef.current}`
  }

  const appendAssistantMessage = (content: unknown, isError = false) => {
    if (isCallBatchAPI)
      return

    setChatMessages(current => [
      ...current,
      {
        id: nextChatMessageId('assistant'),
        role: 'assistant',
        content,
        isError,
      },
    ])
  }

  const handleFeedback = async (feedback: Feedbacktype) => {
    await updateFeedback({ url: `/messages/${messageId}/feedbacks`, body: { rating: feedback.rating } })
    setFeedback(feedback)
  }

  const logError = (message: string) => {
    notify({ type: 'error', message })
  }

  const checkCanSend = () => {
    // batch will check outer
    if (isCallBatchAPI)
      return true

    const prompt_variables = promptConfig?.prompt_variables
    if (!prompt_variables || prompt_variables?.length === 0)
      return true

    let hasEmptyInput = ''
    const requiredVars = prompt_variables?.filter(({ key, name, required }) => {
      const res = (!key || !key.trim()) || (!name || !name.trim()) || (required || required === undefined || required === null)
      return res
    }) || [] // compatible with old version
    requiredVars.forEach(({ key, name }) => {
      if (hasEmptyInput)
        return

      if (!inputs[key])
        hasEmptyInput = name
    })

    if (hasEmptyInput) {
      logError(t('app.errorMessage.valueOfVarRequired', { key: hasEmptyInput }))
      return false
    }
    if (completionFiles.find(item => item.transfer_method === TransferMethod.local_file && !item.upload_file_id?.trim())) {
      notify({ type: 'info', message: t('app.errorMessage.waitForImgUpload') })
      return false
    }
    return !hasEmptyInput
  }

  const handleSend = async (appendUserMessage = !isCallBatchAPI) => {
    if (isResponsing) {
      notify({ type: 'info', message: t('app.errorMessage.waitForResponse') })
      return false
    }

    if (!checkCanSend()) {
      onRespondingChange?.(false)
      return
    }

    if (!isCallBatchAPI && appendUserMessage) {
      const questionVariable = promptConfig?.prompt_variables.find(variable => variable.key === 'cw')
        || promptConfig?.prompt_variables.find(variable => variable.type !== 'file')
      const question = questionVariable ? `${inputs[questionVariable.key] || ''}` : ''
      setChatMessages(current => [
        ...current,
        {
          id: nextChatMessageId('user'),
          role: 'user',
          content: question,
          images: completionFiles,
        },
      ])
    }

    const requestFiles = completionFiles.map((item) => {
      if (item.transfer_method === TransferMethod.local_file) {
        return {
          type: 'image',
          transfer_method: TransferMethod.local_file,
          upload_file_id: item.upload_file_id.trim(),
          url: '',
        }
      }

      return {
        type: 'image',
        transfer_method: item.transfer_method,
        upload_file_id: '',
        url: item.url || '',
      }
    })

    const requestInputs = { ...inputs }
    const data: Record<string, any> = { inputs: requestInputs }

    if (isWorkflow && visionConfig.enabled)
      requestInputs[visionConfig.variable || 'image'] = requestFiles

    if (!isWorkflow && visionConfig.enabled && requestFiles.length > 0) {
      data.files = requestFiles.map((item) => {
        if (item.transfer_method === TransferMethod.local_file) {
          return {
            ...item,
            url: '',
          }
        }
        return item
      })
    }

    setMessageId(null)
    setFeedback({
      rating: null,
    })
    setCompletionRes('')

    const res: string[] = []
    let tempMessageId = ''

    if (!isPC)
      onShowRes()

    setResponsingTrue()
    onRespondingChange?.(true)
    let isEnd = false
    let isTimeout = false
    const timeoutId = window.setTimeout(() => {
      if (!isEnd) {
        isEnd = true
        isTimeout = true
        setResponsingFalse()
        onRespondingChange?.(false)
        notify({ type: 'error', message: t('app.errorMessage.requestTimeout') })
        appendAssistantMessage(t('app.errorMessage.requestTimeout'), true)
        onCompleted(getCompletionRes(), taskId, false)
      }
    }, REQUEST_TIMEOUT)

    const finishRequest = () => {
      window.clearTimeout(timeoutId)
      setResponsingFalse()
      onRespondingChange?.(false)
      isEnd = true
    }

    if (isWorkflow) {
      sendWorkflowMessage(
        data,
        {
          onWorkflowStarted: ({ workflow_run_id }) => {
            tempMessageId = workflow_run_id
            setWorkflowProccessData({
              status: WorkflowRunningStatus.Running,
              tracing: [],
              expand: true,
            })
          },
          onNodeStarted: ({ data }) => {
            setWorkflowProccessData(produce(getWorkflowProccessData()!, (draft) => {
              draft.expand = true
              draft.tracing!.push({
                ...data,
                status: NodeRunningStatus.Running,
                expand: true,
              } as any)
            }))
          },
          onNodeFinished: ({ data }) => {
            setWorkflowProccessData(produce(getWorkflowProccessData()!, (draft) => {
              const currentIndex = draft.tracing!.findIndex(trace => trace.node_id === data.node_id)
              if (currentIndex > -1 && draft.tracing) {
                draft.tracing[currentIndex] = {
                  ...(draft.tracing[currentIndex].extras
                    ? { extras: draft.tracing[currentIndex].extras }
                    : {}),
                  ...data,
                  expand: !!data.error,
                } as any
              }
            }))
          },
          onWorkflowFinished: ({ data }) => {
            if (isTimeout || isEnd)
              return
            if (data.error) {
              notify({ type: 'error', message: data.error })
              appendAssistantMessage(data.error, true)
              finishRequest()
              onCompleted(getCompletionRes(), taskId, false)
              return
            }
            setWorkflowProccessData(produce(getWorkflowProccessData()!, (draft) => {
              draft.status = data.error ? WorkflowRunningStatus.Failed : WorkflowRunningStatus.Succeeded
            }))
            const endNodeOutputs = [...(getWorkflowProccessData()?.tracing || [])]
              .reverse()
              .find(node => node.node_type === BlockEnum.End)
              ?.outputs
            const hasWorkflowOutputs = data.outputs !== null
              && data.outputs !== undefined
              && data.outputs !== ''
              && (typeof data.outputs !== 'object' || Object.keys(data.outputs).length > 0)
            const outputs = hasWorkflowOutputs ? data.outputs : endNodeOutputs
            const hasObjectOutputs = Boolean(outputs)
              && typeof outputs === 'object'
              && !Array.isArray(outputs)
            const outputKeys = hasObjectOutputs
              ? Object.keys(outputs)
              : []
            const completion = outputKeys.length === 1
              ? outputs[outputKeys[0]]
              : (outputs || '')

            setCompletionRes(completion)
            appendAssistantMessage(completion)
            finishRequest()
            setMessageId(tempMessageId)
            onCompleted(completion, taskId, true)
          },
          onError: (message) => {
            if (isTimeout || isEnd)
              return

            notify({ type: 'error', message })
            appendAssistantMessage(message, true)
            finishRequest()
            onCompleted(getCompletionRes(), taskId, false)
          },
        },
      )
    }
    else {
      sendCompletionMessage(data, {
        onData: (data: string, _isFirstMessage: boolean, { messageId }) => {
          tempMessageId = messageId
          res.push(data)
          setCompletionRes(res.join(''))
        },
        onCompleted: () => {
          if (isTimeout || isEnd)
            return

          finishRequest()
          setMessageId(tempMessageId)
          appendAssistantMessage(getCompletionRes())
          onCompleted(getCompletionRes(), taskId, true)
        },
        onError(message) {
          if (isTimeout || isEnd)
            return

          notify({ type: 'error', message })
          appendAssistantMessage(message, true)
          finishRequest()
          onCompleted(getCompletionRes(), taskId, false)
        },
      })
    }
  }

  useEffect(() => {
    if (controlSend)
      handleSend()
  }, [controlSend])

  useEffect(() => {
    if (controlRetry)
      handleSend(false)
  }, [controlRetry])

  const renderTextGenerationRes = () => (
    <TextGenerationRes
      isWorkflow={isWorkflow}
      workflowProcessData={workflowProcessData}
      className='mt-3'
      isError={isError}
      onRetry={handleSend}
      content={completionRes}
      messageId={messageId}
      isInWebApp
      onFeedback={handleFeedback}
      feedback={feedback}
      isMobile={isMobile}
      isLoading={isCallBatchAPI ? (!completionRes && isResponsing) : false}
      taskId={isCallBatchAPI ? ((taskId as number) < 10 ? `0${taskId}` : `${taskId}`) : undefined}
    />
  )

  if (!isCallBatchAPI) {
    return (
      <ChatThread
        messages={chatMessages}
        isLoading={isResponsing}
        onSuggestedQuestion={onSuggestedQuestion}
      />
    )
  }

  return (
    <div className={cn(isNoData && !isCallBatchAPI && 'h-full')}>
      {isCallBatchAPI && (
        <div className='mt-2'>
          {renderTextGenerationRes()}
        </div>
      )}
    </div>
  )
}
export default React.memo(Result)
