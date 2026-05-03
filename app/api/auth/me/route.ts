import { NextRequest, NextResponse } from 'next/server'
import { requireSessionUser } from '@/lib/modules/auth/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionUser(request, {
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isSuperAdmin: true,
        isActive: true,
        teamId: true,
      },
    })

    if ('response' in session) {
      return session.response
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        isSuperAdmin: session.user.isSuperAdmin,
        isActive: session.user.isActive,
        teamId: session.user.teamId,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
