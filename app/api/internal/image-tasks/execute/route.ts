import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  void request
  return NextResponse.json({ error: '图片任务接口已移除' }, { status: 410 })
}
