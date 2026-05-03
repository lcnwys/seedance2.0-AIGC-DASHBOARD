import { NextRequest, NextResponse } from 'next/server'
import { requireSessionUser } from '@/lib/modules/auth/session'
import {
  createObjectStorageUploadTarget,
  hasConfiguredObjectStorageProvider,
} from '@/lib/object-storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/assets/upload-url
 * 获取对象存储预签名上传 URL（仅登录用户可访问）
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSessionUser(request, {
      select: {
        teamId: true,
      },
    })
    if ('response' in session) {
      return session.response
    }

    const body = await request.json().catch(() => ({}))

    if (!hasConfiguredObjectStorageProvider()) {
      return NextResponse.json(
        { error: '当前团队未配置对象存储，素材库上传不可用。可在生成面板直接添加本地图片作为临时参考。' },
        { status: 400 },
      )
    }

    const fileName = typeof body.fileName === 'string' && body.fileName.trim()
      ? body.fileName.trim()
      : 'file'
    const target = await createObjectStorageUploadTarget({
      userId: session.payload.userId,
      teamId: session.user.teamId || null,
      fileName,
    })

    return NextResponse.json({
      method: 'PUT',
      uploadUrl: target.uploadUrl,
      fileUrl: target.fileUrl,
      objectKey: target.objectKey,
      expiresInSeconds: target.expiresInSeconds,
      headers: {
        'Content-Type': typeof body.contentType === 'string' ? body.contentType : 'application/octet-stream',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Get upload URL error:', error)
    return NextResponse.json(
      { error: message },
      { status: /未配置|Missing required environment variable/i.test(message) ? 400 : 500 }
    )
  }
}
