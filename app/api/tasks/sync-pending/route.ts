import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/lib/modules/auth/session'
import { syncPendingTasksBatch } from '@/lib/modules/provider/seedance/task-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }

    const body = await request.json().catch(() => ({}))
    const currentUser = session.user as any
    const viewAll = body.viewAll === true
    const memberId = typeof body.memberId === 'string' && body.memberId !== 'all' ? body.memberId : null
    const taskIds = Array.isArray(body.taskIds)
      ? body.taskIds.filter((taskId: unknown): taskId is string => typeof taskId === 'string' && taskId.trim().length > 0)
      : []
    const limit = typeof body.limit === 'number' && Number.isFinite(body.limit)
      ? Math.max(1, Math.min(100, Math.floor(body.limit)))
      : undefined

    const scope = currentUser.role === 'admin' && currentUser.teamId && viewAll
      ? { teamId: currentUser.teamId, memberId }
      : { userId: session.payload.userId }

    if (currentUser.role === 'admin' && currentUser.teamId && viewAll && memberId) {
      const member = await prisma.user.findFirst({
        where: {
          id: memberId,
          teamId: currentUser.teamId,
        },
        select: { id: true },
      })

      if (!member) {
        return NextResponse.json({ error: '指定成员不存在或不属于当前团队' }, { status: 400 })
      }
    }

    const result = await syncPendingTasksBatch({
      ...scope,
      taskIds: taskIds.length > 0 ? taskIds : undefined,
      limit,
      attemptConfirm: true,
      bypassConfirmCooldown: false,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Sync pending tasks error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

