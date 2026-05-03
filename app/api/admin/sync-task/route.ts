import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { normalizeSeed } from '@/lib/modules/provider/seedance/seed'
import { calculateActualCostCents, calculateCostYuanFromTokens, inferBillingType } from '@/lib/modules/billing/cost'
import type { ProviderNormalizedTask } from '@/lib/modules/provider/types'
import {
  DEFAULT_SEEDANCE_MODEL,
  getSeedanceModelKey,
  normalizeSeedanceModel,
} from '@/lib/modules/provider/seedance/models'
import { settleTaskFailure, settleTaskSuccess } from '@/lib/modules/billing/task-settlement'
import { buildWeakMatchWindow } from '@/lib/modules/provider/seedance/task-reconciliation'
import { getTeamProviderConfigByTeamId } from '@/lib/seedance-config'
import { finalizeVideoTaskSuccess } from '@/lib/modules/tasks/finalize-video-task-success'
import { getVideoGenerationAdapterByProviderId } from '@/lib/modules/video/adapters/registry'

type SyncTaskInput = ProviderNormalizedTask
const VIDEO_PROVIDER = getVideoGenerationAdapterByProviderId('volcengine')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function inferRecoveredMode(task: SyncTaskInput) {
  return 'text_to_video'
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const currentUser = await (prisma.user.findUnique as any)({
      where: { id: payload.userId },
      select: { isSuperAdmin: true },
    })

    if (!currentUser?.isSuperAdmin) {
      return NextResponse.json({ error: '权限不足：仅系统管理员可访问' }, { status: 403 })
    }

    const body = await request.json()
    const { tasks, teamId } = body as { tasks: SyncTaskInput[]; teamId: string }

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: '请提供要同步的任务列表' }, { status: 400 })
    }

    if (!teamId) {
      return NextResponse.json({ error: '请提供团队 ID' }, { status: 400 })
    }

    const providerConfig = await getTeamProviderConfigByTeamId(teamId)
    if (!providerConfig) {
      return NextResponse.json({ error: '团队不存在或未配置视频供应商' }, { status: 404 })
    }

    if (providerConfig.providerId !== 'volcengine') {
      return NextResponse.json({ error: '该团队当前默认视频供应商不是火山，无法使用火山漏单同步' }, { status: 400 })
    }

    const results = {
      success: [] as string[],
      reconciled: [] as string[],
      skipped: [] as { taskId: string; reason: string }[],
      failed: [] as { taskId: string; error: string }[],
    }

    for (const upstreamTask of tasks) {
      const upstreamTaskId = upstreamTask.task_id || upstreamTask.id

      try {
        const existingTask = await prisma.generationTask.findFirst({
          where: { externalId: upstreamTaskId },
        })

        if (existingTask) {
          results.skipped.push({
            taskId: upstreamTaskId,
            reason: '任务已存在',
          })
          continue
        }

        const targetUser = upstreamTask.user_id
          ? await prisma.user.findUnique({ where: { id: upstreamTask.user_id } }) as any
          : null

        if (!targetUser) {
          results.failed.push({
            taskId: upstreamTaskId,
            error: '无法从 safety_identifier 还原本地用户',
          })
          continue
        }

        if (targetUser.teamId !== teamId) {
          results.failed.push({
            taskId: upstreamTaskId,
            error: `用户 ${targetUser.email} 不属于此团队`,
          })
          continue
        }

        const normalizedSeed = normalizeSeed(upstreamTask.seed)
        if (normalizedSeed === null) {
          results.failed.push({
            taskId: upstreamTaskId,
            error: 'seed is out of range',
          })
          continue
        }

        const createdAt = new Date(upstreamTask.created_at * 1000)
        const updatedAt = new Date(upstreamTask.updated_at * 1000)
        const generationTime = Math.max(0, upstreamTask.updated_at - upstreamTask.created_at)
        const localStatus = VIDEO_PROVIDER.mapStatusToLocal(upstreamTask.status)
        let persistedVideoUrl = upstreamTask.video_path

        const uncertainTask = await prisma.generationTask.findFirst({
          where: {
            userId: targetUser.id,
            externalId: null,
            status: 'submit_unknown',
            model: normalizeSeedanceModel(upstreamTask.model),
            ratio: upstreamTask.ratio || 'adaptive',
            duration: upstreamTask.duration || 5,
            resolution: upstreamTask.resolution || '720p',
            seed: normalizedSeed as any,
            createdAt: buildWeakMatchWindow(createdAt),
          },
          orderBy: { createdAt: 'desc' },
        }) as any

        if (uncertainTask) {
          await prisma.generationTask.update({
            where: { id: uncertainTask.id },
            data: { externalId: upstreamTaskId },
          })

          if (localStatus === 'succeeded') {
            try {
              const updatedTask = await finalizeVideoTaskSuccess({
                taskId: uncertainTask.id,
                remoteVideoUrl: upstreamTask.video_path,
                totalTokens: upstreamTask.total_tokens,
                completionTokens: upstreamTask.completion_tokens,
                generationTime,
                costYuan: null,
                errorMessage: null,
              })
              persistedVideoUrl = updatedTask.outputUrl
            } catch (persistError: any) {
              console.error(`Finalize admin synced video failed for task ${upstreamTaskId}:`, persistError)
              await settleTaskSuccess(uncertainTask.id, {
                status: 'succeeded',
                outputUrl: persistedVideoUrl,
                totalTokens: upstreamTask.total_tokens,
                completionTokens: upstreamTask.completion_tokens,
                generationTime,
                costYuan: null,
                errorMessage: null,
              })
            }
          } else if (['failed', 'expired', 'cancelled'].includes(localStatus)) {
            await settleTaskFailure(uncertainTask.id, {
              status: localStatus,
              outputUrl: upstreamTask.video_path,
              totalTokens: 0,
              completionTokens: upstreamTask.completion_tokens,
              generationTime,
              costYuan: 0,
              errorMessage: upstreamTask.error_message || null,
            })
          } else {
            await prisma.generationTask.update({
              where: { id: uncertainTask.id },
              data: {
                status: localStatus,
                outputUrl: upstreamTask.video_path || uncertainTask.outputUrl,
                totalTokens: upstreamTask.total_tokens || uncertainTask.totalTokens,
                completionTokens: upstreamTask.completion_tokens,
                generationTime,
                updatedAt,
                errorMessage: upstreamTask.error_message || uncertainTask.errorMessage,
              } as any,
            })
          }

          results.success.push(upstreamTaskId)
          results.reconciled.push(upstreamTaskId)
          continue
        }

        await prisma.$transaction(async (tx) => {
          const recoveredBillingType = inferBillingType({
            billingType: 'without_video',
          })
          const recoveredCostYuan = calculateCostYuanFromTokens(
            upstreamTask.total_tokens || 0,
            recoveredBillingType,
            upstreamTask.model || DEFAULT_SEEDANCE_MODEL
          )
          const actualCostCents = calculateActualCostCents(recoveredCostYuan)

          await tx.generationTask.create({
            data: {
              externalId: upstreamTaskId,
              mode: inferRecoveredMode(upstreamTask),
              model: normalizeSeedanceModel(upstreamTask.model),
              modelKey: getSeedanceModelKey(upstreamTask.model || DEFAULT_SEEDANCE_MODEL),
              providerId: VIDEO_PROVIDER.id,
              providerModelId: normalizeSeedanceModel(upstreamTask.model),
              prompt: `[Recovered from Ark task ${upstreamTaskId}]`,
              ratio: upstreamTask.ratio || 'adaptive',
              duration: upstreamTask.duration || 5,
              resolution: upstreamTask.resolution || '720p',
              watermark: false,
              generateAudio: upstreamTask.generate_audio !== false,
              seed: normalizedSeed as any,
              status: localStatus,
              outputUrl: persistedVideoUrl,
              totalTokens: localStatus === 'succeeded' ? upstreamTask.total_tokens : null,
              completionTokens: upstreamTask.completion_tokens,
              billingType:
                localStatus === 'failed' ||
                localStatus === 'expired' ||
                localStatus === 'cancelled'
                  ? 'refunded'
                  : recoveredBillingType,
              costYuan: localStatus === 'succeeded' ? recoveredCostYuan : 0,
              actualCostCents: localStatus === 'succeeded' ? actualCostCents : null,
              generationTime,
              errorMessage: upstreamTask.error_message || null,
              createdAt,
              updatedAt,
              userId: targetUser.id,
            } as any,
          })

          if (localStatus === 'succeeded') {
            await (tx.user.update as any)({
              where: { id: targetUser.id },
              data: {
                usedTokens: { increment: BigInt(upstreamTask.total_tokens || 0) },
                usedBudget: { increment: BigInt(actualCostCents) },
              },
            })

            await (tx as any).team.update({
              where: { id: teamId },
              data: {
                usedTokens: { increment: BigInt(upstreamTask.total_tokens || 0) },
                usedBudget: { increment: BigInt(actualCostCents) },
              },
            })
          }
        })

        results.success.push(upstreamTaskId)
      } catch (error: any) {
        console.error(`Sync task ${upstreamTaskId} error:`, error)
        results.failed.push({
          taskId: upstreamTaskId,
          error: error.message || '同步失败',
        })
      }
    }

    return NextResponse.json({
      message: '同步完成',
      results,
      summary: {
        total: tasks.length,
        success: results.success.length,
        reconciled: results.reconciled.length,
        skipped: results.skipped.length,
        failed: results.failed.length,
      },
    })
  } catch (error: any) {
    console.error('Sync task API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
