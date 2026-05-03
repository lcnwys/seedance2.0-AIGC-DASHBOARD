import type { Prisma } from '@prisma/client'

const ACTIVE_TASK_STATUSES = ['pending', 'processing', 'queued', 'running', 'submit_unknown']
const ACTIVE_IMAGE_TASK_STATUSES = ['pending', 'processing']

export const DEFAULT_TEAM_SUBMISSION_GUARD = {
  maxConcurrentTasks: 5,
  maxRequestsPerMinute: 20,
  memberCooldownSeconds: 10,
} as const

export type TeamSubmissionGuard = {
  maxConcurrentTasks: number
  maxRequestsPerMinute: number
  memberCooldownSeconds: number
}

export class SubmissionGuardError extends Error {
  statusCode: number
  retryAfterSeconds?: number

  constructor(message: string, statusCode = 429, retryAfterSeconds?: number) {
    super(message)
    this.name = 'SubmissionGuardError'
    this.statusCode = statusCode
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function normalizeTeamSubmissionGuard(team: Partial<TeamSubmissionGuard> | null | undefined): TeamSubmissionGuard {
  return {
    maxConcurrentTasks: Math.max(1, Number(team?.maxConcurrentTasks ?? DEFAULT_TEAM_SUBMISSION_GUARD.maxConcurrentTasks)),
    maxRequestsPerMinute: Math.max(1, Number(team?.maxRequestsPerMinute ?? DEFAULT_TEAM_SUBMISSION_GUARD.maxRequestsPerMinute)),
    memberCooldownSeconds: Math.max(0, Number(team?.memberCooldownSeconds ?? DEFAULT_TEAM_SUBMISSION_GUARD.memberCooldownSeconds)),
  }
}

export async function enforceTeamSubmissionGuard(
  tx: Prisma.TransactionClient,
  params: {
    userId: string
    teamId: string
    teamGuard?: Partial<TeamSubmissionGuard> | null
  }
) {
  const guard = normalizeTeamSubmissionGuard(params.teamGuard)
  const now = new Date()
  const recentWindowStart = new Date(now.getTime() - 60 * 1000)

  const [activeTaskCount, recentRequestCount, latestUserTask] = await Promise.all([
    Promise.all([
      tx.generationTask.count({
        where: {
          user: { teamId: params.teamId },
          status: { in: ACTIVE_TASK_STATUSES },
        },
      }),
      (tx as any).imageGenerationTask.count({
        where: {
          user: { teamId: params.teamId },
          status: { in: ACTIVE_IMAGE_TASK_STATUSES },
        },
      }),
    ]).then(([videoActiveCount, imageActiveCount]) => videoActiveCount + imageActiveCount),
    Promise.all([
      tx.generationTask.count({
        where: {
          user: { teamId: params.teamId },
          createdAt: { gte: recentWindowStart },
        },
      }),
      (tx as any).imageGenerationTask.count({
        where: {
          user: { teamId: params.teamId },
          createdAt: { gte: recentWindowStart },
        },
      }),
    ]).then(([videoRecentCount, imageRecentCount]) => videoRecentCount + imageRecentCount),
    Promise.all([
      tx.generationTask.findFirst({
        where: { userId: params.userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      (tx as any).imageGenerationTask.findFirst({
        where: {
          userId: params.userId,
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]).then(([latestVideoTask, latestImageTask]) => {
      if (!latestVideoTask) return latestImageTask
      if (!latestImageTask) return latestVideoTask
      return latestVideoTask.createdAt >= latestImageTask.createdAt ? latestVideoTask : latestImageTask
    }),
  ])

  if (activeTaskCount >= guard.maxConcurrentTasks) {
    throw new SubmissionGuardError(
      `团队当前已有 ${activeTaskCount} 个进行中或待确认任务，已达到并发上限 ${guard.maxConcurrentTasks}。请等待部分任务完成后再提交。`
    )
  }

  if (recentRequestCount >= guard.maxRequestsPerMinute) {
    throw new SubmissionGuardError(
      `团队最近 1 分钟已提交 ${recentRequestCount} 次任务，已达到分钟上限 ${guard.maxRequestsPerMinute}。请稍后再试。`,
      429,
      60
    )
  }

  if (guard.memberCooldownSeconds > 0 && latestUserTask?.createdAt) {
    const elapsedSeconds = Math.floor((now.getTime() - latestUserTask.createdAt.getTime()) / 1000)
    const remainingSeconds = guard.memberCooldownSeconds - elapsedSeconds

    if (remainingSeconds > 0) {
      throw new SubmissionGuardError(
        `当前团队启用了提交冷却，单个成员每次提交需间隔 ${guard.memberCooldownSeconds} 秒。请在 ${remainingSeconds} 秒后再试。`,
        429,
        remainingSeconds
      )
    }
  }

  return guard
}
