import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { settleTaskFailure, settleTaskSuccess } from '@/lib/modules/billing/task-settlement'
import { getTaskWebhookSecret } from '@/lib/modules/provider/seedance/callback'
import { finalizeVideoTaskSuccess } from '@/lib/modules/tasks/finalize-video-task-success'
import { getDefaultVideoGenerationAdapter } from '@/lib/modules/video/adapters/registry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VIDEO_PROVIDER = getDefaultVideoGenerationAdapter()

export async function POST(request: NextRequest) {
  try {
    const expectedToken = getTaskWebhookSecret()
    if (!expectedToken) {
      return NextResponse.json({ error: 'Webhook secret is not configured' }, { status: 503 })
    }

    const providedToken = request.nextUrl.searchParams.get('token')
    if (providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized webhook token' }, { status: 401 })
    }

    const rawBody = await request.json()
    const body = VIDEO_PROVIDER.normalizeIncomingTask(rawBody)
    
    // Find task by external ID
    const task = await (prisma.generationTask.findFirst as any)({
      where: { externalId: body.task_id || body.id },
      include: {
        referenceAssets: true,
        user: true,
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const isSuccess = body.status === 'succeeded'
    const actualTokens = body.total_tokens || 0

    if (isSuccess) {
      try {
        await finalizeVideoTaskSuccess({
          taskId: task.id,
          remoteVideoUrl: body.video_path,
          completionTokens: body.completion_tokens,
          totalTokens: actualTokens,
          costYuan: null,
          errorMessage: null,
        })
      } catch (persistError) {
        console.error('Finalize webhook video success failed:', persistError)
        await settleTaskSuccess(task.id, {
          status: 'succeeded',
          outputUrl: body.video_path,
          completionTokens: body.completion_tokens,
          totalTokens: actualTokens,
          errorMessage: null,
          costYuan: null,
        })
      }
    } else if (body.status === 'failed' || body.status === 'expired' || body.status === 'cancelled') {
      await settleTaskFailure(task.id, {
        status: body.status,
        outputUrl: body.video_path,
        completionTokens: body.completion_tokens,
        totalTokens: 0,
        errorMessage: body.error_message || null,
        costYuan: 0,
      })
    } else {
      await (prisma.generationTask.update as any)({
        where: { id: task.id },
        data: {
          status: body.status,
          outputUrl: body.video_path,
          completionTokens: body.completion_tokens,
          totalTokens: body.total_tokens || task.totalTokens,
          costYuan: task.costYuan,
          errorMessage: body.error_message || null,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
