import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { client, getInfo } from '@/app/api/utils/common'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const { user } = getInfo(request)
    formData.append('user', user)
    const res = await client.fileUpload(formData)

    const id = `${res.data?.id || ''}`.trim()
    if (!id)
      throw new Error('Dify 未返回上传文件 ID')

    return NextResponse.json({ id })
  }
  catch (e: any) {
    return NextResponse.json(
      {
        error: 'FILE_UPLOAD_FAILED',
        message: e?.message || '文件上传失败',
      },
      { status: 502 },
    )
  }
}
