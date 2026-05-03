import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { refundFailedTaskReservation } from '@/lib/modules/billing/task-settlement'
import { requireSessionUser } from '@/lib/modules/auth/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Refund reserved budget for failed/expired task
export async function POST(
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

    // Find task and verify ownership
    const task = await prisma.generationTask.findFirst({
      where: {
        id: taskId,
        userId,
      },
      include: { user: true },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Only refund if task is in failed/expired status
    if (!['failed', 'expired'].includes(task.status)) {
      return NextResponse.json({ 
        error: '仅失败或过期的任务可以退款' 
      }, { status: 400 })
    }

    // ✅ 正确的逻辑：只有已经退款过的才跳过
    if (task.billingType === 'refunded') {
      return NextResponse.json({ 
        success: true,
        message: '该任务已退款，无需重复操作',
        refundedCents: 0,
      })
    }

    const refundResult = await refundFailedTaskReservation(taskId)

    console.log('[REFUND API] Reserved budget refunded:', {
      taskId,
      userId,
      amountCents: refundResult.refundedCents,
      amountYuan: refundResult.refundedCents / 100,
    })

    return NextResponse.json({
      success: true,
      message: refundResult.refundedCents > 0
        ? `已退还预扣预算 ¥${(refundResult.refundedCents / 100).toFixed(2)}`
        : '该任务无预扣预算需要退还',
      refundedCents: refundResult.refundedCents,
    })
  } catch (error) {
    console.error('Refund budget error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
