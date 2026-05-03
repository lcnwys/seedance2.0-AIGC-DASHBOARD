import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateToken } from '@/lib/auth'
import { ensureDefaultSuperAdmin } from '@/lib/modules/auth/default-super-admin'
import {
  buildAuthRateLimitKey,
  consumeAuthRateLimit,
  resetAuthRateLimit,
} from '@/lib/modules/auth/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function parseDefaultTeamInitialBudgetCents() {
  const raw = process.env.DEFAULT_TEAM_INITIAL_BUDGET_YUAN?.trim()
  if (!raw) {
    return 0n
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0n
  }

  return BigInt(Math.round(parsed * 100))
}

export async function POST(request: NextRequest) {
  try {
    await ensureDefaultSuperAdmin()

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const teamName = typeof body.teamName === 'string' ? body.teamName.trim() : ''

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const rateLimitKey = buildAuthRateLimitKey(request, 'register', email)
    const rateLimit = consumeAuthRateLimit(rateLimitKey, 5)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '注册尝试过于频繁，请稍后再试', retryAfterSeconds: rateLimit.retryAfterSeconds },
        { status: 429 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)

    if (!teamName) {
      return NextResponse.json(
        { error: '请填写团队名称' },
        { status: 400 }
      )
    }

    const initialBudgetCents = parseDefaultTeamInitialBudgetCents()

    const result = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: teamName,
          totalBudget: initialBudgetCents,
        },
      })

      const user = await tx.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role: 'admin',
          teamId: team.id,
          allocatedBudget: initialBudgetCents,
        },
      })

      return { user, team }
    })

    const token = generateToken(result.user.id)
    resetAuthRateLimit(rateLimitKey)

    return NextResponse.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        isSuperAdmin: result.user.isSuperAdmin,
        isActive: result.user.isActive,
        teamId: result.team.id,
        teamName: result.team.name,
      },
      token,
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
