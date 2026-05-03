import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  void request
  return NextResponse.json(
    {
      error: '该上传接口已停用，请改用 /api/assets/upload-url 获取 TOS 预签名地址后由前端直传。',
    },
    { status: 410 }
  )
}
