import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveActualCostYuan, resolveImageActualCostYuan } from '@/lib/modules/billing/cost'
import { requireSessionUser } from '@/lib/modules/auth/session'
import { getImageModelConfig, getImageModelPricingSummary } from '@/lib/modules/image/models'
import { getSeedanceBillingRangeLabel } from '@/lib/modules/provider/seedance/models'
import { getVideoModelConfig, getVideoModelPricingSummary } from '@/lib/modules/video/models'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type UnifiedTaskRecord = {
  id: string
  userId: string
  taskKind: 'video' | 'image'
  status: string
  mode: string
  model: string
  providerId: string
  providerModelId: string | null
  totalTokens: number
  costYuan: number
  generatedImages: number
  billingType: string | null
  resolution: string | null
  duration: number | null
  referenceAssets: Array<{ type: string | null }>
  promptExtend?: boolean | null
}

type AggregateBucket = {
  key: string
  label: string
  taskKind: 'video' | 'image'
  providerId: string
  providerLabel: string
  taskCount: number
  succeededTaskCount: number
  processingTaskCount: number
  generatedImages: number
  tokens: number
  cost: number
  pricingLabel?: string | null
}

function isProcessingStatus(status: string) {
  return ['processing', 'pending', 'queued', 'running', 'submit_unknown'].includes(status)
}

function resolveProviderLabel(providerId: string) {
  switch (providerId) {
    case 'aliyun':
      return '阿里云'
    case 'volcengine':
      return '火山引擎'
    case 'grsai':
      return 'GRSAI'
    default:
      return providerId
  }
}

function resolveUnifiedTaskCost(task: UnifiedTaskRecord) {
  if (task.taskKind === 'image') {
    return resolveImageActualCostYuan({
      costYuan: task.costYuan,
      generatedImages: task.generatedImages,
      model: task.model,
      promptExtend: task.promptExtend,
    })
  }

  return resolveActualCostYuan({
    costYuan: task.costYuan,
    totalTokens: task.totalTokens,
    billingType: task.billingType,
    duration: task.duration,
    resolution: task.resolution,
    referenceAssets: task.referenceAssets,
    model: task.model,
  })
}

function buildModeStats(tasks: UnifiedTaskRecord[]) {
  const statsByMode: Record<string, { count: number; tokens: number; cost: number; images: number }> = {}

  tasks.forEach((task) => {
    if (!statsByMode[task.mode]) {
      statsByMode[task.mode] = { count: 0, tokens: 0, cost: 0, images: 0 }
    }

    statsByMode[task.mode].count += 1

    if (task.status === 'succeeded') {
      statsByMode[task.mode].tokens += task.totalTokens
      statsByMode[task.mode].images += task.generatedImages
      statsByMode[task.mode].cost += resolveUnifiedTaskCost(task)
    }
  })

  return Object.fromEntries(
    Object.entries(statsByMode).map(([mode, data]) => [
      mode,
      {
        ...data,
        cost: Number(data.cost.toFixed(2)),
      },
    ]),
  )
}

function buildProviderStats(tasks: UnifiedTaskRecord[]) {
  const buckets = new Map<string, AggregateBucket>()

  tasks.forEach((task) => {
    const key = `${task.providerId}:${task.taskKind}`
    const providerLabel = resolveProviderLabel(task.providerId)
    const taskLabel = task.taskKind === 'video' ? '视频' : '图片'
    const current = buckets.get(key) || {
      key,
      label: `${providerLabel} ${taskLabel}`,
      taskKind: task.taskKind,
      providerId: task.providerId,
      providerLabel,
      taskCount: 0,
      succeededTaskCount: 0,
      processingTaskCount: 0,
      generatedImages: 0,
      tokens: 0,
      cost: 0,
      pricingLabel: null,
    }

    current.taskCount += 1
    if (task.status === 'succeeded') {
      current.succeededTaskCount += 1
      current.tokens += task.totalTokens
      current.generatedImages += task.generatedImages
      current.cost += resolveUnifiedTaskCost(task)
    }
    if (isProcessingStatus(task.status)) {
      current.processingTaskCount += 1
    }

    buckets.set(key, current)
  })

  return Array.from(buckets.values())
    .map((item) => ({
      ...item,
      cost: Number(item.cost.toFixed(2)),
    }))
    .sort((a, b) => b.cost - a.cost || b.taskCount - a.taskCount || a.label.localeCompare(b.label))
}

function buildModelStats(tasks: UnifiedTaskRecord[]) {
  const buckets = new Map<string, AggregateBucket & {
    model: string
    providerModelId: string | null
    modelLabel: string
  }>()

  tasks.forEach((task) => {
    const key = `${task.taskKind}:${task.model}`
    const providerLabel = resolveProviderLabel(task.providerId)
    const modelConfig = task.taskKind === 'image'
      ? getImageModelConfig(task.model)
      : getVideoModelConfig(task.model)
    const pricingLabel = task.taskKind === 'image'
      ? getImageModelPricingSummary(task.model)
      : getVideoModelPricingSummary(task.model, task.resolution)
    const current = buckets.get(key) || {
      key,
      label: modelConfig.label,
      modelLabel: modelConfig.label,
      model: task.model,
      providerModelId: task.providerModelId,
      taskKind: task.taskKind,
      providerId: task.providerId,
      providerLabel,
      taskCount: 0,
      succeededTaskCount: 0,
      processingTaskCount: 0,
      generatedImages: 0,
      tokens: 0,
      cost: 0,
      pricingLabel,
    }

    current.taskCount += 1
    if (task.status === 'succeeded') {
      current.succeededTaskCount += 1
      current.tokens += task.totalTokens
      current.generatedImages += task.generatedImages
      current.cost += resolveUnifiedTaskCost(task)
    }
    if (isProcessingStatus(task.status)) {
      current.processingTaskCount += 1
    }

    buckets.set(key, current)
  })

  return Array.from(buckets.values())
    .map((item) => ({
      ...item,
      cost: Number(item.cost.toFixed(2)),
    }))
    .sort((a, b) => b.cost - a.cost || b.taskCount - a.taskCount || a.modelLabel.localeCompare(b.modelLabel))
}

function buildSeedanceBilling(tasks: UnifiedTaskRecord[]) {
  let tokensWithVideo = 0
  let tokensWithoutVideo = 0
  let costWithVideo = 0
  let costWithoutVideo = 0

  tasks.forEach((task) => {
    if (task.taskKind !== 'video' || task.providerId !== 'volcengine' || task.status !== 'succeeded') {
      return
    }

    const hasVideo = task.billingType === 'with_video'
      || task.referenceAssets.some((asset) => asset.type === 'video')
    const cost = resolveUnifiedTaskCost(task)

    if (hasVideo) {
      tokensWithVideo += task.totalTokens
      costWithVideo += cost
      return
    }

    tokensWithoutVideo += task.totalTokens
    costWithoutVideo += cost
  })

  if (
    tokensWithVideo === 0
    && tokensWithoutVideo === 0
    && costWithVideo === 0
    && costWithoutVideo === 0
  ) {
    return null
  }

  return {
    withVideo: {
      tokens: tokensWithVideo,
      cost: Number(costWithVideo.toFixed(2)),
      rateLabel: getSeedanceBillingRangeLabel('with_video'),
    },
    withoutVideo: {
      tokens: tokensWithoutVideo,
      cost: Number(costWithoutVideo.toFixed(2)),
      rateLabel: getSeedanceBillingRangeLabel('without_video'),
    },
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
    const viewTeam = searchParams.get('viewTeam') === 'true'

    let userIds = [session.payload.userId]
    if (viewTeam && currentUser.role === 'admin' && currentUser.teamId) {
      const teamMembers = await prisma.user.findMany({
        where: { teamId: currentUser.teamId },
        select: { id: true },
      })
      userIds = teamMembers.map((member) => member.id)
    }

    const [videoTasks, imageTasks] = await Promise.all([
      prisma.generationTask.findMany({
        where: { userId: { in: userIds } },
        select: {
          id: true,
          userId: true,
          status: true,
          mode: true,
          model: true,
          providerId: true,
          providerModelId: true,
          totalTokens: true,
          costYuan: true,
          billingType: true,
          resolution: true,
          duration: true,
          referenceAssets: {
            select: { type: true },
          },
        },
      }),
      prisma.imageGenerationTask.findMany({
        where: { userId: { in: userIds } },
        select: {
          id: true,
          userId: true,
          status: true,
          mode: true,
          model: true,
          providerId: true,
          providerModelId: true,
          totalTokens: true,
          costYuan: true,
          generatedImages: true,
          promptExtend: true,
        },
      }),
    ])

    const unifiedTasks: UnifiedTaskRecord[] = [
      ...videoTasks.map((task) => ({
        id: task.id,
        userId: task.userId,
        taskKind: 'video' as const,
        status: task.status,
        mode: task.mode,
        model: task.model,
        providerId: task.providerId,
        providerModelId: task.providerModelId,
        totalTokens: task.totalTokens || 0,
        costYuan: task.costYuan || 0,
        generatedImages: 0,
        billingType: task.billingType,
        resolution: task.resolution,
        duration: task.duration,
        referenceAssets: task.referenceAssets,
      })),
      ...imageTasks.map((task) => ({
        id: task.id,
        userId: task.userId,
        taskKind: 'image' as const,
        status: task.status,
        mode: task.mode,
        model: task.model,
        providerId: task.providerId,
        providerModelId: task.providerModelId,
        totalTokens: task.totalTokens || 0,
        costYuan: task.costYuan || 0,
        generatedImages: task.generatedImages || 0,
        promptExtend: task.promptExtend,
        billingType: null,
        resolution: null,
        duration: null,
        referenceAssets: [],
      })),
    ]

    const totalTasks = unifiedTasks.length
    const succeededTasks = unifiedTasks.filter((task) => task.status === 'succeeded').length
    const failedTasks = unifiedTasks.filter((task) => ['failed', 'expired'].includes(task.status)).length
    const processingTasks = unifiedTasks.filter((task) => isProcessingStatus(task.status)).length
    const totalTokens = unifiedTasks.reduce(
      (sum, task) => sum + (task.status === 'succeeded' ? task.totalTokens : 0),
      0,
    )
    const totalCost = unifiedTasks.reduce(
      (sum, task) => sum + (task.status === 'succeeded' ? resolveUnifiedTaskCost(task) : 0),
      0,
    )
    const currentUserSucceededTasks = unifiedTasks.filter(
      (task) => task.userId === session.payload.userId && task.status === 'succeeded',
    )
    const currentUserUsedCost = currentUserSucceededTasks.reduce(
      (sum, task) => sum + resolveUnifiedTaskCost(task),
      0,
    )
    const currentUserUsedCostCents = Math.round(currentUserUsedCost * 100)
    const currentUserUsedTokens = currentUserSucceededTasks.reduce(
      (sum, task) => sum + task.totalTokens,
      0,
    )
    const currentUserAllocatedBudgetCents = Number(currentUser.allocatedBudget || 0)
    const currentUserReservedBudgetCents = Number(currentUser.reservedBudget || 0)

    const personalQuota = {
      allocatedYuan: (currentUserAllocatedBudgetCents / 100).toFixed(2),
      usedYuan: (currentUserUsedCostCents / 100).toFixed(2),
      reservedYuan: (currentUserReservedBudgetCents / 100).toFixed(2),
      availableYuan: (
        (currentUserAllocatedBudgetCents
          - currentUserUsedCostCents
          - currentUserReservedBudgetCents) / 100
      ).toFixed(2),
      allocatedTokens: currentUser.allocatedTokens?.toString() || '0',
      usedTokens: currentUserUsedTokens.toString(),
    }

    let teamStats = null
    if (currentUser.role === 'admin' && currentUser.teamId) {
      const [team, teamMembers] = await Promise.all([
        prisma.team.findUnique({
          where: { id: currentUser.teamId },
        }),
        prisma.user.findMany({
          where: { teamId: currentUser.teamId },
          select: {
            id: true,
            name: true,
            allocatedBudget: true,
            usedBudget: true,
            reservedBudget: true,
            allocatedTokens: true,
            usedTokens: true,
          },
        }),
      ])

      const memberStatsMap: Record<string, {
        tasks: number
        videoTasks: number
        imageTasks: number
        tokens: number
        cost: number
        videoCost: number
        imageCost: number
      }> = {}

      unifiedTasks.forEach((task) => {
        if (!memberStatsMap[task.userId]) {
          memberStatsMap[task.userId] = {
            tasks: 0,
            videoTasks: 0,
            imageTasks: 0,
            tokens: 0,
            cost: 0,
            videoCost: 0,
            imageCost: 0,
          }
        }

        const member = memberStatsMap[task.userId]
        member.tasks += 1
        if (task.taskKind === 'video') {
          member.videoTasks += 1
        } else {
          member.imageTasks += 1
        }

        if (task.status === 'succeeded') {
          const cost = resolveUnifiedTaskCost(task)
          member.tokens += task.totalTokens
          member.cost += cost
          if (task.taskKind === 'video') {
            member.videoCost += cost
          } else {
            member.imageCost += cost
          }
        }
      })

      const teamTotalBudgetCents = Number(team?.totalBudget || 0)
      const totalAllocatedToMembers = teamMembers.reduce(
        (sum, member) => sum + Number(member.allocatedBudget || 0),
        0,
      )
      const unallocatedBudgetCents = teamTotalBudgetCents - totalAllocatedToMembers
      const teamUsedBudgetCents = Math.round(
        Object.values(memberStatsMap).reduce((sum, member) => sum + member.cost, 0) * 100,
      )
      const teamUsedTokens = Object.values(memberStatsMap).reduce(
        (sum, member) => sum + member.tokens,
        0,
      )

      teamStats = {
        name: team?.name,
        totalBudgetYuan: (teamTotalBudgetCents / 100).toFixed(2),
        usedBudgetYuan: (teamUsedBudgetCents / 100).toFixed(2),
        allocatedBudgetYuan: (totalAllocatedToMembers / 100).toFixed(2),
        unallocatedBudgetYuan: (unallocatedBudgetCents / 100).toFixed(2),
        totalTokens: team?.totalTokens?.toString() || '0',
        usedTokens: teamUsedTokens.toString(),
        members: teamMembers.map((member) => {
          const stats = memberStatsMap[member.id] || {
            tasks: 0,
            videoTasks: 0,
            imageTasks: 0,
            tokens: 0,
            cost: 0,
            videoCost: 0,
            imageCost: 0,
          }
          const allocatedCents = Number(member.allocatedBudget || 0)
          const usedCents = Math.round(stats.cost * 100)
          const reservedCents = Number(member.reservedBudget || 0)

          return {
            id: member.id,
            name: member.name,
            allocatedYuan: (allocatedCents / 100).toFixed(2),
            usedYuan: (usedCents / 100).toFixed(2),
            reservedYuan: (reservedCents / 100).toFixed(2),
            availableYuan: ((allocatedCents - usedCents - reservedCents) / 100).toFixed(2),
            allocatedTokens: member.allocatedTokens?.toString() || '0',
            usedTokens: stats.tokens.toString(),
            taskCount: stats.tasks,
            videoTaskCount: stats.videoTasks,
            imageTaskCount: stats.imageTasks,
            tokenUsage: stats.tokens,
            totalCost: stats.cost.toFixed(2),
            videoCost: stats.videoCost.toFixed(2),
            imageCost: stats.imageCost.toFixed(2),
          }
        }),
      }
    }

    return NextResponse.json({
      overview: {
        totalTasks,
        succeededTasks,
        failedTasks,
        processingTasks,
        totalTokens,
        totalCost: Number(totalCost.toFixed(2)),
      },
      providerStats: buildProviderStats(unifiedTasks),
      modelStats: buildModelStats(unifiedTasks),
      seedanceBilling: buildSeedanceBilling(unifiedTasks),
      byMode: buildModeStats(unifiedTasks),
      personalQuota,
      teamStats,
      isAdmin: currentUser.role === 'admin',
    })
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
