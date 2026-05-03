import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/lib/modules/auth/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/set-super-admin
 * 设置系统管理员
 * 
 * 安全机制：
 * 1. 如果系统中没有任何超级管理员，第一个请求的用户自动成为超级管理员
 * 2. 如果已有超级管理员，只有超级管理员可以设置其他用户为超级管理员
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSessionUser(request, {
      select: {
        id: true,
        isSuperAdmin: true,
      },
    })

    if ('response' in session) {
      return session.response
    }

    if (!session.user.isSuperAdmin) {
      return NextResponse.json({ error: '权限不足：仅系统管理员可以设置其他管理员' }, { status: 403 })
    }

    const body = await request.json()
    const targetEmail = typeof body.targetEmail === 'string' ? body.targetEmail.trim().toLowerCase() : ''
    if (!targetEmail) {
      return NextResponse.json({ error: '请提供目标用户邮箱' }, { status: 400 })
    }

    const existingSuperAdmin = await prisma.user.findFirst({
      where: { isSuperAdmin: true },
      select: { id: true },
    })

    if (!existingSuperAdmin) {
      return NextResponse.json(
        { error: '系统中尚未初始化超级管理员，请先通过部署环境变量完成首个超级管理员引导。' },
        { status: 409 }
      )
    }

    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail },
    })

    if (!targetUser) {
      return NextResponse.json({ error: '目标用户不存在' }, { status: 404 })
    }

    await prisma.user.update({
      where: { id: targetUser.id },
      data: { isSuperAdmin: true },
    })

    return NextResponse.json({
      success: true,
      message: `已将 ${targetEmail} 设置为系统管理员`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
      },
    })
  } catch (error: any) {
    console.error('Set super admin error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
