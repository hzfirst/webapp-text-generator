import { type NextRequest } from 'next/server'
import { CompletionClient } from 'dify-client'
import { v4 } from 'uuid'
import { APP_ID } from '@/config'

const apiKey = process.env.DIFY_API_KEY
const apiUrl = process.env.DIFY_API_URL || 'https://api.dify.ai/v1'

if (!apiKey) {
  throw new Error('缺少服务端环境变量 DIFY_API_KEY')
}

const userPrefix = `user_${APP_ID}:`

export const getInfo = (request: NextRequest) => {
  const sessionId = request.cookies.get('session_id')?.value || v4()
  const user = userPrefix + sessionId

  return {
    sessionId,
    user,
  }
}

export const setSession = (sessionId: string) => {
  return {
    'Set-Cookie': `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax`,
  }
}

export const client = new CompletionClient(apiKey, apiUrl)