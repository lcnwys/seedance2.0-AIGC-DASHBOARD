import { prisma } from '@/lib/prisma'
import {
  calculateActualCostCents,
  inferBillingType,
  resolveActualCostYuan,
} from '@/lib/modules/billing/cost'

interface TaskTerminalPayload {
  status: string
  outputUrl?: string | null
  completionTokens?: number | null
  totalTokens?: number | null
  errorMessage?: string | null
  generationTime?: number | null
  costYuan?: number | null
}

function normalizeTerminalTokens(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export async function settleTaskSuccess(taskId: string, payload: TaskTerminalPayload) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.generationTask.findUnique({
      where: { id: taskId },
      include: {
        referenceAssets: true,
        user: true,
      },
    }) as any

    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    const actualTokens = normalizeTerminalTokens(payload.totalTokens)
    const billingType = inferBillingType({
      billingType: task.billingType,
      referenceAssets: task.referenceAssets,
    })
    const fallbackCostYuan = resolveActualCostYuan({
      totalTokens: actualTokens,
      billingType,
      model: task.model,
      duration: task.duration,
      resolution: task.resolution,
      referenceAssets: task.referenceAssets,
    })
    const actualCostYuan = payload.costYuan ?? fallbackCostYuan
    const actualCostCents = calculateActualCostCents(actualCostYuan)
    const estimatedCostCents = task.estimatedCostCents || 0
    const alreadyCaptured = task.actualCostCents !== null && task.actualCostCents !== undefined
    const shouldReleaseReservation = task.billingType !== 'refunded'

    const updatedTask = await tx.generationTask.update({
      where: { id: taskId },
      data: {
        status: 'succeeded',
        outputUrl: payload.outputUrl ?? task.outputUrl,
        completionTokens: payload.completionTokens ?? task.completionTokens,
        totalTokens: actualTokens,
        errorMessage: payload.errorMessage ?? null,
        generationTime: payload.generationTime ?? task.generationTime,
        billingType,
        costYuan: actualCostYuan,
        ...(alreadyCaptured ? {} : { actualCostCents }),
      } as any,
    })

    if (!alreadyCaptured) {
      await tx.user.update({
        where: { id: task.userId },
        data: {
          ...(shouldReleaseReservation ? { reservedBudget: { decrement: BigInt(estimatedCostCents) } } : {}),
          usedBudget: { increment: BigInt(actualCostCents) },
          usedTokens: { increment: BigInt(actualTokens) },
        } as any,
      })

      if (task.user?.teamId) {
        await (tx as any).team.update({
          where: { id: task.user.teamId },
          data: {
            usedBudget: { increment: BigInt(actualCostCents) },
            usedTokens: { increment: BigInt(actualTokens) },
          },
        })
      }
    }

    return updatedTask
  })
}

export async function settleTaskFailure(taskId: string, payload: TaskTerminalPayload) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.generationTask.findUnique({
      where: { id: taskId },
      include: {
        referenceAssets: true,
        user: true,
      },
    }) as any

    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    const estimatedCostCents = task.estimatedCostCents || 0
    const alreadyRefunded = task.billingType === 'refunded'

    const updatedTask = await tx.generationTask.update({
      where: { id: taskId },
      data: {
        status: payload.status,
        outputUrl: payload.outputUrl ?? task.outputUrl,
        completionTokens: payload.completionTokens ?? task.completionTokens,
        totalTokens: 0,
        errorMessage: payload.errorMessage ?? task.errorMessage,
        generationTime: payload.generationTime ?? task.generationTime,
        costYuan: 0,
        ...(alreadyRefunded ? {} : { billingType: 'refunded' }),
      } as any,
    })

    if (!alreadyRefunded && estimatedCostCents > 0) {
      await tx.user.update({
        where: { id: task.userId },
        data: {
          reservedBudget: { decrement: BigInt(estimatedCostCents) },
        },
      })
    }

    return {
      task: updatedTask,
      refundedCents: !alreadyRefunded ? estimatedCostCents : 0,
      alreadyRefunded,
    }
  })
}

export async function refundFailedTaskReservation(taskId: string) {
  const task = await prisma.generationTask.findUnique({
    where: { id: taskId },
    select: {
      status: true,
      outputUrl: true,
      completionTokens: true,
      errorMessage: true,
      generationTime: true,
    },
  })

  if (!task) {
    throw new Error(`Task not found: ${taskId}`)
  }

  if (!['failed', 'expired'].includes(task.status)) {
    throw new Error('仅失败或过期的任务可以退款')
  }

  return settleTaskFailure(taskId, {
    status: task.status,
    outputUrl: task.outputUrl,
    completionTokens: task.completionTokens,
    errorMessage: task.errorMessage,
    generationTime: task.generationTime,
  })
}
