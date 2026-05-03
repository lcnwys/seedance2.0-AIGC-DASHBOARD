import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/lib/modules/auth/session'
import { getUserProviderConfig } from '@/lib/seedance-config'
import { settleTaskFailure } from '@/lib/modules/billing/task-settlement'
import { resolveVideoGenerationAdapterForTask } from '@/lib/modules/video/adapters/resolve'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CANCELLABLE_TASK_STATUSES = ['pending', 'queued', 'processing', 'running', 'submit_unknown']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }
    const userId = session.payload.userId

    // Await params in Next.js 15
    const { id: taskId } = await params

    const task = await prisma.generationTask.findFirst({
      where: {
        id: taskId,
        userId,
      },
      include: {
        referenceAssets: {
          select: { id: true, name: true, type: true, url: true },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Get task error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }
    const userId = session.payload.userId
    const { id: taskId } = await params

    const task = await prisma.generationTask.findFirst({
      where: {
        id: taskId,
        userId,
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (!task.externalId) {
      if (CANCELLABLE_TASK_STATUSES.includes(task.status)) {
        await settleTaskFailure(task.id, {
          status: 'cancelled',
          errorMessage: '任务已取消',
        })
      }
      await prisma.generationTask.delete({ where: { id: task.id } })

      return NextResponse.json({
        success: true,
        operation: 'deleted_local',
        deletedTaskId: task.id,
      })
    }

    if (!CANCELLABLE_TASK_STATUSES.includes(task.status)) {
      await prisma.generationTask.delete({
        where: { id: task.id },
      })

      return NextResponse.json({
        success: true,
        operation: 'deleted_local',
        deletedTaskId: task.id,
      })
    }

    const provider = resolveVideoGenerationAdapterForTask({
      model: task.model,
      providerId: (task as any).providerId,
    })
    const seedanceConfig = await getUserProviderConfig(userId, (task as any).providerId)
    if (!seedanceConfig?.apiKey) {
      return NextResponse.json({ error: `${provider.label} API Key not configured` }, { status: 400 })
    }

    await provider.deleteTask({
      apiUrl: seedanceConfig.apiUrl,
      apiKey: seedanceConfig.apiKey,
      taskId: task.externalId,
    })

    await settleTaskFailure(task.id, {
      status: 'cancelled',
      errorMessage: '任务已取消',
    })

    await prisma.generationTask.delete({
      where: { id: task.id },
    })

    return NextResponse.json({
      success: true,
      operation: 'deleted',
      deletedTaskId: task.id,
    })
  } catch (error: any) {
    const message = error.response?.data?.error?.message
      || error.response?.data?.message
      || error.message
      || 'Internal server error'

    console.error('Delete task error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
