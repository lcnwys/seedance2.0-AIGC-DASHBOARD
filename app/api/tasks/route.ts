import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveActualCostYuan } from '@/lib/modules/billing/cost'
import { requireSessionUser } from '@/lib/modules/auth/session'
import { resolveVideoTaskGenerationTimeSeconds } from '@/lib/modules/tasks/generation-time'
import {
  normalizePromptAstAssetLabels,
  orderReferenceAssets,
} from '@/lib/modules/tasks/reference-asset-order'
import { serializeToApiPayload } from '@/lib/slate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type TaskStatusFilter = 'all' | 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'submit_unknown'

const dashboardAssetSelect = {
  id: true,
  name: true,
  type: true,
  url: true,
  createdAt: true,
  duration: true,
  category: true,
  subjectType: true,
  subjectName: true,
}

function buildVideoWhereClause(statusFilter: TaskStatusFilter, userFilter: { userId?: string; userIds?: string[] }) {
  const whereClause: any = {}

  if (statusFilter !== 'all') {
    if (statusFilter === 'processing') {
      whereClause.status = { in: ['processing', 'pending', 'queued', 'running'] }
    } else if (statusFilter === 'failed') {
      whereClause.status = { in: ['failed', 'expired'] }
    } else if (statusFilter === 'refunded') {
      whereClause.status = { in: ['failed', 'expired'] }
      whereClause.billingType = 'refunded'
    } else if (statusFilter === 'submit_unknown') {
      whereClause.status = 'submit_unknown'
    } else if (statusFilter === 'pending') {
      whereClause.status = { in: ['pending', 'queued'] }
    } else {
      whereClause.status = statusFilter
    }
  }

  if (userFilter.userIds) {
    whereClause.userId = { in: userFilter.userIds }
  } else if (userFilter.userId) {
    whereClause.userId = userFilter.userId
  }

  return whereClause
}

function mapVideoTaskToDashboardTask(task: any) {
  const billingType =
    task.billingType ||
    (task.referenceAssets?.some((asset: any) => asset.type === 'video') ? 'with_video' : 'without_video')
  const costYuan = resolveActualCostYuan({
    costYuan: task.costYuan,
    totalTokens: task.totalTokens,
    billingType,
    duration: task.duration,
    resolution: task.resolution,
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
    ...task,
    taskKind: 'video',
    prompt: normalizedPrompt,
    promptAst: Array.isArray(normalizedPromptAst) ? normalizedPromptAst : promptAst,
    referenceAssets: orderedReferenceAssets,
    billingType,
    promptExtend: task.promptExtend !== false,
    seed: Number(task.seed),
    recordedCostYuan: task.costYuan === null || task.costYuan === undefined
      ? null
      : Number(task.costYuan.toFixed(6)),
    actualCostSource:
      task.costYuan !== null && task.costYuan !== undefined
        ? 'recorded'
        : costYuan > 0
          ? 'derived'
          : 'none',
    costYuan: Number(costYuan.toFixed(6)),
    generationTime: resolveVideoTaskGenerationTimeSeconds({
      generationTime: task.generationTime,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      status: task.status,
    }),
    submitter: task.user,
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }
    const currentUser = session.user as any

    const { searchParams } = new URL(request.url)
    const statusFilter = (searchParams.get('status') || 'all') as TaskStatusFilter
    const memberFilter = searchParams.get('member')
    const viewAll = searchParams.get('viewAll') === 'true'
    const includeImageTasks = searchParams.get('includeImageTasks') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    let userFilter: { userId?: string; userIds?: string[] } = {
      userId: session.payload.userId,
    }

    if (currentUser.role === 'admin' && currentUser.teamId && viewAll) {
      const teamMembers = await prisma.user.findMany({
        where: { teamId: currentUser.teamId },
        select: { id: true },
      })
      const memberIds = teamMembers.map((member) => member.id)

      if (memberFilter && memberFilter !== 'all') {
        userFilter = { userId: memberFilter }
      } else {
        userFilter = { userIds: memberIds }
      }
    }

    const videoWhereClause = buildVideoWhereClause(statusFilter, userFilter)

    if (!includeImageTasks) {
      const tasks = await prisma.generationTask.findMany({
        where: videoWhereClause,
        include: {
          referenceAssets: {
            select: dashboardAssetSelect,
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })

      const total = await prisma.generationTask.count({
        where: videoWhereClause,
      })

      let teamMembersForFilter = null
      if (currentUser.role === 'admin' && currentUser.teamId) {
        teamMembersForFilter = await prisma.user.findMany({
          where: { teamId: currentUser.teamId },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      }

      return NextResponse.json({
        tasks: tasks.map(mapVideoTaskToDashboardTask),
        isAdmin: currentUser.role === 'admin',
        teamMembers: teamMembersForFilter,
        pagination: {
          page,
          limit,
          total,
          hasMore: page * limit < total,
        },
      })
    }

    const take = Math.max(page * limit, limit)

    const [videoTasks, videoTotal, teamMembersForFilter] = await Promise.all([
      prisma.generationTask.findMany({
        where: videoWhereClause,
        include: {
          referenceAssets: {
            select: dashboardAssetSelect,
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      prisma.generationTask.count({ where: videoWhereClause }),
      currentUser.role === 'admin' && currentUser.teamId
        ? prisma.user.findMany({
            where: { teamId: currentUser.teamId },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve(null),
    ])

    const normalizedVideoTasks = videoTasks.map(mapVideoTaskToDashboardTask)

    const mergedTasks = normalizedVideoTasks
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice((page - 1) * limit, page * limit)

    const total = videoTotal

    return NextResponse.json({
      tasks: mergedTasks,
      isAdmin: currentUser.role === 'admin',
      teamMembers: teamMembersForFilter,
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    })
  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
