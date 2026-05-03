import type { ProviderNormalizedTask } from '@/lib/modules/provider/types'
import { normalizeSeed } from '@/lib/modules/provider/seedance/seed'
import { DEFAULT_SEEDANCE_MODEL } from '@/lib/modules/provider/seedance/models'
import {
  extractUserIdFromSafetyIdentifier,
  type ArkTask,
} from '@/lib/modules/provider/seedance/ark'
import { getDefaultVideoGenerationAdapter } from '@/lib/modules/video/adapters/registry'

const VIDEO_PROVIDER = getDefaultVideoGenerationAdapter()

export type UpstreamTask = ProviderNormalizedTask

export interface ParsedUpstreamTask {
  task: UpstreamTask
  model: string
  ratio: string
  duration: number | null
  resolution: string
  seed: number
  userId: string | null
  createdAt: Date
  updatedAt: Date
  generationTime: number
}

export function mapUpstreamStatus(status: string) {
  return VIDEO_PROVIDER.mapStatusToLocal(status)
}

export function buildWeakMatchWindow(createdAt: Date, windowMs = 10 * 60 * 1000) {
  return {
    gte: new Date(createdAt.getTime() - windowMs),
    lte: new Date(createdAt.getTime() + windowMs),
  }
}

export function parseUpstreamTask(task: UpstreamTask | ArkTask): ParsedUpstreamTask | null {
  const normalizedTask = 'task_id' in task ? task : VIDEO_PROVIDER.normalizeIncomingTask(task)
  const normalizedSeed = normalizeSeed(normalizedTask.seed)

  if (normalizedSeed === null) {
    return null
  }

  const createdAt = new Date(normalizedTask.created_at * 1000)
  const updatedAt = new Date(normalizedTask.updated_at * 1000)

  return {
    task: normalizedTask,
    model: normalizedTask.model || DEFAULT_SEEDANCE_MODEL,
    ratio: normalizedTask.ratio || 'adaptive',
    duration: normalizedTask.duration,
    resolution: normalizedTask.resolution || '720p',
    seed: Number(normalizedSeed),
    userId:
      normalizedTask.user_id ||
      extractUserIdFromSafetyIdentifier(normalizedTask.safety_identifier),
    createdAt,
    updatedAt,
    generationTime: Math.max(0, normalizedTask.updated_at - normalizedTask.created_at),
  }
}

export function findMatchingUpstreamTask(
  localTask: {
    id: string
    userId: string
    model: string
    ratio: string
    duration: number
    resolution: string
    seed: number | bigint
    createdAt: Date
  },
  upstreamTasks: ParsedUpstreamTask[],
  excludedTaskIds = new Set<string>()
) {
  const localSeed = Number(localTask.seed)
  const lowerBound = localTask.createdAt.getTime() - 10 * 60 * 1000
  const upperBound = localTask.createdAt.getTime() + 10 * 60 * 1000

  const matches = upstreamTasks.filter((candidate) => {
    if (excludedTaskIds.has(candidate.task.task_id)) return false
    if (!candidate.userId || candidate.userId !== localTask.userId) return false
    if (candidate.model !== localTask.model) return false
    if (candidate.ratio !== localTask.ratio) return false
    if (candidate.duration !== localTask.duration) return false
    if (candidate.resolution !== localTask.resolution) return false
    if (candidate.seed !== localSeed) return false

    const createdAtTime = candidate.createdAt.getTime()
    return createdAtTime >= lowerBound && createdAtTime <= upperBound
  })

  if (matches.length !== 1) {
    return {
      match: null,
      matches,
    }
  }

  return {
    match: matches[0],
    matches,
  }
}
