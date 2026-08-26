export type MediaItem = {
  source_id?: string
  category?: string
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

export type RichAnswerSection = {
  category: string
  answer: string
  image_urls: MediaItem[]
  video_urls: MediaItem[]
}

export type MultiCategoryAnswer = {
  intro: string
  sections: RichAnswerSection[]
  unassigned_image_urls: MediaItem[]
  unassigned_video_urls: MediaItem[]
}

export type ConversationContext = {
  active_topic: string
  context_summary: string
  waiting_for: string
  candidate_topics: string[]
  last_resolved_question: string
  resolved: boolean
}

function cleanCategory(value?: string): string {
  return `${value || ''}`.trim()
}

function getCategoryAliases(category: string): string[] {
  const aliases = [category]
  const conciseCategory = category.replace(/(?:明细|功能)$/, '').trim()

  if (conciseCategory.length >= 2 && conciseCategory !== category)
    aliases.push(conciseCategory)

  return aliases.sort((left, right) => right.length - left.length)
}

function getAnswerLineCategory(line: string, categories: string[]): number {
  const isMarkdownHeading = /^\s{0,3}#{1,6}\s+/.test(line)
  const normalizedLine = line
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*(?:第[一二三四五六七八九十\d]+部分\s*[：:、.-]?|[（(]?(?:\d+|[一二三四五六七八九十]+)[）).、:：-])\s*/, '')
    .trim()

  let matchedCategory = -1
  let matchedAliasLength = 0

  categories.forEach((category, index) => {
    getCategoryAliases(category).forEach((alias) => {
      const startsWithCategory = normalizedLine.startsWith(alias)
      const headingContainsCategory = isMarkdownHeading && normalizedLine.includes(alias)

      if ((startsWithCategory || headingContainsCategory) && alias.length > matchedAliasLength) {
        matchedCategory = index
        matchedAliasLength = alias.length
      }
    })
  })

  return matchedCategory
}

function isCategoryOnlyHeading(line: string, category: string): boolean {
  const normalizedLine = line
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*(?:第[一二三四五六七八九十\d]+部分\s*[：:、.-]?|[（(]?(?:\d+|[一二三四五六七八九十]+)[）).、:：-])\s*/, '')
    .trim()

  return getCategoryAliases(category).some((alias) => {
    if (!normalizedLine.startsWith(alias))
      return false

    const remainder = normalizedLine.slice(alias.length)
      .replace(/^[\s:：,，、.-]+/, '')
      .trim()

    return !remainder
      || /^(?:具体)?(?:要)?怎么(?:做|操作)[？?。.]?$/.test(remainder)
      || /^(?:对应的)?操作(?:说明|步骤)[：:]?$/.test(remainder)
  })
}

function stripSectionOrderMarker(line: string): string {
  return line.replace(
    /^(\s*(?:#{1,6}\s+)?(?:\*\*)?)\s*(?:第[一二三四五六七八九十\d]+部分\s*[：:、.-]?|[（(]?(?:\d+|[一二三四五六七八九十]+)[）).、:：-])\s*/,
    '$1',
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function splitAnswerByCategory(answer: string, categories: string[]) {
  const sectionLines = categories.map(() => [] as string[])
  const introLines: string[] = []
  let activeCategory = -1
  const categoryPattern = categories
    .flatMap(getCategoryAliases)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|')
  const normalizedAnswer = categoryPattern
    ? answer.replace(
      new RegExp(`([。；;，,])\\s*(?=(?:\\d+|[一二三四五六七八九十]+)[）).、:：-]\\s*(?:${categoryPattern}))`, 'g'),
      '$1\n',
    )
    : answer

  normalizedAnswer.replace(/\r/g, '').split('\n').forEach((line) => {
    const lineCategory = getAnswerLineCategory(line, categories)

    if (lineCategory >= 0) {
      activeCategory = lineCategory
      if (!isCategoryOnlyHeading(line, categories[lineCategory]))
        sectionLines[activeCategory].push(stripSectionOrderMarker(line))
      return
    }

    if (activeCategory >= 0)
      sectionLines[activeCategory].push(line)
    else
      introLines.push(line)
  })

  return {
    intro: introLines.join('\n').trim(),
    sectionAnswers: sectionLines.map(lines => lines.join('\n').trim()),
  }
}

function findCategoryIndex(category: string, categories: string[]): number {
  const normalizedCategory = cleanCategory(category)
  if (!normalizedCategory)
    return -1

  return categories.findIndex(candidate => cleanCategory(candidate) === normalizedCategory)
}

function orderCategoriesByQuestion(categories: string[], question?: string): string[] {
  const normalizedQuestion = `${question || ''}`.trim()
  if (!normalizedQuestion)
    return categories

  return categories
    .map((category, originalIndex) => {
      const positions = getCategoryAliases(category)
        .map(alias => normalizedQuestion.indexOf(alias))
        .filter(position => position >= 0)

      return {
        category,
        originalIndex,
        questionIndex: positions.length > 0 ? Math.min(...positions) : Number.MAX_SAFE_INTEGER,
      }
    })
    .sort((left, right) => (
      left.questionIndex - right.questionIndex
      || left.originalIndex - right.originalIndex
    ))
    .map(item => item.category)
}

export function getMultiCategoryAnswer(data: RichAnswerData): MultiCategoryAnswer | null {
  if (data.conversation?.active_topic !== 'multi_category')
    return null

  const categories: string[] = []
  const addCategory = (value?: string) => {
    const category = cleanCategory(value)
    if (category && !categories.includes(category))
      categories.push(category)
  }

  data.conversation.candidate_topics.forEach(addCategory)
  data.image_urls?.forEach(item => addCategory(item.category))
  data.video_urls?.forEach(item => addCategory(item.category))

  if (categories.length < 2)
    return null

  const orderedCategories = orderCategoriesByQuestion(
    categories,
    data.conversation.last_resolved_question,
  )
  const { intro, sectionAnswers } = splitAnswerByCategory(data.answer || '', orderedCategories)
  const sections = orderedCategories.map((category, index) => ({
    category,
    answer: sectionAnswers[index],
    image_urls: [] as MediaItem[],
    video_urls: [] as MediaItem[],
  }))
  const unassignedImageUrls: MediaItem[] = []
  const unassignedVideoUrls: MediaItem[] = []

  data.image_urls?.forEach((item) => {
    const sectionIndex = findCategoryIndex(item.category || '', orderedCategories)
    if (sectionIndex >= 0)
      sections[sectionIndex].image_urls.push(item)
    else
      unassignedImageUrls.push(item)
  })

  data.video_urls?.forEach((item) => {
    const sectionIndex = findCategoryIndex(item.category || '', orderedCategories)
    if (sectionIndex >= 0)
      sections[sectionIndex].video_urls.push(item)
    else
      unassignedVideoUrls.push(item)
  })

  return {
    intro,
    sections,
    unassigned_image_urls: unassignedImageUrls,
    unassigned_video_urls: unassignedVideoUrls,
  }
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
    resolved: conversation.resolved ? 'true' : 'false',
  }
}
