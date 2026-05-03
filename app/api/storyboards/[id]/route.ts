import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/lib/modules/auth/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizeProjectDetail(project: any) {
  return {
    id: project.id,
    title: project.title,
    type: project.type,
    status: project.status,
    language: project.language,
    mode: project.mode,
    ratio: project.ratio,
    themeId: project.themeId,
    themeLabel: project.themeLabel,
    minShotCount: project.minShotCount,
    content: project.content,
    coverUrl: project.coverUrl,
    modeLabel: project.modeLabel,
    isFavorite: project.isFavorite,
    isOwned: project.isOwned,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    shots: project.shots.map((shot: any) => ({
      id: shot.id,
      sortOrder: shot.sortOrder,
      title: shot.title,
      visual: shot.visual,
      narration: shot.narration,
      duration: shot.duration,
      shotType: shot.shotType,
      cameraAngle: shot.cameraAngle,
      movement: shot.movement,
      prompt: shot.prompt,
      createdAt: shot.createdAt,
      updatedAt: shot.updatedAt,
      assets: shot.assets.map((item: any) => ({
        id: item.asset.id,
        name: item.asset.name,
        type: item.asset.type,
        url: item.asset.url,
        category: item.asset.category,
        subjectType: item.asset.subjectType,
        subjectName: item.asset.subjectName,
      })),
    })),
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }

    const { id } = await context.params
    const project = await prisma.storyboardProject.findFirst({
      where: {
        id,
        userId: session.payload.userId,
      },
      include: {
        shots: {
          include: {
            assets: {
              include: {
                asset: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 })
    }

    return NextResponse.json({ project: normalizeProjectDetail(project) })
  } catch (error) {
    console.error('Get storyboard detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }

    const { id } = await context.params
    const existing = await prisma.storyboardProject.findFirst({
      where: { id, userId: session.payload.userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'title',
      'type',
      'status',
      'language',
      'mode',
      'ratio',
      'themeId',
      'themeLabel',
      'content',
      'coverUrl',
      'modeLabel',
      'isFavorite',
      'isOwned',
    ] as const

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (body.minShotCount !== undefined) {
      updateData.minShotCount = typeof body.minShotCount === 'number' ? body.minShotCount : null
    }

    const project = await prisma.storyboardProject.update({
      where: { id },
      data: updateData,
      include: {
        shots: {
          include: {
            assets: {
              include: { asset: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json({ project: normalizeProjectDetail(project) })
  } catch (error) {
    console.error('Update storyboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }

    const { id } = await context.params
    const existing = await prisma.storyboardProject.findFirst({
      where: { id, userId: session.payload.userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 })
    }

    await prisma.storyboardProject.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete storyboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
