import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  return NextResponse.json({
    error: '图片生成功能已在该开源视频版中移除',
  }, { status: 410 })
}
