import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { importRemoteAssetToAsset } from '@/lib/modules/assets/import-remote-asset'
import { resolveTaskOutputVideoDuration } from '@/lib/modules/tasks/output-video-duration'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ASSET_LIST_MAX_LIMIT = 100

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

// Get assets list
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const subjectType = searchParams.get('subjectType')
    const search = (searchParams.get('search') || '').trim()
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')
    const shouldPaginate = Boolean(pageParam || limitParam)
    const page = parsePositiveInt(pageParam, 1)
    const limit = Math.min(parsePositiveInt(limitParam, 50), ASSET_LIST_MAX_LIMIT)
    const whereClause: Prisma.AssetWhereInput = {
      userId: payload.userId,
      ...(type && { type }),
      ...(category && { category }),
      ...(subjectType && { subjectType }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { subjectName: { contains: search } },
          { subjectType: { contains: search } },
        ],
      }),
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        ...(shouldPaginate ? { skip: (page - 1) * limit, take: limit } : {}),
      }),
      shouldPaginate
        ? prisma.asset.count({ where: whereClause })
        : Promise.resolve<number | null>(null),
    ])

    const buildResponse = (responseAssets: typeof assets) => NextResponse.json({
      assets: responseAssets,
      ...(shouldPaginate
        ? {
            pagination: {
              page,
              limit,
              total,
              hasMore: page * limit < (total || 0),
            },
          }
        : {}),
    })

    const videosMissingDuration = assets.filter((asset) => asset.type === 'video' && !asset.duration)

    if (videosMissingDuration.length === 0) {
      return buildResponse(assets)
    }

    const sourceTasks = await prisma.generationTask.findMany({
      where: {
        userId: payload.userId,
        outputUrl: {
          in: videosMissingDuration.map((asset) => asset.url),
        },
      },
      include: {
        referenceAssets: {
          select: {
            type: true,
            duration: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const durationByOutputUrl = new Map<string, number>()
    for (const task of sourceTasks) {
      const resolvedDuration = resolveTaskOutputVideoDuration(task)
      if (resolvedDuration && task.outputUrl) {
        durationByOutputUrl.set(task.outputUrl, resolvedDuration)
      }
    }

    const patchedAssets = assets.map((asset) => {
      if (asset.type !== 'video' || asset.duration) {
        return asset
      }

      const resolvedDuration = durationByOutputUrl.get(asset.url)
      if (!resolvedDuration) {
        return asset
      }

      return {
        ...asset,
        duration: resolvedDuration,
      }
    })

    const assetsToPersist = patchedAssets.filter(
      (asset) => asset.type === 'video' && asset.duration && videosMissingDuration.some((item) => item.id === asset.id)
    )

    if (assetsToPersist.length > 0) {
      await Promise.all(
        assetsToPersist.map((asset) =>
          prisma.asset.update({
            where: { id: asset.id },
            data: { duration: asset.duration },
          })
        )
      )
    }

    return buildResponse(patchedAssets)
  } catch (error) {
    console.error('Get assets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create asset record (after upload) or save as subject
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    
    // If saving as subject
    if (body.action === 'saveAsSubject') {
      const { sourceAssetId, subjectType, subjectName, name, type, url, size, contentType } = body
      
      const asset = await prisma.asset.create({
        data: {
          name: subjectName || name,
          type,
          url,
          size,
          contentType,
          category: 'subject',
          subjectType,
          subjectName: subjectName || name,
          sourceAssetId,
          userId: payload.userId,
        } as any, // Type assertion for Prisma client sync issue
      })
      
      return NextResponse.json({ asset })
    }
    
    // Save from URL (auto-save generated video)
    if (body.action === 'saveFromUrl') {
      const { url, name, type, category } = body
      const assetType = type === 'audio' ? 'audio' : type === 'image' ? 'image' : 'video'

      const asset = await importRemoteAssetToAsset({
        userId: payload.userId,
        sourceUrl: url,
        fileBaseName: name || `generated-${assetType}`,
        type: assetType,
      })

      if (category && category !== asset.category) {
        const updatedAsset = await prisma.asset.update({
          where: { id: asset.id },
          data: { category },
        })
        return NextResponse.json({ asset: updatedAsset })
      }

      return NextResponse.json({ asset })
    }
    
    // Regular asset creation
    const { name, type, url, size, duration, contentType, category, subjectType, subjectName } = body

    const asset = await prisma.asset.create({
      data: {
        name,
        type,
        url,
        size,
        duration,
        contentType,
        category: category || 'creation',
        subjectType: category === 'subject' ? subjectType : null,
        subjectName: category === 'subject' ? subjectName || name : null,
        userId: payload.userId,
      } as any, // Type assertion for Prisma client sync issue
    })

    return NextResponse.json({ asset })
  } catch (error) {
    console.error('Create asset error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Update asset (rename, change category, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, subjectName, subjectType, category } = body

    if (!id) {
      return NextResponse.json({ error: 'Asset ID required' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.asset.findFirst({
      where: { id, userId: payload.userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Build update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (subjectName !== undefined) updateData.subjectName = subjectName
    if (subjectType !== undefined) updateData.subjectType = subjectType
    if (category !== undefined) updateData.category = category

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ asset })
  } catch (error) {
    console.error('Update asset error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Delete asset
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const ids = searchParams.get('ids') // For batch delete

    if (!id && !ids) {
      return NextResponse.json({ error: 'Asset ID(s) required' }, { status: 400 })
    }

    // Single delete
    if (id) {
      // Verify ownership
      const existing = await prisma.asset.findFirst({
        where: { id, userId: payload.userId },
      })

      if (!existing) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
      }

      await prisma.asset.delete({ where: { id } })
      return NextResponse.json({ success: true, deleted: 1 })
    }

    // Batch delete
    if (ids) {
      const idArray = ids.split(',')
      const result = await prisma.asset.deleteMany({
        where: {
          id: { in: idArray },
          userId: payload.userId,
        },
      })
      return NextResponse.json({ success: true, deleted: result.count })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Delete asset error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
