import { prisma } from '@/lib/prisma'
import { calculateCostYuanFromTokens, inferBillingType } from '@/lib/modules/billing/cost'
import { settleTaskFailure, settleTaskSuccess } from '@/lib/modules/billing/task-settlement'
import {
  findMatchingUpstreamTask,
  mapUpstreamStatus,
  parseUpstreamTask,
  type ParsedUpstreamTask,
} from '@/lib/modules/provider/seedance/task-reconciliation'
import { getDefaultVideoGenerationAdapter } from '@/lib/modules/video/adapters/registry'

export const UNCERTAIN_CONFIRM_COOLDOWN_MS = 2 * 60 * 1000
const VIDEO_PROVIDER = getDefaultVideoGenerationAdapter()

export async function fetchParsedUpstreamTasks(apiUrl: string, apiKey: string) {
  const response = await VIDEO_PROVIDER.listAllTasks({
    apiUrl,
    apiKey,
    pageSize: 200,
  })

  return response.items
    .map(parseUpstreamTask)
    .filter(Boolean) as ParsedUpstreamTask[]
}

export async function confirmSingleUncertainTask(params: {
  taskId: string
  apiUrl: string
  apiKey: string
  bypassCooldown?: boolean
}) {
  const { taskId, apiUrl, apiKey, bypassCooldown = false } = params

  const task = await prisma.generationTask.findUnique({
    where: { id: taskId },
    include: {
      referenceAssets: {
        select: { type: true },
      },
    },
  }) as any

  if (!task) {
    throw new Error(`Task not found: ${taskId}`)
  }

  if (task.status !== 'submit_unknown' || task.externalId) {
    return {
      outcome: 'skipped' as const,
      reason: 'Task is not an unresolved submit_unknown record',
      task,
    }
  }

  const timeSinceLastUpdate = Date.now() - new Date(task.updatedAt).getTime()
  if (!bypassCooldown && timeSinceLastUpdate < UNCERTAIN_CONFIRM_COOLDOWN_MS) {
    return {
      outcome: 'cooldown' as const,
      reason: 'Confirmation attempt is cooling down',
      retryAfterMs: UNCERTAIN_CONFIRM_COOLDOWN_MS - timeSinceLastUpdate,
      task,
    }
  }

  await prisma.generationTask.update({
    where: { id: task.id },
    data: { updatedAt: new Date() } as any,
  })

  const upstreamTasks = await fetchParsedUpstreamTasks(apiUrl, apiKey)
  const matchResult = findMatchingUpstreamTask(task, upstreamTasks)

  if (!matchResult.match) {
    return {
      outcome: matchResult.matches.length > 1 ? 'ambiguous' as const : 'unmatched' as const,
      reason: matchResult.matches.length > 1 ? 'Multiple upstream candidates found' : 'No upstream candidate found',
      candidates: matchResult.matches.map((candidate) => candidate.task.task_id),
      task,
    }
  }

  const matched = matchResult.match

  await prisma.generationTask.update({
    where: { id: task.id },
    data: { externalId: matched.task.task_id },
  })

  let updatedTask: any

  if (matched.task.status === 'succeeded') {
    const billingType = inferBillingType({
      billingType: task.billingType,
      referenceAssets: task.referenceAssets,
    })
    const costYuan = typeof matched.task.cost === 'number' && Number.isFinite(matched.task.cost)
      ? matched.task.cost
      : calculateCostYuanFromTokens(matched.task.total_tokens, billingType, task.model)

    updatedTask = await settleTaskSuccess(task.id, {
      status: 'succeeded',
      totalTokens: matched.task.total_tokens,
      completionTokens: matched.task.completion_tokens,
      generationTime: matched.generationTime,
      costYuan,
      errorMessage: null,
    })

    return {
      outcome: 'confirmed' as const,
      status: 'succeeded',
      upstreamTaskId: matched.task.task_id,
      task: updatedTask,
    }
  }

  if (matched.task.status === 'failed' || matched.task.status === 'expired') {
    const failureResult = await settleTaskFailure(task.id, {
      status: matched.task.status,
      totalTokens: 0,
      completionTokens: matched.task.completion_tokens,
      generationTime: matched.generationTime,
      costYuan: 0,
      errorMessage: null,
    })

    return {
      outcome: 'confirmed' as const,
      status: matched.task.status,
      upstreamTaskId: matched.task.task_id,
      task: failureResult.task,
    }
  }

  updatedTask = await prisma.generationTask.update({
    where: { id: task.id },
    data: {
      status: mapUpstreamStatus(matched.task.status),
      completionTokens: matched.task.completion_tokens,
      totalTokens: matched.task.total_tokens || task.totalTokens,
      errorMessage: '已自动认领上游任务，继续等待结果回调',
      updatedAt: matched.updatedAt,
    } as any,
  })

  return {
    outcome: 'confirmed' as const,
    status: mapUpstreamStatus(matched.task.status),
    upstreamTaskId: matched.task.task_id,
    task: updatedTask,
  }
}
