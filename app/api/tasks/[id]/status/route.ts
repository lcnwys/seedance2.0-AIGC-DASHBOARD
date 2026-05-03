import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserProviderConfig } from '@/lib/seedance-config'
import { settleTaskFailure, settleTaskSuccess } from '@/lib/modules/billing/task-settlement'
import { requireSessionUser } from '@/lib/modules/auth/session'
import { confirmSingleUncertainTask, UNCERTAIN_CONFIRM_COOLDOWN_MS } from '@/lib/modules/provider/seedance/uncertain-task-claimer'
import { finalizeVideoTaskSuccess } from '@/lib/modules/tasks/finalize-video-task-success'
import {
  getDefaultVideoGenerationAdapter,
} from '@/lib/modules/video/adapters/registry'
import { resolveVideoGenerationAdapterForTask } from '@/lib/modules/video/adapters/resolve'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VIDEO_PROVIDER = getDefaultVideoGenerationAdapter()
const DEFAULT_API_URL = VIDEO_PROVIDER.defaultApiUrl
const COOLDOWN_MS = 10000 // 10秒冷却时间

const log = (level: 'INFO' | 'ERROR' | 'DEBUG', message: string, data?: any) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [TASK-STATUS] [${level}]`
  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2))
  } else {
    console.log(`${prefix} ${message}`)
  }
}

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

    const { searchParams } = new URL(request.url)
    const attemptConfirm = searchParams.get('attempt_confirm') === 'true'

    const { id: taskId } = await params

    // 1. 首先查询本地数据库
    const task = await prisma.generationTask.findFirst({
      where: {
        id: taskId,
        userId,
      },
      include: {
        referenceAssets: true,
        user: true,
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    const provider = resolveVideoGenerationAdapterForTask({
      model: task.model,
      providerId: (task as any).providerId,
    })
    const seedanceConfig = await getUserProviderConfig(userId, (task as any).providerId)
    const effectiveApiKey = seedanceConfig?.apiKey
    const effectiveApiUrl = seedanceConfig?.apiUrl || provider.defaultApiUrl || DEFAULT_API_URL

    // 2. 如果任务已完成/失败/过期，直接返回本地数据
    if (['succeeded', 'failed', 'expired', 'completed', 'cancelled'].includes(task.status)) {
      log('DEBUG', `Task ${taskId} already completed, returning local data`, {
        status: task.status,
      })
      return NextResponse.json({
        task_id: task.id,
        external_id: task.externalId,
        status: task.status,
        video_path: task.outputUrl,
        completion_tokens: task.completionTokens,
        total_tokens: task.totalTokens,
        cost: task.costYuan,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      })
    }

    // 3. 任务进行中，检查冷却时间
    const now = Date.now()
    const lastUpdated = new Date(task.updatedAt).getTime()
    const timeSinceLastUpdate = now - lastUpdated

    // 如果在冷却期内，直接返回本地数据（不走上游）
    if (timeSinceLastUpdate < COOLDOWN_MS) {
      log('DEBUG', `Task ${taskId} in cooldown, returning cached data`, {
        timeSinceLastUpdate,
        cooldownRemaining: COOLDOWN_MS - timeSinceLastUpdate,
      })
      return NextResponse.json({
        task_id: task.id,
        external_id: task.externalId,
        status: task.status,
        video_path: task.outputUrl,
        completion_tokens: task.completionTokens,
        total_tokens: task.totalTokens,
        cost: task.costYuan,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
        cached: true, // 标记为缓存响应
      })
    }

    if (
      provider.id === 'volcengine'
      && attemptConfirm
      && task.status === 'submit_unknown'
      && !task.externalId
      && effectiveApiKey
    ) {
      try {
        const confirmation = await confirmSingleUncertainTask({
          taskId: task.id,
          apiUrl: effectiveApiUrl,
          apiKey: effectiveApiKey,
        })

        if (confirmation.outcome === 'confirmed') {
          return NextResponse.json({
            task_id: confirmation.task.id,
            external_id: confirmation.task.externalId,
            status: confirmation.task.status,
            video_path: confirmation.task.outputUrl,
            completion_tokens: confirmation.task.completionTokens,
            total_tokens: confirmation.task.totalTokens,
            cost: confirmation.task.costYuan,
            created_at: confirmation.task.createdAt,
            updated_at: confirmation.task.updatedAt,
            generation_time: confirmation.task.generationTime,
            auto_confirmed: true,
          })
        }

        if (confirmation.outcome === 'cooldown') {
          return NextResponse.json({
            task_id: task.id,
            external_id: null,
            status: task.status,
            video_path: task.outputUrl,
            completion_tokens: task.completionTokens,
            total_tokens: task.totalTokens,
            cost: task.costYuan,
            created_at: task.createdAt,
            updated_at: task.updatedAt,
            confirmation_deferred: true,
            retry_after_ms: confirmation.retryAfterMs,
            confirmation_cooldown_ms: UNCERTAIN_CONFIRM_COOLDOWN_MS,
          })
        }
      } catch (confirmError: any) {
        log('ERROR', `Auto-confirm failed for task ${taskId}`, {
          error: confirmError.message,
        })
      }
    }

    // 4. 冷却期已过，且任务有 externalId，请求上游
    if (!task.externalId) {
      return NextResponse.json({
        task_id: task.id,
        external_id: null,
        status: task.status,
        video_path: task.outputUrl,
        completion_tokens: task.completionTokens,
        total_tokens: task.totalTokens,
        cost: task.costYuan,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      })
    }

    if (!effectiveApiKey) {
      return NextResponse.json({
        task_id: task.id,
        external_id: task.externalId,
        status: task.status,
        video_path: task.outputUrl,
        completion_tokens: task.completionTokens,
        total_tokens: task.totalTokens,
        cost: task.costYuan,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
        poll_error: `${provider.label} API Key not configured`,
      })
    }

    const pollUrl = `${effectiveApiUrl}/api/v3/contents/generations/tasks/${task.externalId}`

    log('DEBUG', `Polling upstream for task ${taskId}`, {
      externalId: task.externalId,
      url: pollUrl,
      timeSinceLastUpdate,
    })

    try {
      const remoteData = await provider.getTask({
        apiUrl: effectiveApiUrl,
        apiKey: effectiveApiKey,
        taskId: task.externalId,
        model: task.model,
      })

      log('INFO', `Upstream response received for task ${taskId}`, {
        remoteStatus: remoteData.status,
      })

      // 5. 映射上游状态到本地状态
      const generationTime = provider.getTaskGenerationTimeSeconds(remoteData)
      const localStatus = provider.mapStatusToLocal(remoteData.status)

      let updatedTask: any

      if (localStatus === 'succeeded') {
        try {
          updatedTask = await finalizeVideoTaskSuccess({
            taskId: task.id,
            remoteVideoUrl: remoteData.video_path,
            completionTokens: remoteData.completion_tokens,
            totalTokens: remoteData.total_tokens,
            generationTime,
            costYuan: remoteData.cost,
            errorMessage: null,
          })
        } catch (persistError: any) {
          log('ERROR', `Finalize video success failed for task ${taskId}`, {
            error: persistError?.message || 'Unknown persistence error',
          })
          updatedTask = await settleTaskSuccess(task.id, {
            status: 'succeeded',
            outputUrl: remoteData.video_path || task.outputUrl,
            completionTokens: remoteData.completion_tokens,
            totalTokens: remoteData.total_tokens,
            generationTime,
            costYuan: remoteData.cost,
            errorMessage: null,
          })
        }
      } else if (['failed', 'expired', 'cancelled'].includes(localStatus)) {
        const failureResult = await settleTaskFailure(task.id, {
          status: localStatus,
          outputUrl: remoteData.video_path || task.outputUrl,
          completionTokens: remoteData.completion_tokens,
          totalTokens: 0,
          generationTime,
          costYuan: 0,
          errorMessage: remoteData.error_message || task.errorMessage,
        })
        updatedTask = failureResult.task
      } else {
        const updateData: any = {
          status: localStatus,
          outputUrl: remoteData.video_path || task.outputUrl,
          completionTokens: remoteData.completion_tokens,
          totalTokens: remoteData.total_tokens,
          costYuan: task.costYuan,
        }

        if (generationTime !== null && !(task as any).generationTime) {
          updateData.generationTime = generationTime
        }

        updatedTask = await prisma.generationTask.update({
          where: { id: task.id },
          data: updateData,
        })
      }

      return NextResponse.json({
        task_id: updatedTask.id,
        external_id: updatedTask.externalId,
        status: updatedTask.status,
        video_path: updatedTask.outputUrl,
        completion_tokens: updatedTask.completionTokens,
        total_tokens: updatedTask.totalTokens,
        cost: updatedTask.costYuan ?? task.costYuan,
        created_at: updatedTask.createdAt,
        updated_at: updatedTask.updatedAt,
        generation_time: generationTime,
        model: remoteData.model,
        last_frame_url: remoteData.last_frame_url,
      })
    } catch (pollError: any) {
      log('ERROR', `Upstream poll failed for task ${taskId}`, {
        error: pollError.message,
        code: pollError.code,
      })

      // 上游请求失败，返回本地数据（不更新冷却时间）
      return NextResponse.json({
        task_id: task.id,
        external_id: task.externalId,
        status: task.status,
        video_path: task.outputUrl,
        completion_tokens: task.completionTokens,
        total_tokens: task.totalTokens,
        cost: task.costYuan,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
        poll_error: pollError.message,
      })
    }
  } catch (error) {
    console.error('Task status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
