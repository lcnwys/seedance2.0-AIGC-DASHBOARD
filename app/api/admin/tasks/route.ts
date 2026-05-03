import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { resolveActualCostYuan } from '@/lib/modules/billing/cost'
import {
  normalizePromptAstAssetLabels,
  orderReferenceAssets,
} from '@/lib/modules/tasks/reference-asset-order'
import { serializeToApiPayload } from '@/lib/slate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/tasks
 * 系统管理员接口：获取所有团队的任务列表
 * 
 * 支持筛选：
 * - teamId: 团队 ID
 * - status: 任务状态
 * - userId: 用户 ID
 * - startDate: 开始日期
 * - endDate: 结束日期
 * - page: 页码
 * - pageSize: 每页数量
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 验证是否为系统管理员
    const currentUser = await (prisma.user.findUnique as any)({
      where: { id: payload.userId },
      select: { isSuperAdmin: true },
    })

    if (!currentUser?.isSuperAdmin) {
      return NextResponse.json({ error: '权限不足：仅系统管理员可访问' }, { status: 403 })
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    // 构建查询条件
    const whereClause: any = {}

    // 团队筛选
    if (teamId && teamId !== 'all') {
      // 获取团队成员 ID
      const teamMembers = await (prisma.user.findMany as any)({
        where: { teamId },
        select: { id: true },
      })
      const memberIds = teamMembers.map((m: any) => m.id)
      whereClause.userId = { in: memberIds }
    }

    // 用户筛选
    if (userId && userId !== 'all') {
      whereClause.userId = userId
    }

    // 状态筛选
    if (status && status !== 'all') {
      if (status === 'processing') {
        whereClause.status = { in: ['queued', 'running'] }
      } else if (status === 'refunded') {
        whereClause.status = { in: ['failed', 'expired'] }
        whereClause.billingType = 'refunded'
      } else if (status === 'submit_unknown') {
        whereClause.status = 'submit_unknown'
      } else {
        whereClause.status = status
      }
    }

    // 时间筛选
    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        whereClause.createdAt.lte = end
      }
    }

    // 获取总数
    const total = await prisma.generationTask.count({ where: whereClause })

    // 获取任务列表
    const tasks = await prisma.generationTask.findMany({
      where: whereClause,
      include: {
        referenceAssets: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            teamId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    // 获取团队信息（用于显示团队名称）
    const teamIds = [...new Set(tasks.map((t: any) => t.user?.teamId).filter(Boolean))]
    const teamsData = await (prisma as any).team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true },
    })
    const teamMap = new Map(teamsData.map((t: any) => [t.id, t.name]))

    // 处理任务数据
    const tasksWithDetails = tasks.map((task: any) => {
      // 计算费用：优先使用已保存的 billingType，否则根据 mode 推断
      // reference/video_edit/video_extend/first_clip 都可能包含视频输入
      const hasVideoInput = ['video_edit', 'video_extend', 'reference', 'first_clip'].includes(task.mode)
      const billingType = task.billingType || (hasVideoInput ? 'with_video' : 'without_video')
      const costYuan = resolveActualCostYuan({
        costYuan: task.costYuan,
        totalTokens: task.totalTokens,
        billingType,
        referenceAssets: task.referenceAssets,
        model: task.model,
      })

      let promptAst = null
      if (task.promptAst) {
        try {
          promptAst = JSON.parse(task.promptAst)
        } catch {
          promptAst = null
        }
      }

      const orderedReferenceAssets = orderReferenceAssets(task.referenceAssets, {
        promptAst,
        storedOrder: task.referenceAssetOrder,
      })
      const normalizedPromptAstResult = normalizePromptAstAssetLabels(promptAst, orderedReferenceAssets)
      const normalizedPromptAst = normalizedPromptAstResult.promptAst
      const normalizedPrompt = Array.isArray(normalizedPromptAst)
        ? serializeToApiPayload(normalizedPromptAst as any).prompt
        : task.prompt

      return {
        id: task.id,
        externalId: task.externalId,
        providerId: task.providerId,
        providerModelId: task.providerModelId,
        modelKey: task.modelKey,
        mode: task.mode,
        model: task.model,
        prompt: normalizedPrompt,
        promptAst: Array.isArray(normalizedPromptAst) ? normalizedPromptAst : promptAst,
        status: task.status,
        outputUrl: task.outputUrl,
        errorMessage: task.errorMessage,
        totalTokens: task.totalTokens,
        completionTokens: task.completionTokens,
        estimatedTokens: task.estimatedTokens,
        ratio: task.ratio,
        resolution: task.resolution,
        duration: task.duration,
        generateAudio: task.generateAudio,
        promptExtend: task.promptExtend !== false,
        seed: Number(task.seed),
        billingType,
        costYuan: Number(costYuan.toFixed(6)),
        generationTime: task.generationTime,
        referenceAssets: orderedReferenceAssets,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        user: {
          id: task.user?.id,
          name: task.user?.name,
          email: task.user?.email,
        },
        team: {
          id: task.user?.teamId,
          name: task.user?.teamId ? teamMap.get(task.user.teamId) : null,
        },
        submitter: {
          id: task.user?.id,
          name: task.user?.name,
          email: task.user?.email,
        },
      }
    })

    // 获取所有团队列表（用于筛选下拉框）
    const allTeams = await (prisma as any).team.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    // 获取所有用户列表（按团队分组）
    const allUsers = await (prisma.user.findMany as any)({
      select: { id: true, name: true, email: true, teamId: true },
      orderBy: { name: 'asc' },
    })

    // 统计汇总
    const statsQuery: any = { ...whereClause }
    const [succeededCount, totalTokensSum] = await Promise.all([
      prisma.generationTask.count({ where: { ...statsQuery, status: 'succeeded' } }),
      prisma.generationTask.aggregate({
        where: { ...statsQuery, status: 'succeeded' },
        _sum: { totalTokens: true },
      }),
    ])

    return NextResponse.json({
      tasks: tasksWithDetails,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      stats: {
        total,
        succeeded: succeededCount,
        totalTokens: totalTokensSum._sum.totalTokens || 0,
      },
      filters: {
        teams: allTeams,
        users: allUsers,
      },
    })
  } catch (error: any) {
    console.error('Admin tasks API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
