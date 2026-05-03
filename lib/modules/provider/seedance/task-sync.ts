import { prisma } from '@/lib/prisma'
import { getUserProviderConfig } from '@/lib/seedance-config'
import { settleTaskFailure } from '@/lib/modules/billing/task-settlement'
import type { ProviderNormalizedTask } from '@/lib/modules/provider/types'
import { confirmSingleUncertainTask } from '@/lib/modules/provider/seedance/uncertain-task-claimer'
import { finalizeVideoTaskSuccess } from '@/lib/modules/tasks/finalize-video-task-success'
import { resolveVideoGenerationAdapterForTask } from '@/lib/modules/video/adapters/resolve'

export const SYNCABLE_TASK_STATUSES = ['pending', 'queued', 'processing', 'running', 'submit_unknown'] as const
export const TERMINAL_TASK_STATUSES = ['succeeded', 'failed', 'expired', 'cancelled', 'completed'] as const
const DEFAULT_BATCH_LIMIT = 50

type LoadedTask = any

function buildSyncableWhere(params: {
  userId?: string
  teamId?: string
  memberId?: string | null
  taskIds?: string[]
}) {
  const where: any = {
    status: { in: [...SYNCABLE_TASK_STATUSES] },
  }

  if (params.taskIds && params.taskIds.length > 0) {
    where.id = { in: params.taskIds }
  }

  if (params.userId) {
    where.userId = params.userId
  }

  if (params.memberId) {
    where.userId = params.memberId
  }
  else if (params.teamId) {
    where.user = { teamId: params.teamId }
  }

  return where
}

async function loadSyncableTask(taskId: string) {
  return prisma.generationTask.findUnique({
    where: { id: taskId },
    include: {
      referenceAssets: {
        select: { type: true },
      },
      user: {
        select: {
          id: true,
        },
      },
    },
  }) as Promise<LoadedTask | null>
}

async function resolveTaskConfig(task: LoadedTask) {
  if (!task.user?.id) {
    return null
  }

  return getUserProviderConfig(task.user.id, task.providerId)
}

async function applyRemoteTaskState(task: LoadedTask, remoteData: ProviderNormalizedTask) {
  const provider = resolveVideoGenerationAdapterForTask({
    model: task.model,
    providerId: task.providerId,
  })
  const generationTime = provider.getTaskGenerationTimeSeconds(remoteData)
  const localStatus = provider.mapStatusToLocal(remoteData.status)

  if (localStatus === 'succeeded') {
    const updatedTask = await finalizeVideoTaskSuccess({
      taskId: task.id,
      remoteVideoUrl: remoteData.video_path,
      completionTokens: remoteData.completion_tokens,
      totalTokens: remoteData.total_tokens,
      generationTime,
      costYuan: remoteData.cost,
      errorMessage: null,
    })

    return {
      outcome: 'synced' as const,
      task: updatedTask,
      status: updatedTask.status,
      source: 'poll' as const,
    }
  }

  if (['failed', 'expired', 'cancelled'].includes(localStatus)) {
    const failureResult = await settleTaskFailure(task.id, {
      status: localStatus,
      outputUrl: remoteData.video_path || task.outputUrl,
      completionTokens: remoteData.completion_tokens,
      totalTokens: 0,
      generationTime,
      costYuan: 0,
      errorMessage: remoteData.error_message || task.errorMessage,
    })

    return {
      outcome: 'synced' as const,
      task: failureResult.task,
      status: failureResult.task.status,
      source: 'poll' as const,
    }
  }

  const updateData: any = {
    status: localStatus,
    outputUrl: remoteData.video_path || task.outputUrl,
    completionTokens: remoteData.completion_tokens,
    totalTokens: remoteData.total_tokens,
    costYuan: task.costYuan,
    errorMessage: remoteData.error_message || task.errorMessage,
  }

  if (generationTime !== null && !task.generationTime) {
    updateData.generationTime = generationTime
  }

  const updatedTask = await prisma.generationTask.update({
    where: { id: task.id },
    data: updateData,
  })

  return {
    outcome: 'synced' as const,
    task: updatedTask,
    status: updatedTask.status,
    source: 'poll' as const,
  }
}

export async function syncSingleTaskById(params: {
  taskId: string
  attemptConfirm?: boolean
  bypassConfirmCooldown?: boolean
}) {
  const task = await loadSyncableTask(params.taskId)
  if (!task) {
    throw new Error(`Task not found: ${params.taskId}`)
  }

  if (TERMINAL_TASK_STATUSES.includes(task.status)) {
    return {
      outcome: 'terminal' as const,
      task,
      status: task.status,
    }
  }

  const taskConfig = await resolveTaskConfig(task)
  if (!taskConfig?.apiKey) {
    return {
      outcome: 'skipped' as const,
      reason: 'missing_api_key',
      task,
      status: task.status,
    }
  }

  if (
    task.providerId === 'volcengine'
    && task.status === 'submit_unknown'
    && !task.externalId
    && params.attemptConfirm !== false
  ) {
    const confirmation = await confirmSingleUncertainTask({
      taskId: task.id,
      apiUrl: taskConfig.apiUrl,
      apiKey: taskConfig.apiKey,
      bypassCooldown: params.bypassConfirmCooldown,
    })

    if (confirmation.outcome === 'confirmed') {
      return {
        outcome: 'synced' as const,
        task: confirmation.task,
        status: confirmation.task.status,
        source: 'confirm' as const,
      }
    }

    return {
      outcome: confirmation.outcome,
      reason: confirmation.reason,
      task,
      status: task.status,
      retryAfterMs: (confirmation as any).retryAfterMs,
      candidates: (confirmation as any).candidates || [],
    }
  }

  if (!task.externalId) {
    return {
      outcome: 'skipped' as const,
      reason: 'missing_external_id',
      task,
      status: task.status,
    }
  }

  const provider = resolveVideoGenerationAdapterForTask({
    model: task.model,
    providerId: task.providerId,
  })
  const remoteData = await provider.getTask({
    apiUrl: taskConfig.apiUrl,
    apiKey: taskConfig.apiKey,
    taskId: task.externalId,
    model: task.model,
  })
  return applyRemoteTaskState(task, remoteData)
}

export async function syncPendingTasksBatch(params: {
  userId?: string
  teamId?: string
  memberId?: string | null
  taskIds?: string[]
  limit?: number
  attemptConfirm?: boolean
  bypassConfirmCooldown?: boolean
}) {
  const tasks = await prisma.generationTask.findMany({
    where: buildSyncableWhere({
      userId: params.userId,
      teamId: params.teamId,
      memberId: params.memberId,
      taskIds: params.taskIds,
    }),
    orderBy: { updatedAt: 'asc' },
    take: params.limit || DEFAULT_BATCH_LIMIT,
  })

  const summary = {
    checked: tasks.length,
    synced: 0,
    changedToTerminal: 0,
    confirmed: 0,
    skipped: 0,
    failed: 0,
  }

  const details = {
    syncedTaskIds: [] as string[],
    skipped: [] as Array<{ taskId: string; reason: string }>,
    failed: [] as Array<{ taskId: string; error: string }>,
  }

  for (const task of tasks) {
    try {
      const result = await syncSingleTaskById({
        taskId: task.id,
        attemptConfirm: params.attemptConfirm,
        bypassConfirmCooldown: params.bypassConfirmCooldown,
      })

      if (result.outcome === 'synced') {
        summary.synced += 1
        details.syncedTaskIds.push(task.id)
        if (result.source === 'confirm') {
          summary.confirmed += 1
        }
        if (TERMINAL_TASK_STATUSES.includes(result.status as any)) {
          summary.changedToTerminal += 1
        }
        continue
      }

      summary.skipped += 1
      details.skipped.push({
        taskId: task.id,
        reason: result.reason || result.outcome,
      })
    } catch (error: any) {
      summary.failed += 1
      details.failed.push({
        taskId: task.id,
        error: error?.message || 'sync failed',
      })
    }
  }

  return {
    summary,
    details,
  }
}
