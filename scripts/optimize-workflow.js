const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const source = process.argv[2]
const output = process.argv[3]
if (!source || !output) throw new Error('Usage: node scripts/optimize-workflow.js <source.yml> <output.yml>')

const document = yaml.load(fs.readFileSync(source, 'utf8'))
const nodes = document.workflow.graph.nodes
const byTitle = title => nodes.find(node => node.data.title === title)
const allowedCategories = [
  '前台分诊',
  '押金退款',
  '押金纠错明细',
  '挂号',
  '前台工作台各个功能介绍',
  '押金补打小票',
  '转移宠物',
  '新增次卡',
  '添加宠主和宠物备注',
  '宠物变更状态',
  '前台设置回访',
  '前台查看病例记录',
  '前台预约',
]
const enums = {
  relation_type: ['standalone', 'reference', 'ellipsis', 'continue', 'correction', 'clarification_answer', 'new_topic', 'uncertain'],
  relation: ['supporting', 'conflicting', 'irrelevant', 'image_only', 'text_only'],
  conversation_action: ['new_topic', 'continue', 'clarification_answer', 'switch_topic', 'unclear'],
  question_type: ['function_explanation', 'operation', 'location', 'reason', 'error', 'rule', 'unclear'],
}

function normalizeSchema(node, enumFields, typeFields) {
  const schema = node?.data?.structured_output?.schema
  if (!schema) return
  for (const [name, values] of Object.entries(enumFields)) {
    if (schema.properties?.[name]) schema.properties[name] = { type: 'string', enum: values }
  }
  for (const [name, type] of Object.entries(typeFields)) {
    if (schema.properties?.[name]) schema.properties[name] = { type }
  }
}

normalizeSchema(byTitle('文字意图分类'), enums, { need_clarification: 'boolean' })
normalizeSchema(byTitle('图文意图分类'), enums, { need_clarification: 'boolean' })
normalizeSchema(byTitle('多轮问题还原'), { relation_type: enums.relation_type }, {
  used_context: 'boolean',
  need_context_clarification: 'boolean',
})

for (const title of ['文字意图分类', '图文意图分类']) {
  const items = byTitle(title)?.data?.structured_output?.schema?.properties?.target_categories?.items
  if (items) Object.assign(items, { type: 'string', enum: allowedCategories })
}

const visionSystemPrompt = byTitle('图文意图分类').data.prompt_template.find(
  item => item.role === 'system',
)
if (!visionSystemPrompt.text.includes('每次都必须输出全部字段')) {
  visionSystemPrompt.text += `

【结构化输出完整性】
每次都必须输出全部字段：conversation_action、target_categories、resolved_question、question_type、relation、image_summary、need_clarification、clarification_question、confidence。
不能省略字段。无需澄清时 need_clarification=false、clarification_question=""；没有类目时 target_categories=[]；没有截图摘要时 image_summary=""。`
}

if (!visionSystemPrompt.text.includes('短文字与截图组合规则')) {
  visionSystemPrompt.text += `

【短文字与截图组合规则】
当用户文字只表达动作、问题类型或局部意图，而截图清楚提供业务对象、页面或模块时，必须把两者合并成完整问题。二者是互补信息，不是冲突，也不需要用户重复说明。
例如：文字“纠错”，截图明确显示押金相关页面、记录或字段，应理解为“押金纠错怎么操作”，relation=supporting，target_categories=["押金纠错明细"]，need_clarification=false。
只有截图无法识别业务对象、文字与截图确实指向不同业务，或组合后仍有多个无法区分的真实功能时，才允许 need_clarification=true。

允许的二级类目只有：前台分诊、押金退款、押金纠错明细、挂号、前台工作台各个功能介绍、押金补打小票、转移宠物、新增次卡、添加宠主和宠物备注、宠物变更状态、前台设置回访、前台查看病例记录、前台预约。
截图命中明确业务时应输出对应类目；问题明确但不属于这些类目时输出 target_categories=[]，不得为了命中而编造。`
}

for (const title of ['文字分类结果判断', '图文分类结果判断', '问题还原结果判断']) {
  for (const condition of byTitle(title)?.data?.cases?.[0]?.conditions || []) condition.varType = 'boolean'
}

function fixVariableTypes(title, sourceTitle) {
  const node = byTitle(title)
  const schema = byTitle(sourceTitle)?.data?.structured_output?.schema
  for (const variable of node?.data?.variables || []) {
    const field = variable.value_selector?.[variable.value_selector.length - 1]
    const property = schema?.properties?.[field]
    if (property?.type === 'array') variable.value_type = 'array[string]'
    else if (property?.type === 'number') variable.value_type = 'number'
    else if (property?.type === 'boolean') variable.value_type = 'boolean'
    else if (property?.type === 'string') variable.value_type = 'string'
  }
}
fixVariableTypes('文字分类结果封装', '文字意图分类')
fixVariableTypes('图文分类结果封装', '图文意图分类')
fixVariableTypes('模型澄清返回', '文字意图分类')

const stateSelectors = {
  active_topic: ['1786512073213', 'active_topic'],
  context_summary: ['1786512073213', 'context_summary'],
  waiting_for: ['1786512073213', 'waiting_for'],
  candidate_topics: ['1786512073213', 'candidate_topics'],
  last_resolved_question: ['1786512073213', 'last_resolved_question'],
  resolved: ['1786512073213', 'resolved'],
}

const start = byTitle('INPUT')
if (!start.data.variables.some(variable => variable.variable === 'resolved')) {
  start.data.variables.push({
    default: 'false',
    hint: '',
    label: '上一轮问题是否已完成',
    options: [],
    placeholder: '',
    required: false,
    type: 'text-input',
    variable: 'resolved',
  })
}

const restoreState = byTitle('会话状态恢复')
if (!restoreState.data.variables.some(variable => variable.variable === 'resolved')) {
  restoreState.data.variables.push({
    value_selector: [start.id, 'resolved'],
    value_type: 'string',
    variable: 'resolved',
  })
}
if (!restoreState.data.outputs.resolved) {
  restoreState.data.outputs.resolved = { children: null, type: 'boolean' }
  restoreState.data.code = restoreState.data.code
    .replace('    last_resolved_question=None\n):', '    last_resolved_question=None,\n    resolved=None\n):')
    .replace('    last_resolved_question = clean_text(last_resolved_question)\n', '    last_resolved_question = clean_text(last_resolved_question)\n    resolved = str(resolved or "").strip().lower() in {"true", "1", "yes"}\n')
    .replace('        "last_resolved_question": last_resolved_question,\n        "has_context": has_context', '        "last_resolved_question": last_resolved_question,\n        "resolved": resolved,\n        "has_context": has_context')
}

const router = byTitle('输入标准化与规则路由')
if (!router.data.variables.some(variable => variable.variable === 'resolved')) {
  router.data.variables.push({
    value_selector: [restoreState.id, 'resolved'],
    value_type: 'boolean',
    variable: 'resolved',
  })
  router.data.code = router.data.code
    .replace('    has_context: bool = False,\n) -> dict:', '    has_context: bool = False,\n    resolved: bool = False,\n) -> dict:')
}

const recoveryPrompt = byTitle('多轮问题还原')
const recoveryUserPrompt = recoveryPrompt.data.prompt_template.find(item => item.role === 'user')
if (!recoveryUserPrompt.text.includes('上一轮问题是否已完成')) {
  recoveryUserPrompt.text = recoveryUserPrompt.text
    .replace('【上一轮已经还原的问题】', '【上一轮问题是否已完成】\n{{#1786512073213.resolved#}}\n\n【上一轮已经还原的问题】')
  const systemPrompt = recoveryPrompt.data.prompt_template.find(item => item.role === 'system')
  systemPrompt.text = systemPrompt.text
    .replace('4. 如果 waiting_for 为空，且 last_resolved_question 已经明确对应唯一业务对象，', '4. 只有上一轮问题是否已完成为 true、waiting_for 为空，且 last_resolved_question 已经明确对应唯一业务对象，')
    .replace('八、如果无法可靠还原', '七点五、如果上一轮问题是否已完成为 false，且当前输入没有明确点名候选项或业务对象，不得继承 last_resolved_question。\n\n八、如果无法可靠还原')
}
function addVariable(node, variable, valueType) {
  const variables = node.data.variables || (node.data.variables = [])
  if (variables.some(item => item.variable === variable)) return
  const base = variable.replace(/^previous_/, '')
  variables.push({ value_selector: stateSelectors[base], value_type: valueType, variable })
}

function patchClarificationNode(title, topicsName) {
  const node = byTitle(title)
  if (!node) return
  let code = node.data.code
  if (!code.includes('previous_active_topic')) {
    code = code.replace('    normalized_text: str = "",\n', '    normalized_text: str = "",\n    previous_active_topic: str = "",\n    previous_context_summary: str = "",\n    previous_waiting_for: str = "",\n    previous_candidate_topics: list = None,\n    previous_last_resolved_question: str = "",\n')
    code = code.replace(
      '    topics = (\n        ' + topicsName + '\n        if isinstance(' + topicsName + ', list)\n        else []\n    )',
      '    topics = (\n        ' + topicsName + '\n        if isinstance(' + topicsName + ', list)\n        else []\n    )\n    previous_topics = previous_candidate_topics if isinstance(previous_candidate_topics, list) else []\n    if not topics:\n        topics = previous_topics',
    )
    code = code.replace('    topic = str(normalized_text or "").strip()', '    topic = str(normalized_text or "").strip()\n    active_topic = topic or str(previous_active_topic or "").strip()\n    previous_summary = str(previous_context_summary or "").strip()')
    code = code.replace('f"用户正在咨询{topic}相关功能，"', 'f"用户正在咨询{active_topic}相关功能，"')
    code = code.replace('if topic\n                    else "用户问题尚未明确"', 'if active_topic\n                    else previous_summary or "用户问题尚未明确"')
    code = code.replace('f"{topic}具体操作"\n                    if topic\n                    else "具体咨询内容"', 'f"{active_topic}具体操作"\n                    if active_topic\n                    else str(previous_waiting_for or "具体咨询内容").strip()')
    code = code.replace('"last_resolved_question": "",', '"last_resolved_question": str(previous_last_resolved_question or "").strip(),')
    code = code.replace('"active_topic": topic,', '"active_topic": active_topic,')
    code = code.replace('"waiting_for": "用户补充具体咨询内容",', '"waiting_for": str(previous_waiting_for or "用户补充具体咨询内容").strip(),')
    code = code.replace('"candidate_topics": topics,', '"candidate_topics": topics or previous_topics,')
    if (!code.includes('previous_topics = previous_candidate_topics')) {
      code = code.replace(
        '    topics = categories if isinstance(categories, list) else []',
        '    topics = categories if isinstance(categories, list) else []\n    previous_topics = previous_candidate_topics if isinstance(previous_candidate_topics, list) else []\n    if not topics:\n        topics = previous_topics',
      )
    }
    node.data.code = code
  }
  addVariable(node, 'previous_active_topic', 'string')
  addVariable(node, 'previous_context_summary', 'string')
  addVariable(node, 'previous_waiting_for', 'string')
  addVariable(node, 'previous_candidate_topics', 'array[string]')
  addVariable(node, 'previous_last_resolved_question', 'string')
}
patchClarificationNode('生成澄清结果', 'target_categories')
patchClarificationNode('模型澄清返回', 'categories')

function buildIntentNormalizerCode(relationDefault) {
  return `import json


def clean_text(value):
    return str(value or "").strip()


def parse_model_output(value):
    if isinstance(value, dict):
        return value

    text = clean_text(value)
    if not text:
        return {}

    try:
        result = json.loads(text)
        return result if isinstance(result, dict) else {}
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            return {}
        try:
            result = json.loads(text[start:end + 1])
            return result if isinstance(result, dict) else {}
        except Exception:
            return {}


def known_fields(data):
    if not isinstance(data, dict):
        return {}
    allowed = {
        "target_categories", "resolved_question",
        "question_type", "conversation_action",
        "need_clarification", "clarification_question",
        "confidence", "relation", "image_summary",
    }
    return {
        key: value
        for key, value in data.items()
        if key in allowed
    }


def as_bool(value):
    if isinstance(value, bool):
        return value
    return clean_text(value).lower() in {"true", "1", "yes"}


def as_number(value):
    try:
        return max(0.0, min(1.0, float(value or 0)))
    except Exception:
        return 0.0


def as_list(value, fallback=None):
    values = value if isinstance(value, list) else fallback
    if not isinstance(values, list):
        return []
    result = []
    for item in values:
        item = clean_text(item)
        if item and item not in result:
            result.append(item)
    return result


def main(
    structured_output=None,
    model_text: str = "",
    fallback_question: str = "",
    fallback_categories=None,
) -> dict:
    text_data = known_fields(parse_model_output(model_text))
    structured_data = known_fields(
        parse_model_output(structured_output)
    )
    data = dict(text_data)
    data.update(structured_data)
    categories = as_list(
        data.get("target_categories"),
        fallback_categories,
    )
    resolved_question = clean_text(
        data.get("resolved_question")
    ) or clean_text(fallback_question)

    allowed_question_types = {
        "function_explanation", "operation", "location",
        "reason", "error", "rule", "unclear",
    }
    question_type = clean_text(data.get("question_type"))
    if question_type not in allowed_question_types:
        question_type = "unclear"

    allowed_actions = {
        "new_topic", "continue", "clarification_answer",
        "switch_topic", "unclear",
    }
    conversation_action = clean_text(
        data.get("conversation_action")
    )
    if conversation_action not in allowed_actions:
        conversation_action = "new_topic"

    need_clarification = as_bool(
        data.get("need_clarification")
    )
    clarification_question = clean_text(
        data.get("clarification_question")
    )
    if not data:
        need_clarification = True
        clarification_question = (
            "暂时无法稳定识别当前内容，"
            "请补充文字说明或重新提交。"
        )
    if need_clarification and not clarification_question:
        clarification_question = (
            "请再说明一下您具体想咨询的功能或操作。"
        )

    allowed_relations = {
        "supporting", "conflicting", "irrelevant",
        "image_only", "text_only",
    }
    relation = clean_text(data.get("relation"))
    if relation not in allowed_relations:
        relation = "${relationDefault}"

    result = {
        "target_categories": categories,
        "resolved_question": resolved_question,
        "question_type": question_type,
        "conversation_action": conversation_action,
        "need_clarification": need_clarification,
        "clarification_question": clarification_question,
        "confidence": as_number(data.get("confidence")),
        "relation": relation,
        "image_summary": clean_text(data.get("image_summary")),
    }

    return {
        "intent_result": result,
        "need_clarification": need_clarification,
        "clarification_question": clarification_question,
        "target_categories": categories,
    }`
}

function normalizeIntentWrapper(title, llmTitle, fallbackSelector, relationDefault) {
  const node = byTitle(title)
  const llm = byTitle(llmTitle)
  node.data.code = buildIntentNormalizerCode(relationDefault)
  node.data.variables = [
    {
      value_selector: [llm.id, 'structured_output'],
      value_type: 'object',
      variable: 'structured_output',
    },
    {
      value_selector: [llm.id, 'text'],
      value_type: 'string',
      variable: 'model_text',
    },
    {
      value_selector: fallbackSelector,
      value_type: 'string',
      variable: 'fallback_question',
    },
    {
      value_selector: [router.id, 'target_categories'],
      value_type: 'array[string]',
      variable: 'fallback_categories',
    },
  ]
  node.data.outputs = {
    intent_result: { children: null, type: 'object' },
    need_clarification: { children: null, type: 'boolean' },
    clarification_question: { children: null, type: 'string' },
    target_categories: { children: null, type: 'array[string]' },
  }
}

const textIntentWrapper = byTitle('文字分类结果封装')
const visionIntentWrapper = byTitle('图文分类结果封装')
const textIntentLlm = byTitle('文字意图分类')
const visionIntentLlm = byTitle('图文意图分类')
const textIntentCondition = byTitle('文字分类结果判断')
const visionIntentCondition = byTitle('图文分类结果判断')
const textClarification = byTitle('模型澄清返回')
const intentAggregator = byTitle('意图结果聚合')
const finalAggregator = byTitle('最终结果聚合')

normalizeIntentWrapper(
  '文字分类结果封装',
  '文字意图分类',
  [byTitle('还原问题合并').id, 'resolved_question'],
  'text_only',
)
normalizeIntentWrapper(
  '图文分类结果封装',
  '图文意图分类',
  [router.id, 'normalized_text'],
  'supporting',
)

textIntentCondition.data.cases[0].conditions[0].variable_selector = [
  textIntentWrapper.id,
  'need_clarification',
]
visionIntentCondition.data.cases[0].conditions[0].variable_selector = [
  visionIntentWrapper.id,
  'need_clarification',
]

textClarification.data.variables[0] = {
  value_selector: [textIntentWrapper.id, 'clarification_question'],
  value_type: 'string',
  variable: 'question',
}
textClarification.data.variables[1] = {
  value_selector: [textIntentWrapper.id, 'target_categories'],
  value_type: 'array[string]',
  variable: 'categories',
}

const visionClarification = JSON.parse(JSON.stringify(textClarification))
visionClarification.id = '1790000000002'
visionClarification.data.title = '图文模型澄清返回'
visionClarification.position = { x: 1811.059361395702, y: 1242.6255687194039 }
visionClarification.positionAbsolute = { ...visionClarification.position }
visionClarification.data.variables[0] = {
  value_selector: [visionIntentWrapper.id, 'clarification_question'],
  value_type: 'string',
  variable: 'question',
}
visionClarification.data.variables[1] = {
  value_selector: [visionIntentWrapper.id, 'target_categories'],
  value_type: 'array[string]',
  variable: 'categories',
}
nodes.push(visionClarification)

textIntentWrapper.position = { x: 1185.866087777139, y: 983.0545260474264 }
textIntentWrapper.positionAbsolute = { ...textIntentWrapper.position }
textIntentCondition.position = { x: 1493.5856581997318, y: 983.0545260474264 }
textIntentCondition.positionAbsolute = { ...textIntentCondition.position }
visionIntentWrapper.position = { x: 1185.866087777139, y: 1150.9692689426467 }
visionIntentWrapper.positionAbsolute = { ...visionIntentWrapper.position }
visionIntentCondition.position = { x: 1493.5856581997318, y: 1150.9692689426467 }
visionIntentCondition.positionAbsolute = { ...visionIntentCondition.position }

const removedEdgeIds = new Set([
  '1785912650422-source-1785913070668-target',
  '1785913070668-false-1785913863538-target',
  '1785913863538-source-1785914483498-target',
  '1785468340389-source-1785914879881-target',
  '1785914879881-true-1785913765809-target',
  '1785914879881-false-1785915395693-target',
  '1785915395693-source-1785914483498-target',
])
document.workflow.graph.edges = document.workflow.graph.edges.filter(
  edge => !removedEdgeIds.has(edge.id),
)

function addEdge(source, sourceType, target, targetType, sourceHandle = 'source') {
  const id = `${source}-${sourceHandle}-${target}-target`
  document.workflow.graph.edges.push({
    data: {
      isInIteration: false,
      isInLoop: false,
      sourceType,
      targetType,
    },
    id,
    selected: false,
    source,
    sourceHandle,
    target,
    targetHandle: 'target',
    type: 'custom',
    zIndex: 0,
  })
}

addEdge(textIntentLlm.id, 'llm', textIntentWrapper.id, 'code')
addEdge(textIntentWrapper.id, 'code', textIntentCondition.id, 'if-else')
addEdge(textIntentCondition.id, 'if-else', intentAggregator.id, 'variable-aggregator', 'false')
addEdge(visionIntentLlm.id, 'llm', visionIntentWrapper.id, 'code')
addEdge(visionIntentWrapper.id, 'code', visionIntentCondition.id, 'if-else')
addEdge(visionIntentCondition.id, 'if-else', intentAggregator.id, 'variable-aggregator', 'false')
addEdge(visionIntentCondition.id, 'if-else', visionClarification.id, 'code', 'true')
addEdge(visionClarification.id, 'code', finalAggregator.id, 'variable-aggregator')

if (!finalAggregator.data.variables.some(selector => selector[0] === visionClarification.id)) {
  finalAggregator.data.variables.unshift([visionClarification.id, 'result'])
}

const routeError = byTitle('路由异常')
routeError.data.code = [
  'def main(arg1: str = "", arg2: str = ""):',
  '    return {',
  '        "result": {',
  '            "status": "system_error",',
  '            "answer": "问题处理出现异常，请重新提交。",',
  '            "source_ids": [],',
  '            "source_urls": [],',
  '            "image_urls": [],',
  '            "video_urls": [],',
  '            "suggested_questions": [],',
  '            "conversation": {',
  '                "active_topic": "",',
  '                "context_summary": "工作流路由异常",',
  '                "waiting_for": "重新描述问题",',
  '                "candidate_topics": [],',
  '                "last_resolved_question": "",',
  '                "resolved": False',
  '            }',
  '        }',
  '    }',
].join('\n')
routeError.data.variables = []
routeError.data.outputs = { result: { children: null, type: 'object' } }

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, yaml.dump(document, { noRefs: true, lineWidth: -1, noCompatMode: true }), 'utf8')
console.log(`Wrote ${output}`)
