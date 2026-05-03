import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type SessionPayload = {
  userId: string
}

type SessionFailure = {
  response: NextResponse
}

type SessionSuccess<T extends Prisma.UserDefaultArgs> = {
  token: string
  payload: SessionPayload
  user: Prisma.UserGetPayload<T>
}

type SessionResult<T extends Prisma.UserDefaultArgs> = SessionSuccess<T> | SessionFailure

function unauthorized(error: string, status = 401) {
  return NextResponse.json({ error }, { status })
}

export function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization) {
    return null
  }

  if (!authorization.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim() || null
}

export async function requireSessionUser<T extends Prisma.UserDefaultArgs = Prisma.UserDefaultArgs>(
  request: NextRequest,
  args?: T
): Promise<SessionResult<T>> {
  const token = getBearerToken(request)
  if (!token) {
    return { response: unauthorized('Unauthorized') }
  }

  const payload = verifyToken(token)
  if (!payload) {
    return { response: unauthorized('Invalid token') }
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    ...(args || {}),
  } as Prisma.UserFindUniqueArgs) as Prisma.UserGetPayload<T> | null

  if (!user) {
    return { response: unauthorized('Session user not found') }
  }

  return {
    token,
    payload,
    user,
  }
}

export function requireTeamMembership(user: { teamId?: string | null }) {
  if (!user.teamId) {
    return { response: NextResponse.json({ error: 'User not in a team' }, { status: 400 }) }
  }

  return null
}

export function requireAdminRole(user: { role?: string | null }, message = 'Admin access required') {
  if (user.role !== 'admin') {
    return { response: NextResponse.json({ error: message }, { status: 403 }) }
  }

  return null
}
