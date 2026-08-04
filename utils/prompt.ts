import type { PromptVariable, UserInputFormItem } from '@/types/app'

export function replaceVarWithValues(str: string, promptVariables: PromptVariable[], inputs: Record<string, any>) {
  return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const name = inputs[key]
    if (name)
      return name

    const valueObj: PromptVariable | undefined = promptVariables.find(v => v.key === key)
    return valueObj ? `{{${valueObj.key}}}` : match
  })
}

export const userInputsFormToPromptVariables = (
  useInputs: UserInputFormItem[] | null,
) => {
  if (!useInputs)
    return []

  const promptVariables: PromptVariable[] = []

  useInputs.forEach((item: any) => {
    /**
     * 文件列表不作为普通文本表单变量渲染。
     * 图片由独立的图片上传组件处理，
     * 提交时再写入 inputs.image。
     */
    if (item['file-list'])
      return

    const isParagraph = !!item.paragraph

    const [type, content] = (() => {
      if (isParagraph)
        return ['paragraph', item.paragraph]

      if (item['text-input'])
        return ['string', item['text-input']]

      if (item.number)
        return ['number', item.number]

      if (item.file)
        return ['file', item.file]

      if (item.select)
        return ['select', item.select]

      return ['', null]
    })()

    // 遇到未知类型时直接跳过，避免页面500
    if (!content)
      return

    if (type === 'string' || type === 'paragraph') {
      promptVariables.push({
        key: content.variable,
        name: content.label,
        required: content.required,
        type,
        max_length: content.max_length,
        options: [],
      })
    }
    else if (type === 'number') {
      promptVariables.push({
        key: content.variable,
        name: content.label,
        required: content.required,
        type,
        options: [],
      })
    }
    else if (type === 'file') {
      promptVariables.push({
        key: content.variable,
        name: content.label,
        required: content.required,
        type: 'file',
        options: [],
      })
    }
    else if (type === 'select') {
      promptVariables.push({
        key: content.variable,
        name: content.label,
        required: content.required,
        type: 'select',
        options: content.options || [],
      })
    }
  })

  return promptVariables
}
