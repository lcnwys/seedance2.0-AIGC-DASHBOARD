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

export async function POST(request: NextRequest) {
  try {
    await ensureDefaultSuperAdmin()

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const teamName = typeof body.teamName === 'string' ? body.teamName.trim() : ''
    const isCreateTeam = body.isCreateTeam === true

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

    // If creating a team, create team first then user as admin
    if (isCreateTeam && teamName) {
      // Create team and admin user in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create team
        const team = await tx.team.create({
          data: {
            name: teamName,
          },
        })

        // Create user as admin of the team
        const user = await tx.user.create({
          data: {
            email,
            name,
            password: hashedPassword,
            role: 'admin',
            teamId: team.id,
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
    }

    // Create individual user (no team)
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    })

    const token = generateToken(user.id)
    resetAuthRateLimit(rateLimitKey)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        isActive: user.isActive,
        teamId: user.teamId,
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
