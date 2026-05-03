import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'
import { ensureDefaultSuperAdmin } from '@/lib/modules/auth/default-super-admin'
import {
  buildAuthRateLimitKey,
  consumeAuthRateLimit,
  resetAuthRateLimit,
} from '@/lib/modules/auth/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    await ensureDefaultSuperAdmin()

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const rateLimitKey = buildAuthRateLimitKey(request, 'login', email)
    const rateLimit = consumeAuthRateLimit(rateLimitKey, 10)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '登录尝试过于频繁，请稍后再试', retryAfterSeconds: rateLimit.retryAfterSeconds },
        { status: 429 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        team: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 403 }
      )
    }

    const isValid = await verifyPassword(password, user.password)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    resetAuthRateLimit(rateLimitKey)

    const token = generateToken(user.id)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        isActive: user.isActive,
        teamId: user.teamId,
        teamName: user.team?.name,
        allocatedTokens: user.allocatedTokens.toString(),
        usedTokens: user.usedTokens.toString(),
      },
      token,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
