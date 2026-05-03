import { prisma } from '@/lib/prisma'
import { importRemoteVideoToAsset } from '@/lib/modules/assets/import-remote-asset'
import { resolveTaskOutputVideoDuration } from '@/lib/modules/tasks/output-video-duration'
import { settleTaskSuccess } from '@/lib/modules/billing/task-settlement'
import { shouldUseObjectStorage } from '@/lib/object-storage'
import { getUserProviderConfig } from '@/lib/seedance-config'

const inFlightVideoTaskSuccessFinalizations = new Map<string, Promise<unknown>>()
const TERMINAL_TASK_STATUSES = new Set(['succeeded', 'failed', 'expired', 'cancelled', 'completed'])

async function loadTaskForFinalization(taskId: string) {
  return prisma.generationTask.findUnique({
    where: { id: taskId },
    include: {
      referenceAssets: true,
      user: true,
    },
  })
}

async function withVideoTaskSuccessLock<T>(taskId: string, factory: () => Promise<T>) {
  const existing = inFlightVideoTaskSuccessFinalizations.get(taskId)
  if (existing) {
    return existing as Promise<T>
  }

  const promise = factory().finally(() => {
    if (inFlightVideoTaskSuccessFinalizations.get(taskId) === promise) {
      inFlightVideoTaskSuccessFinalizations.delete(taskId)
    }
  })

  inFlightVideoTaskSuccessFinalizations.set(taskId, promise)
  return promise
}

export async function finalizeVideoTaskSuccess(params: {
  taskId: string
  remoteVideoUrl?: string | null
  completionTokens?: number | null
  totalTokens?: number | null
  generationTime?: number | null
  costYuan?: number | null
  errorMessage?: string | null
}) {
  return withVideoTaskSuccessLock(params.taskId, async () => {
    const task = await loadTaskForFinalization(params.taskId)

    if (!task) {
      throw new Error(`Task not found: ${params.taskId}`)
    }

    if (TERMINAL_TASK_STATUSES.has(task.status)) {
      return task
    }

    let persistedVideoUrl = params.remoteVideoUrl || task.outputUrl
    const shouldPersistRemoteVideo = Boolean(
      params.remoteVideoUrl && (!task.outputUrl || task.outputUrl === params.remoteVideoUrl)
    )

    if (shouldPersistRemoteVideo && params.remoteVideoUrl) {
      const providerConfig = await getUserProviderConfig(task.userId, task.providerId)
      const shouldPersistToAssetLibrary = shouldUseObjectStorage()

      if (shouldPersistToAssetLibrary) {
        const asset = await importRemoteVideoToAsset({
          userId: task.userId,
          sourceUrl: params.remoteVideoUrl,
          fileBaseName: `${task.modelKey || task.model || 'generated-video'}-${task.id}`,
          duration: resolveTaskOutputVideoDuration(task),
        })
        persistedVideoUrl = asset.url
      } else {
        persistedVideoUrl = params.remoteVideoUrl
      }
    }

    return settleTaskSuccess(task.id, {
      status: 'succeeded',
      outputUrl: persistedVideoUrl,
      completionTokens: params.completionTokens,
      totalTokens: params.totalTokens,
      generationTime: params.generationTime,
      costYuan: params.costYuan,
      errorMessage: params.errorMessage ?? null,
    })
  })
}
