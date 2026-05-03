import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { getTeamProviderConfigByTeamId } from '@/lib/seedance-config'
import { confirmSingleUncertainTask } from '@/lib/modules/provider/seedance/uncertain-task-claimer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const currentUser = await (prisma.user.findUnique as any)({
      where: { id: payload.userId },
      select: { isSuperAdmin: true },
    })

    if (!currentUser?.isSuperAdmin) {
      return NextResponse.json({ error: '权限不足：仅系统管理员可访问' }, { status: 403 })
    }

    const { teamId } = await params

    const team = await (prisma as any).team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    if (!team) {
      return NextResponse.json({ error: '团队不存在' }, { status: 404 })
    }

    const seedanceConfig = await getTeamProviderConfigByTeamId(teamId)

    if (seedanceConfig?.providerId !== 'volcengine') {
      return NextResponse.json({ error: '该团队当前默认视频供应商不是火山，无法使用火山自动确认' }, { status: 400 })
    }

    if (!seedanceConfig?.apiKeyConfigured) {
      return NextResponse.json({ error: '该团队未配置 API Key，无法自动确认' }, { status: 400 })
    }

    const memberIds = team.members.map((member: any) => member.id)
    const localTasks = await prisma.generationTask.findMany({
      where: {
        userId: { in: memberIds },
        status: 'submit_unknown',
        externalId: null,
      },
      include: {
        user: {
          select: { email: true, name: true },
        },
        referenceAssets: {
          select: { type: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    }) as any[]

    const summary = {
      total: localTasks.length,
      confirmed: 0,
      succeeded: 0,
      failed: 0,
      stillProcessing: 0,
      unmatched: 0,
      ambiguous: 0,
    }

    const details = {
      confirmed: [] as Array<{ localTaskId: string; upstreamTaskId: string; status: string; user: string | null | undefined }>,
      unmatched: [] as Array<{ localTaskId: string; user: string | null | undefined }>,
      ambiguous: [] as Array<{ localTaskId: string; candidates: string[]; user: string | null | undefined }>,
    }

    for (const task of localTasks) {
      const result = await confirmSingleUncertainTask({
        taskId: task.id,
        apiUrl: seedanceConfig.apiUrl,
        apiKey: seedanceConfig.apiKey,
        bypassCooldown: true,
      })

      if (result.outcome !== 'confirmed') {
        if (result.outcome === 'ambiguous') {
          summary.ambiguous++
          details.ambiguous.push({
            localTaskId: task.id,
            candidates: result.candidates || [],
            user: task.user?.email,
          })
        } else if (result.outcome === 'unmatched') {
          summary.unmatched++
          details.unmatched.push({
            localTaskId: task.id,
            user: task.user?.email,
          })
        }
        continue
      }

      if (result.status === 'succeeded') {
        summary.succeeded++
      } else if (result.status === 'failed' || result.status === 'expired') {
        summary.failed++
      } else {
        summary.stillProcessing++
      }

      summary.confirmed++
      details.confirmed.push({
        localTaskId: task.id,
        upstreamTaskId: result.upstreamTaskId,
        status: result.status,
        user: task.user?.email,
      })
    }

    return NextResponse.json({
      message: '自动确认完成',
      summary,
      details,
    })
  } catch (error: any) {
    console.error('Confirm uncertain tasks error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
