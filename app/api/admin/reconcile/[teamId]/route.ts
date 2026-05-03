import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { getTeamProviderConfigByTeamId } from '@/lib/seedance-config'
import type { ProviderNormalizedTask } from '@/lib/modules/provider/types'
import { getVideoGenerationAdapterByProviderId } from '@/lib/modules/video/adapters/registry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VIDEO_PROVIDER = getVideoGenerationAdapterByProviderId('volcengine')

type TeamMemberSummary = {
  id: string
  email: string | null
  name: string | null
}

type TeamWithMembers = {
  id: string
  name: string | null
  members: TeamMemberSummary[]
}

/**
 * GET /api/admin/reconcile/[teamId]
 * 系统管理员接口：对账核查 - 对比本地数据与上游数据
 */
export async function GET(
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

    const currentUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isSuperAdmin: true },
    })

    if (!currentUser?.isSuperAdmin) {
      return NextResponse.json({ error: '权限不足：仅系统管理员可访问' }, { status: 403 })
    }

    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }
    const hasDateFilter = Boolean(dateFilter.gte || dateFilter.lte)

    const team = await ((prisma as unknown as {
      team: {
        findUnique: (args: unknown) => Promise<TeamWithMembers | null>
      }
    }).team.findUnique({
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
    }))

    if (!team) {
      return NextResponse.json({ error: '团队不存在' }, { status: 404 })
    }

    const seedanceConfig = await getTeamProviderConfigByTeamId(teamId)

    if (seedanceConfig?.providerId !== 'volcengine') {
      return NextResponse.json({ error: '该团队当前默认视频供应商不是火山，无法使用火山对账' }, { status: 400 })
    }

    if (!seedanceConfig?.apiKeyConfigured) {
      return NextResponse.json({ error: '该团队未配置 API Key，无法对账' }, { status: 400 })
    }

    let upstreamError: string | null = null
    let upstreamTasks: ProviderNormalizedTask[] = []

    try {
      const response = await VIDEO_PROVIDER.listAllTasks({
        apiUrl: seedanceConfig.apiUrl,
        apiKey: seedanceConfig.apiKey,
        pageSize: 200,
      })

      upstreamTasks = response.items
    } catch (error: unknown) {
      const upstreamMessage = error instanceof Error ? error.message : null
      const axiosLikeError = error as {
        response?: {
          data?: {
            error?: { message?: string }
            message?: string
          }
        }
      }

      upstreamError = axiosLikeError.response?.data?.error?.message
        || axiosLikeError.response?.data?.message
        || upstreamMessage
        || '上游接口调用失败'
    }

    const memberIds = team.members.map((member) => member.id)
    const memberMap = new Map<string, TeamMemberSummary>(
      team.members.map((member) => [member.id, member])
    )

    const localTasks = await prisma.generationTask.findMany({
      where: {
        userId: { in: memberIds },
        status: 'succeeded',
        ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      },
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const localUncertainTasks = await prisma.generationTask.findMany({
      where: {
        userId: { in: memberIds },
        status: 'submit_unknown',
        ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      },
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const localStats = {
      taskCount: localTasks.length,
      totalTokens: localTasks.reduce((sum, task) => sum + (task.totalTokens || 0), 0),
      costYuan: localTasks.reduce((sum, task) => sum + (task.costYuan || 0), 0),
    }

    const localByUser: Record<string, { taskCount: number; totalTokens: number; costYuan: number }> = {}
    for (const task of localTasks) {
      const email = task.user?.email || 'unknown'
      if (!localByUser[email]) {
        localByUser[email] = { taskCount: 0, totalTokens: 0, costYuan: 0 }
      }
      localByUser[email].taskCount += 1
      localByUser[email].totalTokens += task.totalTokens || 0
      localByUser[email].costYuan += task.costYuan || 0
    }

    let comparison: Record<string, unknown> | null = null
    let differences: Record<string, unknown> | null = null

    if (!upstreamError) {
      const filteredUpstreamTasks = upstreamTasks.filter((task) => {
        if (!task.user_id || !memberMap.has(task.user_id)) {
          return false
        }

        const taskDate = new Date(task.created_at * 1000)
        if (dateFilter.gte && taskDate < dateFilter.gte) return false
        if (dateFilter.lte && taskDate > dateFilter.lte) return false
        return true
      })

      const upstreamStats = {
        taskCount: filteredUpstreamTasks.length,
        totalTokens: filteredUpstreamTasks.reduce((sum, task) => sum + (task.total_tokens || 0), 0),
      }

      const upstreamByUser: Record<string, { taskCount: number; totalTokens: number }> = {}
      for (const task of filteredUpstreamTasks) {
        const email = memberMap.get(task.user_id || '')?.email || 'unknown'
        if (!upstreamByUser[email]) {
          upstreamByUser[email] = { taskCount: 0, totalTokens: 0 }
        }
        upstreamByUser[email].taskCount += 1
        upstreamByUser[email].totalTokens += task.total_tokens || 0
      }

      const localTaskIds = new Set(localTasks.map((task) => task.externalId).filter(Boolean))
      const upstreamTaskIds = new Set(filteredUpstreamTasks.map((task) => task.task_id))

      const missingLocally = filteredUpstreamTasks.filter((task) => !localTaskIds.has(task.task_id))
      const extraLocally = localTasks.filter((task) => task.externalId && !upstreamTaskIds.has(task.externalId))

      const tokenMismatch: Array<{
        taskId: string
        localTokens: number | null
        upstreamTokens: number
        diff: number
      }> = []

      for (const localTask of localTasks) {
        if (!localTask.externalId) continue
        const upstreamTask = filteredUpstreamTasks.find((task) => task.task_id === localTask.externalId)
        if (upstreamTask && localTask.totalTokens !== upstreamTask.total_tokens) {
          tokenMismatch.push({
            taskId: localTask.externalId,
            localTokens: localTask.totalTokens,
            upstreamTokens: upstreamTask.total_tokens,
            diff: upstreamTask.total_tokens - (localTask.totalTokens || 0),
          })
        }
      }

      comparison = {
        local: localStats,
        upstream: upstreamStats,
        diff: {
          taskCount: upstreamStats.taskCount - localStats.taskCount,
          totalTokens: upstreamStats.totalTokens - localStats.totalTokens,
        },
        byUser: {
          local: localByUser,
          upstream: upstreamByUser,
        },
      }

      differences = {
        missingLocally: missingLocally.map((task) => ({
          taskId: task.task_id,
          user: memberMap.get(task.user_id || '')?.email || null,
          totalTokens: task.total_tokens,
          createdAt: new Date(task.created_at * 1000).toISOString(),
          status: task.status,
        })),
        submitUnknownLocally: localUncertainTasks.map((task) => ({
          taskId: task.id,
          user: task.user?.email,
          prompt: task.prompt,
          createdAt: task.createdAt,
          status: task.status,
          estimatedTokens: task.estimatedTokens,
          errorMessage: task.errorMessage,
        })),
        extraLocally: extraLocally.map((task) => ({
          taskId: task.externalId,
          user: task.user?.email,
          totalTokens: task.totalTokens,
          createdAt: task.createdAt,
          status: task.status,
        })),
        tokenMismatch,
        summary: {
          missingCount: missingLocally.length,
          uncertainCount: localUncertainTasks.length,
          extraCount: extraLocally.length,
          mismatchCount: tokenMismatch.length,
          isConsistent:
            missingLocally.length === 0 &&
            localUncertainTasks.length === 0 &&
            extraLocally.length === 0 &&
            tokenMismatch.length === 0,
        },
      }

      upstreamTasks = filteredUpstreamTasks
    }

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        providerId: seedanceConfig.providerId,
        apiKeyName: seedanceConfig.apiKeyConfigured ? 'team-configured' : null,
      },
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      localStats,
      upstreamError,
      comparison,
      differences,
      rawUpstream: upstreamError ? null : {
        taskCount: upstreamTasks.length,
        totalTokensSum: upstreamTasks.reduce((sum, task) => sum + (task.total_tokens || 0), 0),
        tasks: upstreamTasks,
      },
    })
  } catch (error: unknown) {
    console.error('Admin reconcile API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
