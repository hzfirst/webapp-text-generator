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
  source_ids?: string[]
  source_urls?: string[]
  image_urls?: MediaItem[]
  video_urls?: MediaItem[]
  suggested_questions?: string[]
  conversation?: ConversationContext
}

export type ConversationContext = {
  active_topic: string
  context_summary: string
  waiting_for: string
  candidate_topics: string[]
  last_resolved_question: string
  resolved: boolean
}

function parseEmbeddedJson(text: string): unknown {
  let objectStart = text.indexOf('{')

  while (objectStart >= 0) {
    const candidate = text
      .slice(objectStart)
      .replace(/\s*```\s*$/, '')
      .trim()

    try {
      return JSON.parse(candidate)
    }
    catch {
      objectStart = text.indexOf('{', objectStart + 1)
    }
  }

  return null
}

/**
 * Compatible with direct objects, JSON strings, wrapped outputs, and
 * responses where explanatory text appears before the structured JSON.
 */
export function parseRichAnswer(value: unknown): RichAnswerData | null {
  if (!value)
    return null

  if (typeof value === 'string') {
    const parsed = parseEmbeddedJson(value.trim())
    return parsed ? parseRichAnswer(parsed) : null
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
    || Array.isArray(data.suggested_questions)

  if (!hasRichContent)
    return null

  const rawConversation = data.conversation
  const conversation = (rawConversation
    && typeof rawConversation === 'object'
    && !Array.isArray(rawConversation))
    ? rawConversation as Record<string, unknown>
    : null

  return {
    status: typeof data.status === 'string' ? data.status : '',
    answer: typeof data.answer === 'string' ? data.answer : '',
    source_ids: Array.isArray(data.source_ids) ? data.source_ids.filter((item): item is string => typeof item === 'string') : [],
    source_urls: Array.isArray(data.source_urls) ? data.source_urls.filter((item): item is string => typeof item === 'string') : [],
    image_urls: Array.isArray(data.image_urls) ? data.image_urls as MediaItem[] : [],
    video_urls: Array.isArray(data.video_urls) ? data.video_urls as MediaItem[] : [],
    suggested_questions: Array.isArray(data.suggested_questions)
      ? data.suggested_questions.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      : [],
    conversation: conversation
      ? {
        active_topic: typeof conversation.active_topic === 'string' ? conversation.active_topic : '',
        context_summary: typeof conversation.context_summary === 'string' ? conversation.context_summary : '',
        waiting_for: typeof conversation.waiting_for === 'string' ? conversation.waiting_for : '',
        candidate_topics: Array.isArray(conversation.candidate_topics)
          ? conversation.candidate_topics.filter((item): item is string => typeof item === 'string')
          : [],
        last_resolved_question: typeof conversation.last_resolved_question === 'string' ? conversation.last_resolved_question : '',
        resolved: conversation.resolved === true,
      }
      : undefined,
  }
}

export function getAnswerCopyText(value: unknown, richAnswer = parseRichAnswer(value)): string {
  const answer = richAnswer?.answer?.trim()
  if (answer)
    return answer

  if (typeof value === 'string')
    return value

  return JSON.stringify(value ?? {})
}

export function conversationToInputs(conversation: ConversationContext): Record<string, string> {
  return {
    active_topic: conversation.active_topic,
    context_summary: conversation.context_summary,
    waiting_for: conversation.waiting_for,
    candidate_topics: JSON.stringify(conversation.candidate_topics),
    last_resolved_question: conversation.last_resolved_question,
  }
}
