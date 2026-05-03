import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/lib/modules/auth/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function requireOwnedShot(userId: string, shotId: string) {
  return prisma.storyboardShot.findFirst({
    where: {
      id: shotId,
      project: {
        userId,
      },
    },
    include: {
      assets: {
        include: { asset: true },
        orderBy: { sortOrder: 'asc' },
      },
      project: true,
    },
  })
}

function mapShot(shot: any) {
  return {
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
    assets: shot.assets.map((item: any) => item.asset),
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }

    const { id } = await context.params
    const existing = await requireOwnedShot(session.payload.userId, id)
    if (!existing) {
      return NextResponse.json({ error: 'Storyboard shot not found' }, { status: 404 })
    }

    const body = await request.json()

    if (body.action === 'duplicate') {
      const siblingShots = await prisma.storyboardShot.findMany({
        where: { projectId: existing.projectId },
        orderBy: { sortOrder: 'asc' },
      })

      await prisma.$transaction(
        siblingShots
          .filter((shot) => shot.sortOrder > existing.sortOrder)
          .map((shot) =>
            prisma.storyboardShot.update({
              where: { id: shot.id },
              data: { sortOrder: shot.sortOrder + 1 },
            })
          )
      )

      const duplicated = await prisma.storyboardShot.create({
        data: {
          projectId: existing.projectId,
          sortOrder: existing.sortOrder + 1,
          title: `${existing.title} 副本`,
          visual: existing.visual,
          narration: existing.narration,
          duration: existing.duration,
          shotType: existing.shotType,
          cameraAngle: existing.cameraAngle,
          movement: existing.movement,
          prompt: existing.prompt,
          assets: existing.assets.length > 0
            ? {
                create: existing.assets.map((item, index) => ({
                  sortOrder: index + 1,
                  assetId: item.assetId,
                })),
              }
            : undefined,
        },
        include: {
          assets: {
            include: { asset: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      })

      return NextResponse.json({ shot: mapShot(duplicated) })
    }

    const assetIds = Array.isArray(body.assetIds)
      ? body.assetIds.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
      : null

    const updateData: Record<string, unknown> = {}
    const allowedFields = ['title', 'visual', 'narration', 'shotType', 'cameraAngle', 'movement', 'prompt'] as const
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }
    if (body.duration !== undefined) {
      updateData.duration = typeof body.duration === 'number' ? body.duration : existing.duration
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.storyboardShot.update({
        where: { id: existing.id },
        data: updateData,
      })
    }

    if (assetIds) {
      const ownedAssets = await prisma.asset.findMany({
        where: {
          id: { in: assetIds },
          userId: session.payload.userId,
        },
        select: { id: true },
      })
      const ownedAssetIds = ownedAssets.map((asset) => asset.id)

      await prisma.storyboardShotAsset.deleteMany({
        where: { shotId: existing.id },
      })

      if (ownedAssetIds.length > 0) {
        await prisma.storyboardShotAsset.createMany({
          data: ownedAssetIds.map((assetId, index) => ({
            shotId: existing.id,
            assetId,
            sortOrder: index + 1,
          })),
        })
      }
    }

    const shot = await requireOwnedShot(session.payload.userId, id)
    return NextResponse.json({ shot: mapShot(shot) })
  } catch (error) {
    console.error('Update storyboard shot error:', error)
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
    const existing = await requireOwnedShot(session.payload.userId, id)
    if (!existing) {
      return NextResponse.json({ error: 'Storyboard shot not found' }, { status: 404 })
    }

    await prisma.storyboardShot.delete({ where: { id: existing.id } })

    const remainingShots = await prisma.storyboardShot.findMany({
      where: {
        projectId: existing.projectId,
        sortOrder: { gt: existing.sortOrder },
      },
      orderBy: { sortOrder: 'asc' },
    })

    if (remainingShots.length > 0) {
      await prisma.$transaction(
        remainingShots.map((shot) =>
          prisma.storyboardShot.update({
            where: { id: shot.id },
            data: { sortOrder: shot.sortOrder - 1 },
          })
        )
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete storyboard shot error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
