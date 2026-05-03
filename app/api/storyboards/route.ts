import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/lib/modules/auth/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function buildInitialShots(title: string, content?: string | null) {
  const baseTitle = title.trim() || '未命名故事板'
  const firstSentence = (content || '').split(/[\n。！？!?]/).map((item) => item.trim()).find(Boolean) || `${baseTitle} 的开场镜头`

  return [
    {
      sortOrder: 1,
      title: '开场建立',
      visual: firstSentence,
      narration: `旁白：${baseTitle} 的故事由此展开。`,
      duration: 5,
      shotType: '全景',
      cameraAngle: '平视',
      movement: '慢推',
      prompt: `${baseTitle}，开场建立镜头，平视，全景，慢推，氛围完整，叙事感强。`,
    },
    {
      sortOrder: 2,
      title: '人物进入',
      visual: `主角进入画面，推动 ${baseTitle} 的主要冲突。`,
      narration: '旁白：角色登场，情绪开始酝酿。',
      duration: 5,
      shotType: '中景',
      cameraAngle: '平视',
      movement: '跟拍',
      prompt: `${baseTitle}，主角进入画面，中景，平视，跟拍，人物状态清晰。`,
    },
    {
      sortOrder: 3,
      title: '情绪推进',
      visual: '关键细节或动作被放大，推动下一段剧情。',
      narration: '旁白：情绪与信息同时向前推进。',
      duration: 5,
      shotType: '特写',
      cameraAngle: '近距离',
      movement: '缓推',
      prompt: `${baseTitle}，关键细节特写，情绪张力明确，适合承接后续镜头。`,
    },
  ]
}

function normalizeProject(project: any) {
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
    shotCount: project.shots?.length ?? 0,
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }

    const projects = await prisma.storyboardProject.findMany({
      where: { userId: session.payload.userId },
      include: {
        shots: {
          select: { id: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({
      projects: projects.map(normalizeProject),
    })
  } catch (error) {
    console.error('Get storyboards error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }

    const body = await request.json()
    const {
      title,
      type,
      status,
      language,
      mode,
      ratio,
      themeId,
      themeLabel,
      minShotCount,
      content,
      coverUrl,
      modeLabel,
    } = body

    const safeTitle = typeof title === 'string' && title.trim() ? title.trim() : '未命名故事板'
    const shouldCreateShots = status === 'shots' || status === 'subject' || body.createInitialShots === true
    const initialShots = shouldCreateShots ? buildInitialShots(safeTitle, content) : []

    const project = await prisma.storyboardProject.create({
      data: {
        title: safeTitle,
        type: typeof type === 'string' ? type : 'script',
        status: typeof status === 'string' ? status : 'draft',
        language: typeof language === 'string' ? language : 'zh',
        mode: typeof mode === 'string' ? mode : 'dialogue',
        ratio: typeof ratio === 'string' ? ratio : '16:9',
        themeId: typeof themeId === 'string' ? themeId : 'custom',
        themeLabel: typeof themeLabel === 'string' ? themeLabel : null,
        minShotCount: typeof minShotCount === 'number' ? minShotCount : null,
        content: typeof content === 'string' ? content : null,
        coverUrl: typeof coverUrl === 'string' ? coverUrl : null,
        modeLabel: typeof modeLabel === 'string' ? modeLabel : null,
        userId: session.payload.userId,
        shots: initialShots.length > 0
          ? {
              create: initialShots,
            }
          : undefined,
      },
      include: {
        shots: {
          select: { id: true },
        },
      },
    })

    return NextResponse.json({
      project: normalizeProject(project),
    })
  } catch (error) {
    console.error('Create storyboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
