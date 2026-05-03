'use client'

import { useEffect, useMemo, useState } from 'react'
import { DashboardSelect } from '@/components/dashboard/dashboard-select'
import type { DashboardAsset, DashboardTask } from '@/components/dashboard/types'
import { getStoredToken } from '@/lib/modules/auth/browser-session'

type StoryboardNavTab = 'ai-video' | 'ai-image' | 'assets' | 'subjects' | 'tasks'
type StoryboardView = 'hub' | 'script-upload' | 'story-upload' | 'shot-board'
type StoryboardMode = 'dialogue' | 'narration-first' | 'narration-full' | 'third-person'
type StoryboardProjectStatus = 'draft' | 'subject' | 'shots' | 'final'

export type StoryboardVideoCreationDraft = {
  prompt: string
  ratio: string
  duration: number
  referenceImages: DashboardAsset[]
  referenceVideos: DashboardAsset[]
  referenceAudios: DashboardAsset[]
}

type StoryboardPanelProps = {
  assets: DashboardAsset[]
  tasks: DashboardTask[]
  onNavigate: (tab: StoryboardNavTab) => void
  onStartVideoCreation?: (draft: StoryboardVideoCreationDraft) => void
}

type StoryboardProject = {
  id: string
  language?: string
  mode?: StoryboardMode
  ratio?: string
  themeId?: string
  themeLabel?: string | null
  minShotCount?: number | null
  content?: string | null
  title: string
  coverUrl?: string
  updatedAt: string
  status: StoryboardProjectStatus
  modeLabel: string
  type: 'script' | 'storyboard'
  shotCount?: number
  isOwned?: boolean
  isFavorite?: boolean
}

type StoryboardTheme = {
  id: string
  label: string
  badge?: 'HOT' | 'NEW'
  gradient: string
}

type StoryboardShot = {
  id: string
  index: number
  title: string
  visual: string
  narration: string
  duration: string
  shotType: string
  cameraAngle: string
  movement: string
  prompt: string
  assets: DashboardAsset[]
  assetLabels: string[]
}

const STORYBOARD_THEMES: StoryboardTheme[] = [
  { id: 'custom', label: '自定义', gradient: 'from-zinc-700 to-zinc-900' },
  { id: 'real-pro', label: '真人写实Pro', badge: 'HOT', gradient: 'from-orange-300 via-rose-300 to-violet-500' },
  { id: 'ancient-real', label: '真人古装Pro', badge: 'HOT', gradient: 'from-amber-300 via-rose-400 to-red-800' },
  { id: 'immortal-real', label: '真人仙侠Pro', badge: 'NEW', gradient: 'from-sky-200 via-indigo-300 to-slate-800' },
  { id: 'city-real', label: '欧美写实Pro', badge: 'NEW', gradient: 'from-slate-300 via-stone-400 to-zinc-900' },
  { id: 'real-city', label: '真人写实', badge: 'HOT', gradient: 'from-teal-200 via-cyan-300 to-zinc-800' },
  { id: 'real-ancient', label: '真人古装', badge: 'HOT', gradient: 'from-lime-100 via-pink-200 to-emerald-700' },
  { id: 'real-xianxia', label: '真人仙侠', badge: 'HOT', gradient: 'from-sky-100 via-blue-200 to-violet-800' },
  { id: 'age-real', label: '真人年代感', gradient: 'from-stone-200 via-zinc-300 to-stone-700' },
  { id: 'waste-real', label: '真人废土', gradient: 'from-amber-200 via-zinc-400 to-stone-900' },
  { id: 'anime-2d', label: '2D国风动漫', badge: 'HOT', gradient: 'from-teal-100 via-emerald-200 to-slate-800' },
  { id: 'anime-3d', label: '3D国风动漫', badge: 'HOT', gradient: 'from-orange-200 via-rose-300 to-amber-900' },
  { id: 'ancient-2d', label: '动漫古言', badge: 'NEW', gradient: 'from-lime-100 via-yellow-200 to-pink-700' },
  { id: 'apocalypse', label: '动漫末世', badge: 'NEW', gradient: 'from-orange-100 via-zinc-300 to-neutral-900' },
  { id: 'card-3d', label: '3D卡通', gradient: 'from-fuchsia-100 via-indigo-200 to-cyan-700' },
  { id: 'child-2d', label: '2D童话', badge: 'NEW', gradient: 'from-orange-100 via-amber-200 to-rose-600' },
  { id: 'soldier-2d', label: '2D废土', gradient: 'from-zinc-300 via-stone-400 to-zinc-900' },
  { id: 'ink', label: '水墨武侠', gradient: 'from-zinc-50 via-neutral-300 to-zinc-700' },
  { id: 'emoji', label: '熊猫头风格', gradient: 'from-zinc-200 via-zinc-300 to-zinc-600' },
  { id: 'campus', label: '2D日漫', gradient: 'from-emerald-100 via-sky-200 to-indigo-700' },
]

const SAMPLE_SHOTS: StoryboardShot[] = [
  {
    id: 'shot-1',
    index: 1,
    title: '窗外寒夜',
    visual: '廊下红灯笼在寒风中剧烈晃动，发出咳呀声。',
    narration: '@旁白：窗外春寒未退，风一吹，灯笼轻轻晃着，像有人在暗处摇头。',
    duration: '8S',
    shotType: '特写',
    cameraAngle: '平视',
    movement: '缓推',
    prompt: '@廊下中，特写镜头，平视角度，摄像机缓慢推进，廊下@红灯笼在寒风中剧烈晃动，发出咳呀声。',
    assets: [],
    assetLabels: ['廊下', '红灯笼'],
  },
  {
    id: 'shot-2',
    index: 2,
    title: '姜家正厅',
    visual: '姜家正厅，香炉烟雾缭绕，气氛闷热压抑。',
    narration: '@旁白：环境音里只剩炭火细微的噼啪声。',
    duration: '4S',
    shotType: '全景',
    cameraAngle: '俯视',
    movement: '固定机位',
    prompt: '@姜家正厅中，全景镜头，从俯视角度固定机位拍摄，香炉烟雾缭绕，气氛闷热压抑。',
    assets: [],
    assetLabels: ['姜家正厅'],
  },
  {
    id: 'shot-3',
    index: 3,
    title: '湿漉漉的裙摆',
    visual: '姜令仪湿漉漉的裙摆拖在冰冷的青砖地上，水滴滴落。',
    narration: '@旁白：姜令仪刚从水里被捞回来，身上还带着彻骨的寒。',
    duration: '6S',
    shotType: '特写',
    cameraAngle: '平视',
    movement: '横移',
    prompt: '@姜家正厅中，特写镜头，平视角度横移，@姜令仪湿漉漉的裙摆拖在冰冷的青砖地上，水滴不断滴落。',
    assets: [],
    assetLabels: ['姜令仪', '青砖地'],
  },
  {
    id: 'shot-4',
    index: 4,
    title: '众人沉默',
    visual: '一圈人站在烛火阴影里，面色复杂地望向地上的少女。',
    narration: '@旁白：没人开口，可每双眼睛都像在等她认命。',
    duration: '5S',
    shotType: '中景',
    cameraAngle: '低机位',
    movement: '慢推',
    prompt: '@姜家正厅中，中景镜头，低机位慢推，一圈人站在烛火阴影里，面色复杂地望向地上的少女。',
    assets: [],
    assetLabels: ['群像', '烛火'],
  },
]

const STEP_ITEMS = ['上传脚本', '主体管理', '分镜管理', '成片预览'] as const

const MODE_OPTIONS: Array<{ value: StoryboardMode; label: string; group: '标准模式' | '解说模式' }> = [
  { value: 'dialogue', label: '对白剧情模式', group: '标准模式' },
  { value: 'narration-first', label: '第一人称解说（旁白为主）', group: '解说模式' },
  { value: 'narration-full', label: '第一人称解说（纯旁白）', group: '解说模式' },
  { value: 'third-person', label: '第三人称解说（纯旁白）', group: '解说模式' },
]

function statusLabel(status: StoryboardProjectStatus) {
  if (status === 'draft') return '草稿'
  if (status === 'subject') return '主体管理'
  if (status === 'shots') return '分镜管理'
  return '成片'
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}

function toProjectStatus(value: string | undefined): StoryboardProjectStatus {
  if (value === 'subject' || value === 'shots' || value === 'final') {
    return value
  }
  return 'draft'
}

function normalizeProject(raw: any): StoryboardProject {
  return {
    id: raw.id,
    title: raw.title || '未命名故事板',
    coverUrl: raw.coverUrl || undefined,
    updatedAt: raw.updatedAt || new Date().toISOString(),
    status: toProjectStatus(raw.status),
    modeLabel: raw.modeLabel || '待补脚本',
    type: raw.type === 'storyboard' ? 'storyboard' : 'script',
    language: raw.language || 'zh',
    mode: raw.mode || 'dialogue',
    ratio: raw.ratio || '16:9',
    themeId: raw.themeId || 'custom',
    themeLabel: raw.themeLabel || null,
    minShotCount: typeof raw.minShotCount === 'number' ? raw.minShotCount : null,
    content: typeof raw.content === 'string' ? raw.content : null,
    shotCount: typeof raw.shotCount === 'number' ? raw.shotCount : 0,
    isOwned: raw.isOwned !== false,
    isFavorite: raw.isFavorite === true,
  }
}

function normalizeShot(raw: any): StoryboardShot {
  const assets = Array.isArray(raw.assets) ? raw.assets : []
  const durationValue = typeof raw.duration === 'number' ? raw.duration : Number(raw.duration || 5)
  return {
    id: raw.id,
    index: typeof raw.sortOrder === 'number' ? raw.sortOrder : Number(raw.sortOrder || 1),
    title: raw.title || '未命名分镜',
    visual: raw.visual || '',
    narration: raw.narration || '',
    duration: `${durationValue}S`,
    shotType: raw.shotType || '中景',
    cameraAngle: raw.cameraAngle || '平视',
    movement: raw.movement || '固定机位',
    prompt: raw.prompt || '',
    assets,
    assetLabels: assets.map((asset: DashboardAsset) => asset.subjectName || asset.name),
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export function StoryboardPanel({ assets, tasks, onNavigate, onStartVideoCreation }: StoryboardPanelProps) {
  const imageAssets = useMemo(() => assets.filter((asset) => asset.type === 'image'), [assets])
  const processingTaskCount = useMemo(
    () => tasks.filter((task) => ['pending', 'queued', 'running', 'processing', 'submit_unknown'].includes(task.status)).length,
    [tasks]
  )

  const [view, setView] = useState<StoryboardView>('hub')
  const [creationType, setCreationType] = useState<'script' | 'storyboard'>('script')
  const [selectedThemeId, setSelectedThemeId] = useState('custom')
  const [selectedRatio, setSelectedRatio] = useState('16:9')
  const [selectedMode, setSelectedMode] = useState<StoryboardMode>('dialogue')
  const [scriptLanguage, setScriptLanguage] = useState('中文')
  const [projects, setProjects] = useState<StoryboardProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectShots, setProjectShots] = useState<StoryboardShot[]>(SAMPLE_SHOTS.map((shot) => ({ ...shot, assets: [] })))
  const [selectedShotId, setSelectedShotId] = useState(SAMPLE_SHOTS[0].id)
  const [search, setSearch] = useState('')
  const [storyTitle, setStoryTitle] = useState('')
  const [scriptContent, setScriptContent] = useState('')
  const [minShotCount, setMinShotCount] = useState('12')
  const [workspaceFilter, setWorkspaceFilter] = useState<'all' | StoryboardProjectStatus>('all')
  const [workspaceTab, setWorkspaceTab] = useState<'works' | 'inspiration'>('works')
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [loadingProjectDetail, setLoadingProjectDetail] = useState(false)
  const [assetPickerShotId, setAssetPickerShotId] = useState<string | null>(null)

  const fetchProjects = async () => {
    const token = getStoredToken()
    if (!token) {
      return
    }

    setLoadingProjects(true)
    try {
      const response = await fetch('/api/storyboards', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        return
      }

      const data = await response.json()
      const nextProjects = Array.isArray(data.projects) ? data.projects.map(normalizeProject) : []
      setProjects(nextProjects)
      if (!selectedProjectId && nextProjects[0]) {
        setSelectedProjectId(nextProjects[0].id)
      }
    } finally {
      setLoadingProjects(false)
    }
  }

  const fetchProjectDetail = async (projectId: string) => {
    const token = getStoredToken()
    if (!token || !projectId) {
      return
    }

    setLoadingProjectDetail(true)
    try {
      const response = await fetch(`/api/storyboards/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('获取故事板详情失败')
      }

      const data = await response.json()
      const project = normalizeProject(data.project)
      const shots = Array.isArray(data.project?.shots) && data.project.shots.length > 0
        ? data.project.shots.map(normalizeShot)
        : SAMPLE_SHOTS.map((shot) => ({ ...shot, assets: [] }))

      setProjects((current) => {
        const others = current.filter((item) => item.id !== project.id)
        return [project, ...others].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      })
      setSelectedProjectId(project.id)
      setStoryTitle(project.title)
      setScriptContent(project.content || '')
      setSelectedRatio(project.ratio || '16:9')
      setSelectedThemeId(project.themeId || 'custom')
      setSelectedMode((project.mode as StoryboardMode) || 'dialogue')
      setMinShotCount(project.minShotCount ? String(project.minShotCount) : '12')
      setProjectShots(shots)
      setSelectedShotId(shots[0]?.id || '')
    } finally {
      setLoadingProjectDetail(false)
    }
  }

  useEffect(() => {
    void fetchProjects()
  }, [])

  const visibleProjects = useMemo(() => {
    return projects.filter((project) => {
      if (workspaceFilter !== 'all' && project.status !== workspaceFilter) return false
      if (search.trim() && !project.title.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [projects, search, workspaceFilter])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects[0] || null,
    [projects, selectedProjectId]
  )
  const selectedShot = useMemo(
    () => projectShots.find((shot) => shot.id === selectedShotId) || projectShots[0],
    [projectShots, selectedShotId]
  )
  const selectedTheme = useMemo(
    () => STORYBOARD_THEMES.find((theme) => theme.id === selectedThemeId) || STORYBOARD_THEMES[0],
    [selectedThemeId]
  )

  const handleOpenCreation = (type: 'script' | 'storyboard') => {
    setCreationType(type)
    setStoryTitle(type === 'script' ? '我有剧本' : '我有分镜脚本')
    setScriptContent('')
    setSelectedThemeId('custom')
    setSelectedRatio('16:9')
    setSelectedMode('dialogue')
    setProjectShots(SAMPLE_SHOTS.map((shot) => ({ ...shot, assets: [] })))
    setSelectedShotId(SAMPLE_SHOTS[0].id)
    setView(type === 'script' ? 'script-upload' : 'story-upload')
  }

  const handleOpenProject = (project: StoryboardProject) => {
    if (project.status === 'shots') {
      void fetchProjectDetail(project.id)
      setView('shot-board')
      return
    }
    setCreationType(project.type)
    void fetchProjectDetail(project.id)
    setView(project.type === 'script' ? 'script-upload' : 'story-upload')
  }

  const handleSaveDraft = async () => {
    const token = getStoredToken()
    if (!token) {
      window.alert('未登录，无法保存故事板')
      return
    }

    setSavingDraft(true)
    try {
      const response = await fetch('/api/storyboards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: storyTitle.trim() || '未命名故事板',
          type: creationType,
          status: 'shots',
          language: 'zh',
          mode: selectedMode,
          ratio: selectedRatio,
          themeId: selectedThemeId,
          themeLabel: selectedTheme.label,
          minShotCount: Number.isFinite(Number(minShotCount)) ? Number(minShotCount) : null,
          content: scriptContent,
          coverUrl: imageAssets[0]?.url || null,
          modeLabel: '多参考模式',
          createInitialShots: true,
        }),
      })

      if (!response.ok) {
        throw new Error('保存草稿失败')
      }

      const data = await response.json()
      const project = normalizeProject(data.project)
      setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)])
      await fetchProjectDetail(project.id)
      setView('shot-board')
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, '保存草稿失败'))
    } finally {
      setSavingDraft(false)
    }
  }

  const headerBreadcrumb =
    view === 'hub'
      ? '故事板'
      : view === 'shot-board'
        ? `故事板 / ${selectedProject?.title || '分镜管理'}`
        : `故事板 / ${creationType === 'script' ? '我有剧本' : '我有分镜脚本'}`

  const handleCreateShot = async () => {
    if (!selectedProjectId) return
    const token = getStoredToken()
    if (!token) return

    try {
      const response = await fetch(`/api/storyboards/${selectedProjectId}/shots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        throw new Error('新增分镜失败')
      }

      const data = await response.json()
      const shot = normalizeShot(data.shot)
      setProjectShots((current) => [...current, shot])
      setSelectedShotId(shot.id)
      await fetchProjects()
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, '新增分镜失败'))
    }
  }

  const handleDuplicateShot = async (shotId: string) => {
    const token = getStoredToken()
    if (!token) return

    try {
      const response = await fetch(`/api/storyboard-shots/${shotId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'duplicate' }),
      })

      if (!response.ok) {
        throw new Error('复制分镜失败')
      }

      await fetchProjectDetail(selectedProjectId)
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, '复制分镜失败'))
    }
  }

  const handleDeleteShot = async (shotId: string) => {
    const token = getStoredToken()
    if (!token) return
    if (!window.confirm('确定删除这个分镜吗？')) return

    try {
      const response = await fetch(`/api/storyboard-shots/${shotId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('删除分镜失败')
      }

      await fetchProjectDetail(selectedProjectId)
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, '删除分镜失败'))
    }
  }

  const handleToggleShotAsset = async (shotId: string, assetId: string) => {
    const token = getStoredToken()
    if (!token) return

    const shot = projectShots.find((item) => item.id === shotId)
    if (!shot) return

    const nextAssetIds = shot.assets.some((asset) => asset.id === assetId)
      ? shot.assets.filter((asset) => asset.id !== assetId).map((asset) => asset.id)
      : [...shot.assets.map((asset) => asset.id), assetId]

    try {
      const response = await fetch(`/api/storyboard-shots/${shotId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assetIds: nextAssetIds }),
      })

      if (!response.ok) {
        throw new Error('更新分镜素材失败')
      }

      const data = await response.json()
      const nextShot = normalizeShot(data.shot)
      setProjectShots((current) => current.map((item) => (item.id === nextShot.id ? nextShot : item)))
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, '更新分镜素材失败'))
    }
  }

  const launchShotVideo = (shot: StoryboardShot) => {
    if (onStartVideoCreation) {
      onStartVideoCreation({
        prompt: shot.prompt || shot.visual,
        ratio: selectedProject?.ratio || selectedRatio,
        duration: Number.parseInt(shot.duration.replace(/[^0-9]/g, ''), 10) || 5,
        referenceImages: shot.assets.filter((asset) => asset.type === 'image'),
        referenceVideos: shot.assets.filter((asset) => asset.type === 'video'),
        referenceAudios: shot.assets.filter((asset) => asset.type === 'audio'),
      })
      return
    }

    onNavigate('ai-video')
  }

  return (
    <div className="h-full overflow-y-auto bg-[#050505] p-6">
      <div className="mx-auto max-w-[1680px]">
        {view === 'hub' ? (
          <div className="space-y-8">
            <section className="grid gap-6 xl:grid-cols-3">
              {[
                {
                  title: '我有剧本',
                  badge: 'NEW',
                  description: '将基于原始剧本内容，生成 1 个故事板，适用于单集脚本。',
                  accent: 'from-blue-700 via-indigo-800 to-zinc-950',
                  onClick: () => handleOpenCreation('script'),
                },
                {
                  title: '我有分镜脚本',
                  description: '直接生成 1 个故事板，适用于已撰写好的分镜脚本。',
                  accent: 'from-indigo-700 via-violet-800 to-zinc-950',
                  onClick: () => handleOpenCreation('storyboard'),
                },
                {
                  title: '我有小说',
                  badge: '即将上线',
                  description: '智能解析原文结构，生成多个故事板，适合长篇小说或分集剧本。',
                  accent: 'from-zinc-900 via-zinc-900 to-zinc-950',
                  onClick: undefined,
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className={`rounded-[32px] border border-white/10 bg-gradient-to-br ${card.accent} p-8 shadow-[0_28px_80px_rgba(0,0,0,0.32)]`}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="max-w-[70%]">
                      <div className="flex items-center gap-3">
                        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50">{card.title}</h1>
                        {card.badge ? (
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/90">
                            {card.badge}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-5 text-lg leading-9 text-zinc-200/85">{card.description}</p>
                      {card.onClick ? (
                        <button
                          type="button"
                          onClick={card.onClick}
                          className="mt-8 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 px-10 py-4 text-lg font-medium text-white transition-all hover:from-blue-400 hover:to-cyan-400"
                        >
                          开始创建
                        </button>
                      ) : null}
                    </div>
                    <div className="relative hidden h-44 w-32 shrink-0 rounded-[28px] border border-white/10 bg-white/5 xl:block">
                      <div className="absolute inset-6 rounded-[24px] bg-gradient-to-br from-white/25 to-transparent" />
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <section>
              <div className="flex items-center gap-8">
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('works')}
                  className={`pb-3 text-4xl font-semibold tracking-tight ${workspaceTab === 'works' ? 'border-b-2 border-blue-500 text-zinc-50' : 'text-zinc-500'}`}
                >
                  我的作品
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('inspiration')}
                  className={`pb-3 text-4xl font-semibold tracking-tight ${workspaceTab === 'inspiration' ? 'border-b-2 border-blue-500 text-zinc-50' : 'text-zinc-500'}`}
                >
                  创作灵感
                </button>
              </div>

              <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-3">
                  {[
                    ['all', '全部状态'],
                    ['draft', '草稿'],
                    ['subject', '主体管理'],
                    ['shots', '分镜管理'],
                    ['final', '成片'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setWorkspaceFilter(value as 'all' | StoryboardProjectStatus)}
                      className={`rounded-2xl px-5 py-3 text-lg transition-all ${
                        workspaceFilter === value
                          ? 'bg-blue-600 text-white'
                          : 'border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-lg text-zinc-500">
                    处理中任务 {processingTaskCount}
                  </div>
                  <div className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3">
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="请输入故事板名称"
                      className="w-full bg-transparent text-lg text-zinc-100 outline-none placeholder:text-zinc-600"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-6 xl:grid-cols-3">
                {visibleProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleOpenProject(project)}
                    className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] text-left transition-all hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <div className="relative aspect-[4/3] bg-zinc-900">
                      {project.coverUrl ? (
                        <img src={project.coverUrl} alt={project.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-6xl text-zinc-700">片</div>
                      )}
                      <div className="absolute left-4 top-4 flex gap-2">
                        <span className="rounded-xl bg-zinc-900/80 px-3 py-1 text-sm text-zinc-200">
                          {statusLabel(project.status)}
                        </span>
                        <span className="rounded-xl border border-blue-500/40 bg-blue-500/15 px-3 py-1 text-sm text-blue-200">
                          {project.modeLabel}
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="text-3xl font-semibold text-zinc-50">{project.title}</div>
                      <div className="mt-4 text-lg text-zinc-500">{formatDate(project.updatedAt)}</div>
                    </div>
                  </button>
                ))}
                {!loadingProjects && visibleProjects.length === 0 ? (
                  <div className="col-span-full rounded-[32px] border border-dashed border-white/10 bg-white/[0.04] p-12 text-center text-zinc-500">
                    当前还没有故事板项目，先从上面的入口创建一个。
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {view === 'script-upload' || view === 'story-upload' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-6">
              <button
                type="button"
                onClick={() => setView('hub')}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-2xl text-zinc-200 transition-colors hover:bg-white/[0.08]"
              >
                {headerBreadcrumb}
              </button>

              <div className="flex flex-1 items-center justify-center gap-6">
                {STEP_ITEMS.map((item, index) => {
                  const active = index === 0
                  return (
                    <div key={item} className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-semibold ${active ? 'bg-blue-600 text-white' : 'border border-white/10 bg-white/[0.04] text-zinc-500'}`}>
                        {index + 1}
                      </div>
                      <span className={`text-2xl ${active ? 'text-zinc-50' : 'text-zinc-500'}`}>{item}</span>
                      {index < STEP_ITEMS.length - 1 ? <div className="hidden h-px w-20 bg-white/10 xl:block" /> : null}
                    </div>
                  )
                })}
              </div>

              <div className="text-xl text-zinc-400">操作指引</div>
            </div>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_680px]">
              <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
                <div className="grid gap-6">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_200px]">
                    <div>
                      <label className="mb-3 block text-2xl font-medium text-zinc-100">标题</label>
                      <input
                        value={storyTitle}
                        onChange={(event) => setStoryTitle(event.target.value)}
                        placeholder="请输入你的故事标题"
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-xl text-zinc-100 outline-none placeholder:text-zinc-600"
                      />
                    </div>
                    <div>
                      <label className="mb-3 block text-2xl font-medium text-zinc-100">剧本语言</label>
                      <DashboardSelect
                        value={scriptLanguage}
                        onChange={setScriptLanguage}
                        options={[
                          { value: '中文', label: '中文' },
                          { value: 'English', label: 'English' },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                    {view === 'script-upload' ? (
                      <div>
                        <label className="mb-3 block text-2xl font-medium text-zinc-100">剧本最小分镜数（选填）</label>
                        <input
                          value={minShotCount}
                          onChange={(event) => setMinShotCount(event.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-xl text-zinc-100 outline-none"
                        />
                      </div>
                    ) : <div />}

                    <div>
                      <label className="mb-3 block text-2xl font-medium text-zinc-100">拆分镜模式</label>
                      <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                        <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
                          <div className="border-b border-white/10 pb-4 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-6">
                            {MODE_OPTIONS.filter((option) => option.group === '标准模式').map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setSelectedMode(option.value)}
                                className={`flex w-full items-center gap-3 py-2 text-left text-xl ${selectedMode === option.value ? 'text-zinc-50' : 'text-zinc-500'}`}
                              >
                                <span className={`h-4 w-4 rounded-full ${selectedMode === option.value ? 'bg-blue-500' : 'border border-white/20'}`} />
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <div className="grid gap-3 xl:grid-cols-3">
                            {MODE_OPTIONS.filter((option) => option.group === '解说模式').map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setSelectedMode(option.value)}
                                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-lg ${selectedMode === option.value ? 'border-blue-500/40 bg-blue-500/10 text-zinc-50' : 'border-white/10 bg-white/[0.03] text-zinc-500'}`}
                              >
                                <span className={`h-4 w-4 rounded-full ${selectedMode === option.value ? 'bg-blue-500' : 'border border-white/20'}`} />
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <label className="text-2xl font-medium text-zinc-100">
                        {view === 'script-upload' ? '剧本' : '分镜脚本'}
                      </label>
                      <div className="text-xl text-emerald-400">
                        {view === 'script-upload' ? '导入剧本 TXT、DOCX 文件' : '导入分镜脚本 Excel 文件'}
                      </div>
                    </div>
                    <textarea
                      value={scriptContent}
                      onChange={(event) => setScriptContent(event.target.value)}
                      placeholder={view === 'script-upload' ? '请输入你的故事内容' : '请上传分镜脚本文件'}
                      className="min-h-[420px] w-full rounded-[28px] border border-white/10 bg-black/20 px-5 py-5 text-xl leading-9 text-zinc-100 outline-none placeholder:text-zinc-600"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-3">
                      {['都市', '修仙', '玄幻', '怪谈'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setScriptContent((current) => `${current}${current ? '\n' : ''}风格参考：${tag}`)}
                          className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-lg text-zinc-300"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    <div className="text-2xl text-zinc-500">0/5000</div>
                  </div>
                </div>
              </section>

              <aside className="space-y-6">
                <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="grid grid-cols-5 gap-3">
                    {STORYBOARD_THEMES.slice(0, 20).map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setSelectedThemeId(theme.id)}
                        className={`relative overflow-hidden rounded-[22px] border text-left transition-all ${selectedThemeId === theme.id ? 'border-blue-500/50 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]' : 'border-white/10'}`}
                      >
                        <div className={`aspect-[4/5] bg-gradient-to-br ${theme.gradient}`} />
                        {theme.badge ? (
                          <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-1 text-xs text-white">
                            {theme.badge}
                          </span>
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8 text-sm text-white">
                          {theme.label}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 text-right text-lg text-zinc-400">查看更多</div>
                </section>

                <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
                  <div className="text-2xl font-medium text-zinc-100">视频尺寸</div>
                  <DashboardSelect
                    value={selectedRatio}
                    onChange={setSelectedRatio}
                    className="mt-4"
                    options={['16:9', '9:16', '1:1', '3:4'].map((ratio) => ({ value: ratio, label: ratio }))}
                  />

                  <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="text-sm uppercase tracking-[0.18em] text-zinc-500">已选风格</div>
                    <div className={`mt-4 aspect-[4/3] rounded-[24px] bg-gradient-to-br ${selectedTheme.gradient}`} />
                    <div className="mt-4 text-xl text-zinc-100">{selectedTheme.label}</div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={savingDraft}
                    className="mt-6 w-full rounded-2xl bg-zinc-100 px-5 py-4 text-2xl font-medium text-zinc-950 transition-colors hover:bg-white"
                  >
                    {savingDraft ? '保存中...' : '保存草稿'}
                  </button>
                </section>
              </aside>
            </div>
          </div>
        ) : null}

        {view === 'shot-board' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-6">
              <button
                type="button"
                onClick={() => setView('hub')}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-2xl text-zinc-200 transition-colors hover:bg-white/[0.08]"
              >
                {headerBreadcrumb}
              </button>

              <div className="flex flex-1 items-center justify-center gap-6">
                {STEP_ITEMS.map((item, index) => {
                  const active = index === 2
                  return (
                    <div key={item} className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-semibold ${active ? 'bg-blue-600 text-white' : 'border border-white/10 bg-white/[0.04] text-zinc-500'}`}>
                        {index + 1}
                      </div>
                      <span className={`text-2xl ${active ? 'text-zinc-50' : 'text-zinc-500'}`}>{item}</span>
                      {index < STEP_ITEMS.length - 1 ? <div className="hidden h-px w-20 bg-white/10 xl:block" /> : null}
                    </div>
                  )
                })}
              </div>

              <div className="text-xl text-zinc-400">操作指引</div>
            </div>

            <div className="flex gap-6">
              <div className="min-w-0 flex-1 space-y-6">
                {projectShots.map((shot) => {
                  const active = selectedShot?.id === shot.id
                  return (
                    <div
                      key={shot.id}
                      className={`grid gap-0 rounded-[32px] border ${active ? 'border-blue-500/35 bg-white/[0.05]' : 'border-white/10 bg-white/[0.04]'} xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedShotId(shot.id)}
                        className="border-b border-white/10 p-6 text-left xl:border-b-0 xl:border-r"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-2xl font-semibold text-zinc-100">
                              {shot.index}
                            </div>
                            <div>
                              <div className="text-3xl font-semibold text-zinc-50">{shot.title}</div>
                              <div className="mt-1 text-lg text-zinc-500">画面描述</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleDuplicateShot(shot.id)
                              }}
                              className="text-xl text-zinc-400"
                            >
                              复制
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleDeleteShot(shot.id)
                              }}
                              className="text-xl text-red-400"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                        <p className="mt-6 text-2xl leading-10 text-zinc-200">{shot.visual}</p>
                        <div className="mt-8 text-2xl font-medium text-zinc-100">台词旁白</div>
                        <p className="mt-3 text-2xl leading-10 text-zinc-300">{shot.narration}</p>
                        <div className="mt-8 flex flex-wrap gap-3">
                          {[`时长: ${shot.duration}`, `景别: ${shot.shotType}`, `摄像机角度: ${shot.cameraAngle}`, `运镜: ${shot.movement}`].map((item) => (
                            <span key={item} className="rounded-2xl bg-white/[0.06] px-4 py-2 text-lg text-zinc-300">
                              {item}
                            </span>
                          ))}
                        </div>
                      </button>

                      <div className="p-6">
                        <div className="flex items-center justify-between gap-4">
                          <span className="rounded-2xl bg-white/[0.06] px-4 py-2 text-lg text-zinc-200">视频</span>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setAssetPickerShotId(shot.id)}
                              className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-lg text-zinc-200"
                            >
                              资产选择
                            </button>
                            <button
                              type="button"
                              onClick={() => launchShotVideo(shot)}
                              className="rounded-2xl bg-blue-600 px-5 py-3 text-lg font-medium text-white"
                            >
                              创作视频
                            </button>
                          </div>
                        </div>

                        <p className="mt-6 text-2xl leading-10 text-zinc-400">{shot.prompt}</p>
                        <div className="mt-8 flex flex-wrap gap-3">
                          {shot.assetLabels.map((label) => (
                            <span key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-lg text-zinc-200">
                              {label}
                            </span>
                          ))}
                          {shot.assetLabels.length === 0 ? (
                            <span className="rounded-2xl border border-dashed border-white/10 bg-white/[0.04] px-4 py-2 text-lg text-zinc-500">
                              暂未绑定素材
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <aside className="hidden w-[132px] shrink-0 xl:block">
                <div className="space-y-5">
                  <button
                    type="button"
                    onClick={() => void handleCreateShot()}
                    className="w-full rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-4xl text-zinc-300"
                  >
                    +
                  </button>
                  {projectShots.map((shot) => (
                    <button
                      key={shot.id}
                      type="button"
                      onClick={() => setSelectedShotId(shot.id)}
                      className={`w-full rounded-[24px] border px-4 py-10 text-center text-2xl transition-all ${selectedShot?.id === shot.id ? 'border-blue-500/50 bg-blue-500/10 text-white' : 'border-white/10 bg-white/[0.04] text-zinc-300'}`}
                    >
                      分镜{shot.index}
                    </button>
                  ))}
                </div>
              </aside>
            </div>

            <div className="sticky bottom-0 rounded-[28px] border border-white/10 bg-[#0a0a0a]/95 p-5 backdrop-blur">
              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate('ai-video')}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-4 text-2xl text-zinc-100"
                >
                  批量生成视频
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('ai-image')}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-4 text-2xl text-zinc-100"
                >
                  批量修复音频
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('assets')}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-4 text-2xl text-zinc-100"
                >
                  批量下载
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('tasks')}
                  className="rounded-2xl bg-zinc-100 px-10 py-4 text-2xl font-medium text-zinc-950"
                >
                  预览 / 成片合成
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {assetPickerShotId ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
            onClick={() => setAssetPickerShotId(null)}
          >
            <div
              className="max-h-[85vh] w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-[#090909] p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-2xl font-semibold text-zinc-50">为当前分镜选择素材</div>
                  <div className="mt-2 text-lg text-zinc-500">点击卡片即可绑定或移除素材</div>
                </div>
                <button
                  type="button"
                  onClick={() => setAssetPickerShotId(null)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-lg text-zinc-300"
                >
                  关闭
                </button>
              </div>

              <div className="mt-6 grid max-h-[68vh] gap-4 overflow-y-auto md:grid-cols-3 xl:grid-cols-5">
                {assets.map((asset) => {
                  const shot = projectShots.find((item) => item.id === assetPickerShotId)
                  const selected = !!shot?.assets.some((item) => item.id === asset.id)
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => void handleToggleShotAsset(assetPickerShotId, asset.id)}
                      className={`overflow-hidden rounded-[24px] border text-left transition-all ${selected ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 bg-white/[0.04]'}`}
                    >
                      <div className="aspect-square bg-zinc-900">
                        {asset.type === 'image' ? (
                          <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-zinc-500">{asset.type}</div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="truncate text-lg text-zinc-100">{asset.subjectName || asset.name}</div>
                        <div className="mt-2 text-sm text-zinc-500">{selected ? '已绑定' : '点击绑定'}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
