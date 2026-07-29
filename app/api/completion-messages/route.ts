import { type NextRequest } from 'next/server'
import { client, getInfo } from '@/app/api/utils/common'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      inputs,
      files,
    } = body

    const { user } = getInfo(request)

    const res = await client.createCompletionMessage(
      inputs,
      user,
      true,
      files,
    )

    return new Response(res.data as any, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    })
  }
  catch (error) {
    console.error('调用Dify失败：', error)

    const message
      = error instanceof Error ? error.message : '未知服务端错误'

    return Response.json(
      {
        error: 'DIFY_REQUEST_FAILED',
        message,
      },
      {
        status: 500,
      },
    )
  }
}