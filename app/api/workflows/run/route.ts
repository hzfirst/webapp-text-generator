import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { client, getInfo } from '@/app/api/utils/common'

export async function POST(request: NextRequest) {
  try {
    const { inputs } = await request.json()
    const { user } = getInfo(request)
    const res = await client.runWorkflow(inputs, user, true)

    return new Response(res.data as any, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '未知服务端错误'

    return NextResponse.json(
      {
        error: 'DIFY_WORKFLOW_REQUEST_FAILED',
        message,
      },
      { status: 500 },
    )
  }
}
