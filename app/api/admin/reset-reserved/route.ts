import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/reset-reserved
 * 重置用户的预扣预算（修复历史数据问题）
 * 仅超级管理员可用
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 验证是否为超级管理员
    const currentUser = await (prisma.user.findUnique as any)({
      where: { id: payload.userId },
      select: { isSuperAdmin: true },
    })

    if (!currentUser?.isSuperAdmin) {
      return NextResponse.json({ error: '仅超级管理员可执行此操作' }, { status: 403 })
    }

    // 重置所有用户的预扣预算和预扣token
    const result = await (prisma.user.updateMany as any)({
      where: {
        OR: [
          { reservedBudget: { gt: 0 } },
          { reservedTokens: { gt: 0 } },
        ]
      },
      data: {
        reservedBudget: 0,
        reservedTokens: 0,
      },
    })

    return NextResponse.json({
      success: true,
      message: `已重置 ${result.count} 个用户的预扣预算`,
      resetCount: result.count,
    })
  } catch (error: any) {
    console.error('Reset reserved budget error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
