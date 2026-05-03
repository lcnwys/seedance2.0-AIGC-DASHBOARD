import { NextRequest, NextResponse } from 'next/server'
import { syncPendingTasksBatch } from '@/lib/modules/provider/seedance/task-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getCronToken() {
  return process.env.TASK_SYNC_CRON_TOKEN?.trim() || ''
}

function isAuthorized(request: NextRequest) {
  const expectedToken = getCronToken()
  if (!expectedToken) {
    return false
  }

  const authorization = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const headerToken = request.headers.get('x-cron-token')?.trim()
  return authorization === expectedToken || headerToken === expectedToken
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const limit = typeof body.limit === 'number' && Number.isFinite(body.limit)
      ? Math.max(1, Math.min(200, Math.floor(body.limit)))
      : 100

    const result = await syncPendingTasksBatch({
      limit,
      attemptConfirm: true,
      bypassConfirmCooldown: true,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Internal pending task sync error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
