import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/lib/modules/auth/session'
import { resolveActualCostYuan, resolveImageActualCostYuan } from '@/lib/modules/billing/cost'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function shouldCountEstimatedVideoTask(task: {
  status: string
  billingType: string | null
}) {
  if (task.billingType === 'refunded') return false
  if (task.status === 'failed' || task.status === 'expired') return false
  return true
}

function shouldCountEstimatedImageTask(task: {
  status: string
}) {
  return task.status !== 'failed' && task.status !== 'expired'
}

function estimateImageOutputCount(task: {
  sequentialImageGeneration: string
  maxImages: number | null
}) {
  if (task.sequentialImageGeneration === 'auto') {
    return Math.max(1, task.maxImages || 4)
  }
  return 1
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionUser(request, {
      select: { role: true, teamId: true },
    })
    if ('response' in session) {
      return session.response
    }
    const currentUser = session.user

    const { searchParams } = new URL(request.url)
    const viewTeam = searchParams.get('viewTeam') === 'true'

    let userIds = [session.payload.userId]
    if (viewTeam && currentUser.role === 'admin' && currentUser.teamId) {
      const teamMembers = await prisma.user.findMany({
        where: { teamId: currentUser.teamId },
        select: { id: true },
      })
      userIds = teamMembers.map(member => member.id)
    }

    const [videoTasks, imageTasks] = await Promise.all([
      prisma.generationTask.findMany({
        where: { userId: { in: userIds } },
        select: {
          status: true,
          model: true,
          estimatedTokens: true,
          estimatedCostCents: true,
          totalTokens: true,
          actualCostCents: true,
          costYuan: true,
          billingType: true,
          duration: true,
          resolution: true,
          referenceAssets: {
            select: { type: true },
          },
        },
      }),
      prisma.imageGenerationTask.findMany({
        where: { userId: { in: userIds } },
        select: {
          status: true,
          model: true,
          totalTokens: true,
          generatedImages: true,
          costYuan: true,
          maxImages: true,
          sequentialImageGeneration: true,
          promptExtend: true,
        },
      }),
    ])

    const estimatedVideoTasks = videoTasks.filter(shouldCountEstimatedVideoTask)
    const estimatedImageTasks = imageTasks.filter(shouldCountEstimatedImageTask)

    const estimated = {
      tokens: estimatedVideoTasks.reduce((sum, task) => sum + (task.estimatedTokens || 0), 0),
      costCents: estimatedVideoTasks.reduce((sum, task) => sum + (task.estimatedCostCents || 0), 0),
      images: estimatedImageTasks.reduce((sum, task) => sum + estimateImageOutputCount(task), 0),
    }

    const actual = {
      tokens: 0,
      costYuan: 0,
      images: 0,
    }

    videoTasks.forEach((task) => {
      if (task.status !== 'succeeded') return

      actual.tokens += task.totalTokens || 0
      actual.costYuan += resolveActualCostYuan({
        costYuan: task.costYuan,
        actualCostCents: task.actualCostCents,
        totalTokens: task.totalTokens,
        billingType: task.billingType,
        duration: task.duration,
        resolution: task.resolution,
        referenceAssets: task.referenceAssets,
        model: task.model,
      })
    })

    imageTasks.forEach((task) => {
      if (task.status !== 'succeeded') return

      actual.tokens += task.totalTokens || 0
      actual.images += task.generatedImages || 0
      actual.costYuan += resolveImageActualCostYuan({
        costYuan: task.costYuan,
        generatedImages: task.generatedImages,
        model: task.model,
        promptExtend: task.promptExtend,
      })
    })

    return NextResponse.json({
      scope: viewTeam && currentUser.role === 'admin' && currentUser.teamId ? 'team' : 'personal',
      estimatedTokens: estimated.tokens,
      estimatedYuan: (estimated.costCents / 100).toFixed(2),
      estimatedImageCount: estimated.images,
      actualTokens: actual.tokens,
      actualYuan: actual.costYuan.toFixed(2),
      actualImageCount: actual.images,
      taskCount: videoTasks.length + imageTasks.length,
      estimatedTaskCount: estimatedVideoTasks.length + estimatedImageTasks.length,
      succeededTaskCount:
        videoTasks.filter(task => task.status === 'succeeded').length
        + imageTasks.filter(task => task.status === 'succeeded').length,
    })
  } catch (error) {
    console.error('Get consumption stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
