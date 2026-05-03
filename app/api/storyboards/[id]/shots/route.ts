import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/lib/modules/auth/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }

    const { id } = await context.params
    const project = await prisma.storyboardProject.findFirst({
      where: { id, userId: session.payload.userId },
      include: {
        shots: {
          orderBy: { sortOrder: 'desc' },
          take: 1,
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const nextOrder = (project.shots[0]?.sortOrder || 0) + 1

    const shot = await prisma.storyboardShot.create({
      data: {
        projectId: project.id,
        sortOrder: nextOrder,
        title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : `分镜${nextOrder}`,
        visual: typeof body.visual === 'string' && body.visual.trim() ? body.visual.trim() : '请补充画面描述',
        narration: typeof body.narration === 'string' ? body.narration : '',
        duration: typeof body.duration === 'number' ? body.duration : 5,
        shotType: typeof body.shotType === 'string' ? body.shotType : '中景',
        cameraAngle: typeof body.cameraAngle === 'string' ? body.cameraAngle : '平视',
        movement: typeof body.movement === 'string' ? body.movement : '固定机位',
        prompt: typeof body.prompt === 'string' ? body.prompt : '',
      },
      include: {
        assets: {
          include: { asset: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json({
      shot: {
        ...shot,
        assets: shot.assets.map((item) => item.asset),
      },
    })
  } catch (error) {
    console.error('Create storyboard shot error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
