'use client'

import { useState, useRef, useCallback, useEffect, useMemo, type ChangeEvent, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { type DashboardStatsData } from '@/components/dashboard/stats-panel'
import { DashboardModalLayer } from '@/components/dashboard/dashboard-modal-layer'
import { DashboardMainContent } from '@/components/dashboard/dashboard-main-content'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'
import { ImageBboxEditorModal } from '@/components/dashboard/image-bbox-editor-modal'
import type {
  DashboardAsset as Asset,
  DashboardTask as Task,
  DashboardUploadItem,
  ImageGenerationUiMode,
  VideoImageSubMode,
  VideoGenerationUiMode,
} from '@/components/dashboard/types'
import { useAssetPicker } from '@/hooks/dashboard/use-asset-picker'
import { useDashboardBootstrap } from '@/hooks/dashboard/use-dashboard-bootstrap'
import { useDashboardData } from '@/hooks/dashboard/use-dashboard-data'
import { useAssetLibrary } from '@/hooks/dashboard/use-asset-library'
import { useDashboardUi } from '@/hooks/dashboard/use-dashboard-ui'
import { useGenerationEstimate } from '@/hooks/dashboard/use-generation-estimate'
import { useReferenceAssets } from '@/hooks/dashboard/use-reference-assets'
import { useTaskPresentation } from '@/hooks/dashboard/use-task-presentation'
import { useTeamAdmin } from '@/hooks/dashboard/use-team-admin'
import { useTaskPolling } from '@/hooks/dashboard/use-task-polling'
import { sortTasksByCreatedAtDesc, useTaskDisplay } from '@/hooks/dashboard/use-task-display'
import { useTaskSubmission } from '@/hooks/dashboard/use-task-submission'
import { useImageTaskSubmission } from '@/hooks/dashboard/use-image-task-submission'
import { clearBrowserSession, getStoredToken } from '@/lib/modules/auth/browser-session'
import type { ProviderGenerationMode, VideoGenerationProviderId } from '@/lib/modules/provider/types'
import {
  DEFAULT_VIDEO_MODEL,
  getVideoModelConfig,
  getVideoReferenceLimits,
  getSupportedVideoDurations,
  HAPPYHORSE_I2V_MODEL_ID,
  HAPPYHORSE_R2V_MODEL_ID,
  HAPPYHORSE_T2V_MODEL_ID,
  HAPPYHORSE_VIDEO_EDIT_MODEL_ID,
  isHappyHorseVideoModel,
  isWan27VideoModel,
  normalizeVideoDuration,
} from '@/lib/modules/video/models'
import {
  DEFAULT_IMAGE_MODEL,
  getImageModelConfig,
  normalizeImageMaxImages,
} from '@/lib/modules/image/models'
import {
  generateSize,
  inferSceneRatioQualityFromSize,
  isWan27ImageModel,
  type SizeTier,
  resolveEffectiveSizeTier,
  resolveWanSize,
  isValidCustomRatio,
  normalizeRatioString,
} from '@/lib/modules/image/size-config'
import type { ImageEditBBox } from '@/lib/modules/image/types'
import { Descendant } from 'slate'
import { initialEditorValue } from '@/lib/slate/create-editor'
import { serializeToApiPayload } from '@/lib/slate'
import { normalizePromptAstAssetLabels } from '@/lib/modules/tasks/reference-asset-order'
import { resolveTaskOutputVideoDuration } from '@/lib/modules/tasks/output-video-duration'
import { INLINE_IMAGE_MAX_BYTES } from '@/lib/modules/storage/media-input-policy'

// Hover preview state for @ references
interface HoverPreview {
  asset: Asset | null
  position: { x: number; y: number }
}

const DASHBOARD_TABS = [
  'ai-video',
  'assets',
  'tasks',
  'stats',
  'team',
] as const

type DashboardTab = (typeof DASHBOARD_TABS)[number]

function isDashboardTab(value: string | null): value is DashboardTab {
  return DASHBOARD_TABS.includes((value || '') as DashboardTab)
}

function normalizeDashboardTab(value: string | null): DashboardTab {
  return isDashboardTab(value) ? value : 'ai-video'
}

function mapProviderModeToVideoUiMode(mode: string): VideoGenerationUiMode {
  switch (mode) {
    case 'text_to_video':
      return 'text_to_video'
    case 'reference':
      return 'reference'
    case 'video_edit':
      return 'video_edit'
    case 'first_frame':
    case 'first_last_frame':
    case 'first_clip':
    default:
      return 'image_to_video'
  }
}

function resolveVideoUiModeFallback(model: string, currentMode: VideoGenerationUiMode): VideoGenerationUiMode {
  const modelConfig = getVideoModelConfig(model)

  if (currentMode === 'text_to_video' && modelConfig.supportedModes.includes('text_to_video')) {
    return 'text_to_video'
  }

  if (currentMode === 'reference' && modelConfig.supportedModes.includes('reference')) {
    return 'reference'
  }

  if (currentMode === 'video_edit' && modelConfig.supportedModes.includes('video_edit')) {
    return 'video_edit'
  }

  if (
    currentMode === 'image_to_video'
    && (modelConfig.supportedModes.includes('first_frame') || modelConfig.supportedModes.includes('first_clip'))
  ) {
    return 'image_to_video'
  }

  return mapProviderModeToVideoUiMode(modelConfig.defaultMode)
}

function resolveWan27ModelForUiMode(mode: VideoGenerationUiMode) {
  if (mode === 'text_to_video') {
    return 'wan2.7-t2v'
  }

  if (mode === 'image_to_video') {
    return 'wan2.7-i2v'
  }

  if (mode === 'video_edit') {
    return 'wan2.7-videoedit'
  }

  return 'wan2.7-r2v'
}

function resolveHappyHorseModelForUiMode(mode: VideoGenerationUiMode) {
  if (mode === 'text_to_video') {
    return HAPPYHORSE_T2V_MODEL_ID
  }

  if (mode === 'image_to_video') {
    return HAPPYHORSE_I2V_MODEL_ID
  }

  if (mode === 'video_edit') {
    return HAPPYHORSE_VIDEO_EDIT_MODEL_ID
  }

  return HAPPYHORSE_R2V_MODEL_ID
}

function mapVideoUiModeToProviderMode(
  mode: VideoGenerationUiMode,
  imageSubMode: VideoImageSubMode,
): ProviderGenerationMode {
  if (mode === 'text_to_video') return 'text_to_video'
  if (mode === 'image_to_video') return imageSubMode
  if (mode === 'video_edit') return 'video_edit'
  return 'reference'
}

export default function DashboardPage() {
  const defaultVideoModelConfig = getVideoModelConfig(DEFAULT_VIDEO_MODEL)
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskCenterTasks, setTaskCenterTasks] = useState<Task[]>([])
  const [pendingTasks, setPendingTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<DashboardStatsData | null>(null)
  const [uploadItems, setUploadItems] = useState<DashboardUploadItem[]>([])
  const [taskPage, setTaskPage] = useState(1) // Pagination
  const [hasMoreTasks, setHasMoreTasks] = useState(true) // 是否还有更多
  
  // Asset library state
  const [assetLibraryTab, setAssetLibraryTab] = useState<'creation' | 'subject'>('creation')
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'character' | 'scene' | 'prop'>('all')
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null)
  
  // Asset management state
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [showAssetDetail, setShowAssetDetail] = useState(false)
  const [assetActionMenu, setAssetActionMenu] = useState<string | null>(null) // Asset ID with open menu
  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState<Asset | null>(null)
  const [assetTypeFilter, setAssetTypeFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all') // Asset type filter
  const [saveAsSubjectAsset, setSaveAsSubjectAsset] = useState<Asset | null>(null) // For save as subject modal
  
  // Team management state (admin only)
  const [teamInfo, setTeamInfo] = useState<any>(null)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [showEditMemberModal, setShowEditMemberModal] = useState(false)
  const [editingMember, setEditingMember] = useState<any>(null)
  const [showRechargeModal, setShowRechargeModal] = useState(false)
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [allocatingMember, setAllocatingMember] = useState<any>(null)
  
  // Task center state
  const [taskViewAll, setTaskViewAll] = useState(false) // Admin toggle to view all team tasks
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'submit_unknown'>('all')
  const [taskMemberFilter, setTaskMemberFilter] = useState<string>('all')
  const [taskTeamMembers, setTaskTeamMembers] = useState<{id: string, name: string}[]>([])
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<Task | null>(null)
  const [isTaskAdmin, setIsTaskAdmin] = useState(false)
  const [statsViewTeam, setStatsViewTeam] = useState(false) // Admin toggle to view team stats
  
  // Generation form state
  const [prompt, setPrompt] = useState('')
  const [editorValue, setEditorValue] = useState<Descendant[]>(initialEditorValue)
  const [editorKey, setEditorKey] = useState(0)  // 👈 用于强制重新创建编辑器
  const [ratio, setRatio] = useState(defaultVideoModelConfig.defaultRatio)
  const [resolution, setResolution] = useState(defaultVideoModelConfig.defaultResolution)
  const [duration, setDuration] = useState(defaultVideoModelConfig.defaultDuration)
  const [videoCount, setVideoCount] = useState(1)
  const [videoPromptExtend, setVideoPromptExtend] = useState(true)
  const [videoSeed, setVideoSeed] = useState('')
  const [videoGenerateAudio, setVideoGenerateAudio] = useState(true)
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState('ai-video')
  // Video generation mode: image_to_video, reference, text_to_video, video_edit
  const [videoGenMode, setVideoGenMode] = useState<VideoGenerationUiMode>('reference')
  // Sub mode for image_to_video: first_frame, first_last_frame
  const [imageGenSubMode, setImageGenSubMode] = useState<VideoImageSubMode>('first_frame')
  const [referenceSubMode, setReferenceSubMode] = useState<'reference'>('reference')
  // Model selection
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_VIDEO_MODEL)
  const [imageSelectedModel, setImageSelectedModel] = useState<string>(DEFAULT_IMAGE_MODEL)
  
  // Reference materials - unified list with type distinction
  const [referenceImages, setReferenceImages] = useState<Asset[]>([])
  const [referenceVideos, setReferenceVideos] = useState<Asset[]>([])
  const [referenceAudios, setReferenceAudios] = useState<Asset[]>([])
  const [imageReferenceImages, setImageReferenceImages] = useState<Asset[]>([])
  const [imagePrompt, setImagePrompt] = useState('')
  const [imageEditorValue, setImageEditorValue] = useState<Descendant[]>(initialEditorValue)
  const [imageEditorKey, setImageEditorKey] = useState(0)
  const [imageSize, setImageSize] = useState('2K')
  const [imageRatio, setImageRatio] = useState('1:1')
  const [imageRatioMode, setImageRatioMode] = useState<'preset' | 'custom'>('preset')
  const [imageSizeTier, setImageSizeTier] = useState<SizeTier>('2K')
  const [imageCustomRatio, setImageCustomRatio] = useState('')
  const [imageOutputFormat, setImageOutputFormat] = useState<'jpeg' | 'png'>('jpeg')
  const [imagePromptExtend, setImagePromptExtend] = useState(getImageModelConfig(DEFAULT_IMAGE_MODEL).defaultPromptExtend)
  const [imageSequentialMode, setImageSequentialMode] = useState<'disabled' | 'auto'>('disabled')
  const [imageGenerationMode, setImageGenerationMode] = useState<ImageGenerationUiMode>('single')
  const [imageMaxImages, setImageMaxImages] = useState(4)
  const [imageWatermark, setImageWatermark] = useState(false)
  const [imageEnableWebSearch, setImageEnableWebSearch] = useState(false)
  const [imageTasks, setImageTasks] = useState<Task[]>([])
  const [isImageGenerating, setIsImageGenerating] = useState(false)
  const [imageReferenceBoxesByAssetId, setImageReferenceBoxesByAssetId] = useState<Record<string, ImageEditBBox[]>>({})
  const [editingImageBboxAsset, setEditingImageBboxAsset] = useState<Asset | null>(null)
  
  // Asset picker mode: 'image' | 'video' | 'audio'
  const [assetPickerMode, setAssetPickerMode] = useState<'image' | 'video' | 'audio'>('image')
  
  // Multi-select state for asset picker
  const [selectedPickerAssets, setSelectedPickerAssets] = useState<Asset[]>([])
  
  // Asset picker pagination and search
  const [assetPickerSearch, setAssetPickerSearch] = useState('')
  
  // Drag state for reordering
  const [draggedItem, setDraggedItem] = useState<{type: 'image' | 'video' | 'audio', index: number} | null>(null)
  
  const {
    filteredAssets,
    filteredAssetCount,
    visibleAssets,
    hasMoreAssets,
    isLoadingAssets: isAssetPickerLoading,
    assetLoadError,
    handleAssetPickerScroll,
    prependAssetPickerAssets,
  } = useAssetPicker(assets, showAssetPicker, assetPickerMode, assetPickerSearch)
  
  // Display filter for right panel
  const [displayFilter, setDisplayFilter] = useState<'all' | 'video' | 'image'>('all')
    const [statusFilter, setStatusFilter] = useState<'all' | 'succeeded' | 'failed' | 'processing'>('all')
  
  // Settings modal state
  const [showSettings, setShowSettings] = useState(false)
  const [videoProviderId, setVideoProviderId] = useState<VideoGenerationProviderId>('volcengine')
  const [apiKey, setApiKey] = useState('')
  const [seedanceUrl, setSeedanceUrl] = useState('https://ark.cn-beijing.volces.com')
  const [storageProviderId, setStorageProviderId] = useState<'tos' | 'oss'>('tos')
  const [storageProviders, setStorageProviders] = useState<Array<{ id: 'tos' | 'oss'; label: string; configured: boolean }>>([
    { id: 'tos', label: '火山 TOS', configured: true },
    { id: 'oss', label: '阿里云 OSS', configured: false },
  ])
  const [maxConcurrentTasks, setMaxConcurrentTasks] = useState(5)
  const [maxRequestsPerMinute, setMaxRequestsPerMinute] = useState(20)
  const [memberCooldownSeconds, setMemberCooldownSeconds] = useState(10)
  const hasObjectStorage = useMemo(() => storageProviders.some((provider) => provider.configured), [storageProviders])
  const canUploadAssets = hasObjectStorage
  const [isConfigAdmin, setIsConfigAdmin] = useState(false)
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)  // System-level admin
  
  // Hover preview for @ references in results
  const [hoverPreview, setHoverPreview] = useState<HoverPreview>({ asset: null, position: { x: 0, y: 0 } })
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null)
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null)
  const activeTabRef = useRef<DashboardTab>('ai-video')
  const hasSyncableTasks =
    pendingTasks.length > 0
    || tasks.some((task) => ['processing', 'pending', 'queued', 'running', 'submit_unknown'].includes(task.status))
    || imageTasks.some((task) => ['processing', 'pending', 'queued', 'running', 'submit_unknown'].includes(task.status))

  const updateDashboardUrl = useCallback((nextTab: DashboardTab, mode: 'push' | 'replace' = 'push') => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    params.set('tab', nextTab)
    const query = params.toString()
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (nextUrl === currentUrl) {
      return
    }

    if (mode === 'replace') {
      window.history.replaceState(window.history.state, '', nextUrl)
      return
    }

    window.history.pushState(window.history.state, '', nextUrl)
  }, [])

  const setActiveTabWithHistory = useCallback((
    value: SetStateAction<string>,
    options?: { history?: 'push' | 'replace' },
  ) => {
    const historyMode = options?.history ?? 'push'

    setActiveTab((previous) => {
      const resolvedValue = typeof value === 'function' ? value(previous) : value
      const nextTab = normalizeDashboardTab(resolvedValue)

      if (nextTab !== previous) {
        updateDashboardUrl(nextTab, historyMode)
      } else if (typeof window !== 'undefined' && !new URLSearchParams(window.location.search).get('tab')) {
        updateDashboardUrl(nextTab, 'replace')
      }

      return nextTab
    })
  }, [updateDashboardUrl])

  const handleInvalidSession = useCallback(() => {
    clearBrowserSession()
    router.push('/login')
  }, [router])

  const {
    fetchAssets,
    fetchTasks,
    syncPendingTasks,
    fetchStats,
    fetchTeamConfig,
    fetchTeamData,
  } = useDashboardData({
    setAssets,
    setTasks,
    setIsTaskAdmin,
    setTaskTeamMembers,
    setStats,
    setApiKey,
    setVideoProviderId,
    setSeedanceUrl,
    setStorageProviderId,
    setStorageProviders,
    setMaxConcurrentTasks,
    setMaxRequestsPerMinute,
    setMemberCooldownSeconds,
    setIsConfigAdmin,
    setApiKeyConfigured,
    setIsSuperAdmin,
    setTeamInfo,
    setTeamMembers,
    onInvalidSession: handleInvalidSession,
  })

  const fetchImageTasks = useCallback(async () => {
    const token = getStoredToken()
    const response = await fetch('/api/image-tasks?page=1&limit=20', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) {
      const data = await response.json()
      setImageTasks(data.tasks || [])
    } else if (response.status === 401 || response.status === 404) {
      handleInvalidSession()
    }
  }, [handleInvalidSession])

  const fetchTaskCenterTasks = useCallback(async (
    viewAll = false,
    status: 'all' | 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'submit_unknown' = 'all',
    member = 'all',
    page = 1,
    append = false,
  ) => {
    const token = getStoredToken()

    const params = new URLSearchParams()
    params.set('includeImageTasks', 'true')
    if (viewAll) params.set('viewAll', 'true')
    if (status !== 'all') params.set('status', status)
    if (member !== 'all') params.set('member', member)
    params.set('page', page.toString())
    params.set('limit', '20')

    const response = await fetch(`/api/tasks?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) {
      const data = await response.json()
      if (append) {
        setTaskCenterTasks((prev) => [...prev, ...data.tasks])
      } else {
        setTaskCenterTasks(data.tasks || [])
      }

      setIsTaskAdmin(data.isAdmin || false)
      if (data.teamMembers) {
        setTaskTeamMembers(data.teamMembers)
      }

      return {
        hasMore: data.pagination?.hasMore ?? true,
        page,
      }
    }

    if (response.status === 401 || response.status === 404) {
      handleInvalidSession()
    }

    return { hasMore: false, page }
  }, [handleInvalidSession])

  const syncPendingImageTasks = useCallback(async (options?: {
    taskIds?: string[]
    limit?: number
  }) => {
    const token = getStoredToken()
    const response = await fetch('/api/image-tasks/sync-pending', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        taskIds: options?.taskIds || [],
        limit: options?.limit,
      }),
    })

    if (response.ok) {
      return response.json()
    }

    if (response.status === 401 || response.status === 404) {
      handleInvalidSession()
    }

    return null
  }, [handleInvalidSession])

  const {
    openTeamSettings,
    handleVideoProviderChange,
    saveTeamConfig,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    rechargeTeamBudget,
    allocateBudget,
  } = useTeamAdmin({
    apiKey,
    videoProviderId,
    seedanceUrl,
    storageProviderId,
    maxConcurrentTasks,
    maxRequestsPerMinute,
    memberCooldownSeconds,
    isConfigAdmin,
    setApiKey,
    setVideoProviderId,
    setSeedanceUrl,
    setStorageProviderId,
    setMaxConcurrentTasks,
    setMaxRequestsPerMinute,
    setMemberCooldownSeconds,
    setSavingConfig,
    setApiKeyConfigured,
    setShowSettings,
    fetchTeamData,
    setShowAddMemberModal,
    setShowEditMemberModal,
    setEditingMember,
    setShowRechargeModal,
    setShowAllocateModal,
    setAllocatingMember,
  })

  const referenceUploadModel = activeTab === 'ai-image'
    ? imageSelectedModel
    : selectedModel
  const referenceUploadFamily = activeTab === 'ai-image' ? 'image' : 'video'

  const {
    broadcastAssetChange,
    deleteAsset,
    updateAsset,
    handleSaveAsSubject,
    handleReferenceUpload,
    handleFileUpload,
  } = useAssetLibrary({
    referenceUploadModel,
    referenceUploadFamily,
    setAssets,
    setUploadItems,
    setEditingAsset,
    setShowAssetDetail,
    setAssetActionMenu,
    setDeleteConfirmAsset,
    setSaveAsSubjectAsset,
    setReferenceImages: activeTab === 'ai-image' ? setImageReferenceImages : setReferenceImages,
    setReferenceVideos: activeTab === 'ai-image' ? ((_: any) => {}) as typeof setReferenceVideos : setReferenceVideos,
    setReferenceAudios: activeTab === 'ai-image' ? ((_: any) => {}) as typeof setReferenceAudios : setReferenceAudios,
    setShowAssetPicker,
    onAssetsUploaded: prependAssetPickerAssets,
  })

  useDashboardBootstrap({
    router,
    setUser,
    setApiKey,
    setSeedanceUrl,
    shouldResumeSync: hasSyncableTasks,
    callbacks: {
      fetchAssets,
      fetchTasks: fetchTasks as any,  // 类型断言以匹配 BootstrapCallbacks
      syncPendingTasks: syncPendingTasks as any,
      fetchImageTasks,
      syncPendingImageTasks,
      fetchStats,
      fetchTeamData,
      fetchTeamConfig,
    },
  })

  useTaskPolling({
    tasks,
    imageTasks,
    pendingTaskCount: pendingTasks.length,
    callbacks: {
      fetchTasks,
      fetchStats,
      syncPendingTasks,
      fetchImageTasks,
      syncPendingImageTasks,
      fetchAssets,
    },
  })

  useEffect(() => {
    void fetchImageTasks()
  }, [fetchImageTasks])

  useEffect(() => {
    void fetchTaskCenterTasks(false, 'all', 'all', 1, false).then((result) => {
      if (result) {
        setTaskPage(1)
        setHasMoreTasks(result.hasMore)
      }
    })
  }, [fetchTaskCenterTasks])

  const refreshGenerationTasks = useCallback(async () => {
    await Promise.all([
      syncPendingImageTasks({ limit: 50 }),
      syncPendingTasks({ limit: 50 }),
    ])

    await Promise.all([
      fetchImageTasks(),
      fetchTasks(),
      fetchStats(),
      fetchAssets(),
    ])
  }, [fetchAssets, fetchImageTasks, fetchStats, fetchTasks, syncPendingImageTasks, syncPendingTasks])

  useEffect(() => {
    activeTabRef.current = normalizeDashboardTab(activeTab)
  }, [activeTab])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncTabFromLocation = () => {
      const params = new URLSearchParams(window.location.search)
      const nextTab = normalizeDashboardTab(params.get('tab'))
      activeTabRef.current = nextTab
      setActiveTab(nextTab)
    }

    syncTabFromLocation()

    if (!new URLSearchParams(window.location.search).get('tab')) {
      updateDashboardUrl(activeTabRef.current, 'replace')
    }

    window.addEventListener('popstate', syncTabFromLocation)

    return () => {
      window.removeEventListener('popstate', syncTabFromLocation)
    }
  }, [updateDashboardUrl])

  useEffect(() => {
    if (user?.role !== 'admin' && activeTab === 'team') {
      setActiveTabWithHistory('ai-video', { history: 'replace' })
    }
  }, [activeTab, setActiveTabWithHistory, user?.role])

  useEffect(() => {
    const modelConfig = getVideoModelConfig(selectedModel)
    const supportedDurations = getSupportedVideoDurations(selectedModel, {
      hasReferenceVideo: referenceVideos.length > 0,
    })

    if (!modelConfig.supportedResolutions.includes(resolution)) {
      setResolution(modelConfig.defaultResolution)
    }

    if (!modelConfig.supportedRatios.includes(ratio)) {
      setRatio(modelConfig.defaultRatio)
    }

    if (!supportedDurations.includes(duration)) {
      setDuration(normalizeVideoDuration(selectedModel, duration, {
        hasReferenceVideo: referenceVideos.length > 0,
      }))
    }

    const normalizedVideoMode = resolveVideoUiModeFallback(selectedModel, videoGenMode)
    if (normalizedVideoMode !== videoGenMode) {
      setVideoGenMode(normalizedVideoMode)
    }

    if (normalizedVideoMode === 'image_to_video') {
      const supportsAnyImageToVideoMode =
        modelConfig.supportedModes.includes('first_frame')
        || modelConfig.supportedModes.includes('first_clip')

      if (!supportsAnyImageToVideoMode) {
        setVideoGenMode(resolveVideoUiModeFallback(selectedModel, 'image_to_video'))
      } else {
        const supportedImageSubModes = modelConfig.supportedModes.filter(
          (mode): mode is VideoImageSubMode =>
            mode === 'first_frame' || mode === 'first_last_frame' || mode === 'first_clip',
        )
        const fallbackImageSubMode = supportedImageSubModes[0] || 'first_frame'
        const normalizedImageSubMode = supportedImageSubModes.includes(imageGenSubMode)
          ? imageGenSubMode
          : fallbackImageSubMode

        if (normalizedImageSubMode !== imageGenSubMode) {
          setImageGenSubMode(normalizedImageSubMode)
        }

        const maxImageReferencesForMode =
          normalizedImageSubMode === 'first_last_frame'
            ? 2
            : normalizedImageSubMode === 'first_clip'
              ? 1
              : 1
        const maxVideoReferencesForMode = normalizedImageSubMode === 'first_clip' ? 1 : 0

        if (referenceImages.length > maxImageReferencesForMode) {
          setReferenceImages((previous) => previous.slice(0, maxImageReferencesForMode))
        }

        if (referenceVideos.length > maxVideoReferencesForMode) {
          setReferenceVideos((previous) => previous.slice(0, maxVideoReferencesForMode))
        }

        if (referenceAudios.length > 0) {
          setReferenceAudios([])
        }
      }
    }

    if (normalizedVideoMode === 'video_edit') {
      const limits = getVideoReferenceLimits(selectedModel, 'video_edit')

      if (videoCount !== 1) {
        setVideoCount(1)
      }

      if (typeof limits.maxVideos === 'number' && referenceVideos.length > limits.maxVideos) {
        setReferenceVideos((previous) => previous.slice(0, limits.maxVideos as number))
      }

      if (typeof limits.maxImages === 'number' && referenceImages.length > limits.maxImages) {
        setReferenceImages((previous) => previous.slice(0, limits.maxImages as number))
      }

      if (referenceAudios.length > 0) {
        setReferenceAudios([])
      }
    }

    if (normalizedVideoMode === 'reference') {
      const limits = getVideoReferenceLimits(selectedModel, 'reference')
      if (typeof limits.maxImages === 'number' && referenceImages.length > limits.maxImages) {
        setReferenceImages((previous) => previous.slice(0, limits.maxImages as number))
      }

      if (typeof limits.maxVideos === 'number' && referenceVideos.length > limits.maxVideos) {
        setReferenceVideos((previous) => previous.slice(0, limits.maxVideos as number))
      }

      if (typeof limits.maxAudios === 'number' && referenceAudios.length > limits.maxAudios) {
        setReferenceAudios((previous) => previous.slice(0, limits.maxAudios as number))
      }

      if (typeof limits.maxTotalVisual === 'number' && referenceImages.length + referenceVideos.length > limits.maxTotalVisual) {
        const imageSlots = Math.max(0, limits.maxTotalVisual - referenceVideos.length)
        setReferenceImages((previous) => previous.slice(0, imageSlots))
      }
    }
  }, [
    duration,
    imageGenSubMode,
    ratio,
    referenceAudios.length,
    referenceImages.length,
    referenceVideos.length,
    resolution,
    selectedModel,
    videoCount,
    videoGenMode,
  ])

  useEffect(() => {
    const imageModelConfig = getImageModelConfig(imageSelectedModel)
    const usesWanSizeSystem = isWan27ImageModel(imageSelectedModel)
    const effectiveTier = resolveEffectiveSizeTier(
      imageSelectedModel,
      imageSizeTier,
      imageReferenceImages.length > 0,
      imageGenerationMode === 'group',
    )

    if (!usesWanSizeSystem && !imageModelConfig.supportedSizes.includes(imageSize as never)) {
      setImageSize(imageModelConfig.defaultSize)
    }

    if (imageSizeTier !== effectiveTier) {
      setImageSizeTier(effectiveTier)
    }

    if (usesWanSizeSystem) {
      const nextSize = resolveWanSize(effectiveTier, imageRatio)
      if (imageSize !== nextSize) {
        setImageSize(nextSize)
      }
    }

    if (!imageModelConfig.supportedOutputFormats.includes(imageOutputFormat)) {
      setImageOutputFormat(imageModelConfig.defaultOutputFormat)
    }

    if (!imageModelConfig.supportsSequential) {
      if (imageGenerationMode === 'group') {
        setImageGenerationMode('single')
      }
      if (imageSequentialMode !== 'disabled') {
        setImageSequentialMode('disabled')
      }
      if (imageMaxImages !== 1) {
        setImageMaxImages(1)
      }
    } else {
      const normalizedMaxImages = normalizeImageMaxImages(imageSelectedModel, imageMaxImages)
      if (imageMaxImages !== normalizedMaxImages) {
        setImageMaxImages(normalizedMaxImages)
      }
    }

    if (!imageModelConfig.supportsWebSearch && imageEnableWebSearch) {
      setImageEnableWebSearch(false)
    }

    if (!imageModelConfig.supportsPromptExtend) {
      if (imagePromptExtend) {
        setImagePromptExtend(false)
      }
    }

    if (imageReferenceImages.length > imageModelConfig.maxReferenceImages) {
      setImageReferenceImages((prev) => prev.slice(0, imageModelConfig.maxReferenceImages))
    }

    if (!imageModelConfig.supportedModes.includes('image_to_image') && imageReferenceImages.length > 0) {
      setImageReferenceImages([])
    }

    if (!imageModelConfig.supportsBboxEdit) {
      setImageReferenceBoxesByAssetId((previous) => {
        if (Object.keys(previous).length === 0) {
          return previous
        }

        return {}
      })

      if (editingImageBboxAsset) {
        setEditingImageBboxAsset(null)
      }
    }
  }, [
    imageSizeTier,
    imageRatio,
    editingImageBboxAsset,
    imageGenerationMode,
    imageEnableWebSearch,
    imageMaxImages,
    imageOutputFormat,
    imagePromptExtend,
    imageReferenceImages.length,
    imageSelectedModel,
    imageSequentialMode,
    imageSize,
    setImagePromptExtend,
  ])

  useEffect(() => {
    if (!isWan27ImageModel(imageSelectedModel) || imageReferenceImages.length === 0) {
      return
    }

    let cancelled = false
    const targetAsset = imageReferenceImages[imageReferenceImages.length - 1]
    const img = new window.Image()

    img.onload = () => {
      if (cancelled) {
        return
      }

      const inferred = inferSceneRatioQualityFromSize(`${img.naturalWidth}*${img.naturalHeight}`, imageSelectedModel)
      setImageRatio(inferred.ratio)
    }

    img.onerror = () => {
      if (cancelled) {
        return
      }

      const fallback = inferSceneRatioQualityFromSize(imageSize, imageSelectedModel)
      setImageRatio(fallback.ratio)
    }

    img.src = targetAsset.url

    return () => {
      cancelled = true
    }
  }, [imageReferenceImages, imageSelectedModel, imageSize])

  useEffect(() => {
    setImageReferenceBoxesByAssetId((previous) => {
      const validIds = new Set(imageReferenceImages.map((asset) => asset.id))
      const nextState: Record<string, ImageEditBBox[]> = {}

      Object.entries(previous).forEach(([assetId, boxes]) => {
        if (validIds.has(assetId) && boxes.length > 0) {
          nextState[assetId] = boxes
        }
      })

      return nextState
    })
  }, [imageReferenceImages])

  useEffect(() => {
    const orderedReferenceAssets = [...referenceImages, ...referenceVideos, ...referenceAudios]
    const normalizedResult = normalizePromptAstAssetLabels(editorValue, orderedReferenceAssets)

    if (!normalizedResult.changed || !Array.isArray(normalizedResult.promptAst)) {
      return
    }

    const normalizedEditorValue = normalizedResult.promptAst as Descendant[]
    setEditorValue(normalizedEditorValue)
    setPrompt(serializeToApiPayload(normalizedEditorValue).prompt)
    setEditorKey((previous) => previous + 1)
  }, [editorValue, referenceAudios, referenceImages, referenceVideos])

  useEffect(() => {
    const normalizedResult = normalizePromptAstAssetLabels(imageEditorValue, imageReferenceImages)

    if (!normalizedResult.changed || !Array.isArray(normalizedResult.promptAst)) {
      return
    }

    const normalizedEditorValue = normalizedResult.promptAst as Descendant[]
    setImageEditorValue(normalizedEditorValue)
    setImagePrompt(serializeToApiPayload(normalizedEditorValue).prompt)
    setImageEditorKey((previous) => previous + 1)
  }, [imageEditorValue, imageReferenceImages])

  const handleLogout = () => {
    clearBrowserSession()
    router.push('/login')
  }

  const handleVideoModelChange = useCallback((nextModel: string) => {
    setSelectedModel(nextModel)
  }, [])

  const handleVideoGenModeChange = useCallback((nextMode: VideoGenerationUiMode) => {
    setVideoGenMode(nextMode)

    if (isHappyHorseVideoModel(selectedModel)) {
      const nextHappyHorseModel = resolveHappyHorseModelForUiMode(nextMode)
      if (selectedModel !== nextHappyHorseModel) {
        setSelectedModel(nextHappyHorseModel)
      }
      return
    }

    if (isWan27VideoModel(selectedModel) || nextMode === 'video_edit') {
      const nextWanModel = resolveWan27ModelForUiMode(nextMode)
      if (selectedModel !== nextWanModel) {
        setSelectedModel(nextWanModel)
      }
    }
  }, [selectedModel])

  const { inputVideoDuration, tokenResult, estimatedTokens, billingType } = useGenerationEstimate(
    selectedModel,
    referenceVideos,
    resolution,
    ratio,
    duration,
    videoCount
  )
  const currentImageModelConfig = useMemo(
    () => getImageModelConfig(imageSelectedModel),
    [imageSelectedModel],
  )
  const { rightPanelTasks } = useTaskDisplay(
    pendingTasks,
    tasks,
    statusFilter
  )
  const currentReferenceImages = activeTab === 'ai-image' ? imageReferenceImages : referenceImages
  const currentReferenceVideos = activeTab === 'ai-image' ? [] : referenceVideos
  const currentReferenceAudios = activeTab === 'ai-image' ? [] : referenceAudios
  const currentProviderVideoMode = mapVideoUiModeToProviderMode(videoGenMode, imageGenSubMode)
  const currentVideoReferenceLimits = getVideoReferenceLimits(selectedModel, currentProviderVideoMode)
  const maxVideoReferenceCount = activeTab === 'ai-video'
    ? typeof currentVideoReferenceLimits.maxTotalVisual === 'number'
      ? Math.max(0, currentVideoReferenceLimits.maxTotalVisual - referenceImages.length)
      : currentVideoReferenceLimits.maxVideos
    : null
  const maxVideoImageReferenceCount = activeTab === 'ai-video'
    ? typeof currentVideoReferenceLimits.maxTotalVisual === 'number'
      ? Math.max(0, currentVideoReferenceLimits.maxTotalVisual - referenceVideos.length)
      : currentVideoReferenceLimits.maxImages
    : currentImageModelConfig.maxReferenceImages
  const setCurrentReferenceImages = activeTab === 'ai-image' ? setImageReferenceImages : setReferenceImages
  const setCurrentReferenceVideos = activeTab === 'ai-image' ? ((_: any) => {}) as typeof setReferenceVideos : setReferenceVideos
  const setCurrentReferenceAudios = activeTab === 'ai-image' ? ((_: any) => {}) as typeof setReferenceAudios : setReferenceAudios
  const {
    addSelectedReferences,
    togglePickerAsset,
    removeReference,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useReferenceAssets({
    assetPickerMode,
    selectedPickerAssets,
    referenceImages: currentReferenceImages,
    referenceVideos: currentReferenceVideos,
    referenceAudios: currentReferenceAudios,
    draggedItem,
    setSelectedPickerAssets,
    setShowAssetPicker,
    setReferenceImages: setCurrentReferenceImages,
    setReferenceVideos: setCurrentReferenceVideos,
    setReferenceAudios: setCurrentReferenceAudios,
    setDraggedItem,
    maxImageReferences: maxVideoImageReferenceCount,
    maxVideoReferences: maxVideoReferenceCount,
  })

  const handleRemoveReference = useCallback((type: 'image' | 'video' | 'audio', id: string) => {
    removeReference(type, id)

    if (type === 'image') {
      setImageReferenceBoxesByAssetId((previous) => {
        if (!previous[id]) {
          return previous
        }

        const nextState = { ...previous }
        delete nextState[id]
        return nextState
      })

      if (editingImageBboxAsset?.id === id) {
        setEditingImageBboxAsset(null)
      }
    }
  }, [editingImageBboxAsset?.id, removeReference])

  const handleOpenImageBboxEditor = useCallback((asset: Asset) => {
    setEditingImageBboxAsset(asset)
  }, [])

  const handleSaveImageBboxes = useCallback((assetId: string, boxes: ImageEditBBox[]) => {
    setImageReferenceBoxesByAssetId((previous) => {
      if (boxes.length === 0) {
        if (!previous[assetId]) {
          return previous
        }

        const nextState = { ...previous }
        delete nextState[assetId]
        return nextState
      }

      return {
        ...previous,
        [assetId]: boxes,
      }
    })
  }, [])

  const handleImageSizeTierChange = useCallback((nextTier: string) => {
    if (nextTier === '1K' || nextTier === '2K' || nextTier === '4K') {
      setImageSizeTier(nextTier)
    }
  }, [])

  const handleImageRatioChange = useCallback((nextRatio: string) => {
    setImageRatioMode('preset')
    setImageRatio(nextRatio)
  }, [])

  const handleImageCustomRatioChange = useCallback((value: string) => {
    setImageRatioMode('custom')
    setImageCustomRatio(value)
    const normalized = isValidCustomRatio(value) ? normalizeRatioString(value) : null
    if (normalized) {
      setImageRatio(normalized)
    }
  }, [])

  const handleImageRatioModeChange = useCallback((nextMode: 'preset' | 'custom') => {
    setImageRatioMode(nextMode)
    if (nextMode === 'custom' && !imageCustomRatio) {
      setImageCustomRatio(imageRatio)
    }
  }, [imageCustomRatio, imageRatio])

  const handleImageSelectedModelChange = useCallback((nextModel: string) => {
    const nextModelConfig = getImageModelConfig(nextModel)
    const effectiveTier = resolveEffectiveSizeTier(nextModel, imageSizeTier, imageReferenceImages.length > 0, imageGenerationMode === 'group')

    setImageSelectedModel(nextModel)
    setImageSizeTier(effectiveTier)

    if (isWan27ImageModel(nextModel)) {
      if (imageReferenceImages.length === 0) {
        setImageRatio('1:1')
        setImageRatioMode('preset')
      }
      setImageSize(resolveWanSize(effectiveTier, imageReferenceImages.length > 0 ? imageRatio : '1:1'))
    } else {
      setImageSize(nextModelConfig.defaultSize)
      setImageRatioMode('preset')
    }

    setImagePromptExtend(nextModelConfig.supportsPromptExtend ? nextModelConfig.defaultPromptExtend : false)
  }, [imageGenerationMode, imageReferenceImages.length, imageRatio, imageSizeTier, setImagePromptExtend])

  const handleClearImageConfig = useCallback(() => {
    const imageModelConfig = getImageModelConfig(imageSelectedModel)

    setImagePrompt('')
    setImageEditorValue(initialEditorValue)
    setImageEditorKey((previous) => previous + 1)
    setImageReferenceImages([])
    setImageReferenceBoxesByAssetId({})
    setEditingImageBboxAsset(null)
    setImageRatio('1:1')
    setImageRatioMode('preset')
    setImageCustomRatio('')
    setImageSizeTier('2K')
    setImageSize(isWan27ImageModel(imageSelectedModel) ? resolveWanSize('2K', '1:1') : imageModelConfig.defaultSize)
    setImageOutputFormat(imageModelConfig.defaultOutputFormat)
    setImageGenerationMode('single')
    setImageSequentialMode('disabled')
    setImageMaxImages(imageModelConfig.supportsSequential ? normalizeImageMaxImages(imageSelectedModel, 4) : 1)
    setImageWatermark(false)
    setImagePromptExtend(imageModelConfig.supportsPromptExtend ? imageModelConfig.defaultPromptExtend : false)
    setImageEnableWebSearch(false)
  }, [
    imageSelectedModel,
    setImageEditorKey,
    setImageEditorValue,
    setImageEnableWebSearch,
    setImageGenerationMode,
    setImageMaxImages,
    setImageOutputFormat,
    setImagePrompt,
    setImageReferenceImages,
    setImageSequentialMode,
    setImagePromptExtend,
    setImageSize,
    setImageWatermark,
  ])

  const handleClearVideoConfig = useCallback(() => {
    const videoModelConfig = getVideoModelConfig(selectedModel)
    const supportedDurations = getSupportedVideoDurations(selectedModel, {
      hasReferenceVideo: false,
    })

    setPrompt('')
    setEditorValue(initialEditorValue)
    setEditorKey((previous) => previous + 1)
    setReferenceImages([])
    setReferenceVideos([])
    setReferenceAudios([])
    setResolution(videoModelConfig.defaultResolution)
    setRatio(videoModelConfig.defaultRatio)
    setDuration(
      supportedDurations.includes(videoModelConfig.defaultDuration)
        ? videoModelConfig.defaultDuration
        : supportedDurations[0] || videoModelConfig.defaultDuration
    )
    setVideoCount(1)
    setVideoPromptExtend(true)
    setVideoSeed('')
    setVideoGenerateAudio(true)
  }, [
    selectedModel,
    setDuration,
    setEditorKey,
    setEditorValue,
    setPrompt,
    setRatio,
    setReferenceAudios,
    setReferenceImages,
    setReferenceVideos,
    setResolution,
    setVideoCount,
    setVideoGenerateAudio,
    setVideoPromptExtend,
    setVideoSeed,
  ])

  const {
    formatTokens,
    getModeLabel,
    formatGenerationTime,
    renderPromptWithRefs,
  } = useTaskPresentation({
    setHoverPreview,
  })

  const handleUseImageTaskAsReference = useCallback((task: Task) => {
    const outputImages = (task.outputAssets || []).filter((asset) => asset.type === 'image')

    if (outputImages.length === 0) {
      window.alert('当前任务还没有可用的图片结果')
      return
    }

    if (activeTab === 'ai-image') {
      const modelConfig = getImageModelConfig(imageSelectedModel)
      const existingUrls = new Set(imageReferenceImages.map((asset) => asset.url))
      const dedupedImages = outputImages.filter((asset) => !existingUrls.has(asset.url))

      if (dedupedImages.length === 0) {
        window.alert('这些图片已经都在参考区里了')
        return
      }

      const availableSlots = Math.max(0, modelConfig.maxReferenceImages - imageReferenceImages.length)
      const acceptedImages = dedupedImages.slice(0, availableSlots)

      if (acceptedImages.length === 0) {
        window.alert(`${modelConfig.label} 最多支持 ${modelConfig.maxReferenceImages} 张参考图片`)
        return
      }

      setImageReferenceImages((prev) => [...prev, ...acceptedImages])
      setImageGenerationMode((current) => (current === 'group' ? current : 'single'))

      if (acceptedImages.length < dedupedImages.length) {
        window.alert(`已加入 ${acceptedImages.length} 张参考图，超出 ${modelConfig.maxReferenceImages} 张上限的部分已忽略`)
      }

      return
    }

    const videoModelConfig = getVideoModelConfig(selectedModel)
    const existingUrls = new Set(referenceImages.map((asset) => asset.url))
    const dedupedImages = outputImages.filter((asset) => !existingUrls.has(asset.url))

    if (dedupedImages.length === 0) {
      window.alert('这些图片已经都在参考区里了')
      return
    }

    const referenceLimits = getVideoReferenceLimits(videoModelConfig.id, 'reference')
    const maxReferenceAssets =
      typeof referenceLimits.maxTotalVisual === 'number'
        ? Math.max(0, referenceLimits.maxTotalVisual - (referenceImages.length + referenceVideos.length))
        : typeof referenceLimits.maxImages === 'number'
          ? Math.max(0, referenceLimits.maxImages - referenceImages.length)
          : Number.POSITIVE_INFINITY

    const acceptedImages = dedupedImages.slice(0, maxReferenceAssets)

    if (acceptedImages.length === 0) {
      window.alert('当前视频模型的参考素材已达到上限，请先移除部分图片或视频')
      return
    }

    setReferenceImages((prev) => [...prev, ...acceptedImages])
    setVideoGenMode('reference')

    if (acceptedImages.length < dedupedImages.length) {
      window.alert(`已加入 ${acceptedImages.length} 张参考图，当前视频模型的参考素材数量已达上限`)
    }
  }, [
    activeTab,
    imageReferenceImages,
    imageSelectedModel,
    referenceImages,
    referenceVideos.length,
    selectedModel,
    setImageGenerationMode,
    setImageReferenceImages,
    setReferenceImages,
    setVideoGenMode,
  ])

  const handleDeleteImageTask = useCallback(async (task: Task) => {
    if (task.isOptimistic) {
      setImageTasks((prev) => prev.filter((item) => item.id !== task.id))
      return { success: true }
    }

    const token = getStoredToken()

    try {
      const response = await fetch(`/api/image-tasks/${task.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        return {
          success: false,
          error: result?.error || '删除失败',
        }
      }

      setImageTasks((prev) => prev.filter((item) => item.id !== task.id))
      setTaskCenterTasks((prev) => prev.filter((item) => item.id !== task.id))
      setSelectedTaskDetail((prev) => (prev?.id === task.id ? null : prev))
      await fetchStats().catch(() => null)

      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || '删除失败',
      }
    }
  }, [fetchStats])

  const handleUseVideoTasksAsReference = useCallback((videoTasks: Task[]) => {
    const outputVideos = videoTasks
      .filter((task) => Boolean(task.outputUrl))
      .map((task, index) => ({
        id: `generated-video-${task.id}`,
        name: `生成视频_${task.id.slice(-8)}_${index + 1}`,
        type: 'video' as const,
        url: task.outputUrl!,
        duration: resolveTaskOutputVideoDuration(task) || undefined,
        category: 'creation' as const,
      }))

    if (outputVideos.length === 0) {
      window.alert('当前任务还没有可用的视频结果')
      return
    }

    const existingUrls = new Set(referenceVideos.map((asset) => asset.url))
    const dedupedVideos = outputVideos.filter((asset) => !existingUrls.has(asset.url))

    if (dedupedVideos.length === 0) {
      window.alert('这些视频已经都在参考区里了')
      return
    }

    const videoModelConfig = getVideoModelConfig(selectedModel)
    const referenceLimits = getVideoReferenceLimits(videoModelConfig.id, 'reference')
    const availableSlots =
      typeof referenceLimits.maxTotalVisual === 'number'
        ? Math.max(0, referenceLimits.maxTotalVisual - (referenceImages.length + referenceVideos.length))
        : typeof referenceLimits.maxVideos === 'number'
          ? Math.max(0, referenceLimits.maxVideos - referenceVideos.length)
          : Number.POSITIVE_INFINITY
    const acceptedVideos = dedupedVideos.slice(0, availableSlots)

    if (acceptedVideos.length === 0) {
      window.alert('当前视频模型的参考素材已达到上限，请先移除部分图片或视频')
      return
    }

    setReferenceVideos((prev) => [...prev, ...acceptedVideos])
    setVideoGenMode('reference')
    if (activeTab !== 'ai-video') {
      setActiveTabWithHistory('ai-video')
    }

    if (acceptedVideos.length < dedupedVideos.length) {
      window.alert(`已加入 ${acceptedVideos.length} 条参考视频，当前视频模型的参考素材数量已达上限`)
    }
  }, [
    activeTab,
    referenceImages.length,
    referenceVideos,
    selectedModel,
    setActiveTabWithHistory,
    setReferenceVideos,
    setVideoGenMode,
  ])

  const handleDeleteVideoTasks = useCallback(async (videoTasks: Task[]) => {
    const taskIds = videoTasks.map((task) => task.id)
    const optimisticTaskIds = new Set(videoTasks.filter((task) => task.isOptimistic).map((task) => task.id))
    const token = getStoredToken()

    try {
      const deletableTasks = videoTasks.filter((task) => !task.isOptimistic)
      for (const task of deletableTasks) {
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const result = await response.json().catch(() => null)
        if (!response.ok) {
          return {
            success: false,
            error: result?.error || '删除失败',
          }
        }
      }

      setTasks((prev) => prev.filter((task) => !taskIds.includes(task.id)))
      setPendingTasks((prev) => prev.filter((task) => !taskIds.includes(task.id)))
      setTaskCenterTasks((prev) => prev.filter((task) => !taskIds.includes(task.id)))
      setSelectedTaskDetail((prev) => (prev && taskIds.includes(prev.id) ? null : prev))

      if (optimisticTaskIds.size > 0) {
        setPendingTasks((prev) => prev.filter((task) => !optimisticTaskIds.has(task.id)))
      }

      await fetchStats().catch(() => null)
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || '删除失败',
      }
    }
  }, [fetchStats])

  const {
    handleGenerate,
    handleReEdit,
    handleReGenerate,
    handleVideoEdit,
    refreshSingleTask,
  } = useTaskSubmission({
    setTasks,
    setPendingTasks,
    setIsGenerating,
    fetchTasks,
    fetchStats,
    fetchAssets,
    broadcastAssetChange,
    setPrompt,
    setEditorValue,
    setEditorKey,
    setResolution,
    setRatio,
    setDuration,
    setVideoCount,
    setPromptExtend: setVideoPromptExtend,
    setVideoSeed,
    setVideoGenerateAudio,
    setVideoGenMode,
    setImageGenSubMode,
    setReferenceSubMode,
    setReferenceImages,
    setReferenceVideos,
    setReferenceAudios,
    setActiveTab: setActiveTabWithHistory,
    setSelectedModel,
    videoGenMode,
    imageGenSubMode,
    editorValue,
    selectedModel,
    ratio,
    resolution,
    duration,
    videoCount,
    promptExtend: videoPromptExtend,
    videoSeed,
    videoGenerateAudio,
    estimatedTokens,
    billingType,
    referenceImages,
    referenceVideos,
    referenceAudios,
  })

  const {
    handleGenerateImage,
    handleImageReEdit,
    handleImageReGenerate,
  } = useImageTaskSubmission({
    setImageTasks,
    setIsImageGenerating,
    fetchImageTasks,
    fetchAssets,
    broadcastAssetChange,
    setImagePrompt,
    setImageEditorValue,
    setImageEditorKey,
    setImageSelectedModel,
    setImageReferenceImages,
    setImageReferenceBoxesByAssetId,
    setImageSize,
    setImageRatio,
    setImageSizeTier,
    setImageOutputFormat,
    setImageGenerationMode,
    setImageWatermark,
    setImagePromptExtend,
    setImageSequentialMode,
    setImageMaxImages,
    setImageEnableWebSearch,
    setActiveTab: setActiveTabWithHistory,
    imageEditorValue,
    imageSelectedModel,
    imageReferenceImages,
    imageReferenceBoxesByAssetId,
    imageSize,
    imageRatio,
    imageSizeTier,
    imageOutputFormat,
    imagePromptExtend,
    imageGenerationMode,
    imageWatermark,
    imageSequentialMode,
    imageMaxImages,
    imageEnableWebSearch,
  })

  const {
    openAssetPicker,
    openAssetDetail,
    closeAssetDetail,
    closeAssetPicker,
    handleTaskViewAllChange,
    handleTaskStatusFilterChange,
    handleTaskMemberFilterChange,
    refreshTaskList,
    toggleStatsViewTeam,
    openRechargeModal,
    openAddMemberModal,
    openAllocateModal,
    openEditMemberModal,
    closeEditMemberModal,
    closeAllocateModal,
    closeTaskDetail,
    closeDeleteConfirm,
    closeSaveAsSubject,
  } = useDashboardUi({
    taskViewAll,
    taskStatusFilter,
    taskMemberFilter,
    statsViewTeam,
    editingAsset,
    deleteConfirmAsset,
    saveAsSubjectAsset,
    fetchTasks: fetchTaskCenterTasks,
    syncPendingTasks,
    syncPendingImageTasks,
    fetchStats,
    setAssetPickerMode,
    setShowAssetPicker,
    setEditorValue,
    setPrompt,
    setEditingAsset,
    setShowAssetDetail,
    setAssetActionMenu,
    setSaveAsSubjectAsset,
    setDeleteConfirmAsset,
    setTaskViewAll,
    setTaskStatusFilter,
    setTaskMemberFilter,
    setSelectedTaskDetail,
    setStatsViewTeam,
    setShowRechargeModal,
    setShowAddMemberModal,
    setAllocatingMember,
    setShowAllocateModal,
    setShowEditMemberModal,
    setEditingMember,
    setSelectedPickerAssets,
    setHasMoreTasks,
    setTaskPage,
  })

  const readLocalImageAsAsset = useCallback((file: File, index: number) => new Promise<Asset>((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('只能添加图片文件'))
      return
    }
    if (file.size > INLINE_IMAGE_MAX_BYTES) {
      reject(new Error('本地参考图单张不能超过 20MB'))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      if (!url.startsWith('data:image/')) {
        reject(new Error('图片读取失败'))
        return
      }
      resolve({
        id: `inline-image-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name || `本地参考图_${index + 1}`,
        type: 'image',
        url,
        size: file.size,
        contentType: file.type,
        category: 'creation',
      } as Asset)
    }
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  }), [])

  const handleInlineImageInputChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return

    try {
      const localAssets = await Promise.all(files.map(readLocalImageAsAsset))

      if (activeTabRef.current === 'ai-image') {
        const modelConfig = getImageModelConfig(imageSelectedModel)
        const existingUrls = new Set(imageReferenceImages.map((asset) => asset.url))
        const accepted = localAssets
          .filter((asset) => !existingUrls.has(asset.url))
          .slice(0, Math.max(0, modelConfig.maxReferenceImages - imageReferenceImages.length))
        if (accepted.length === 0) {
          alert(`${modelConfig.label} 最多支持 ${modelConfig.maxReferenceImages} 张参考图片`)
          return
        }
        setImageReferenceImages((prev) => [...prev, ...accepted])
        setImageGenerationMode((current) => (current === 'group' ? current : 'single'))
        return
      }

      const providerMode: ProviderGenerationMode = videoGenMode === 'image_to_video' ? imageGenSubMode : videoGenMode
      const limits = getVideoReferenceLimits(selectedModel, providerMode)
      const maxImages = typeof limits.maxImages === 'number' ? limits.maxImages : Number.POSITIVE_INFINITY
      const totalSlots = typeof limits.maxTotalVisual === 'number'
        ? Math.max(0, limits.maxTotalVisual - referenceVideos.length - referenceImages.length)
        : Math.max(0, maxImages - referenceImages.length)
      const accepted = localAssets.slice(0, totalSlots)
      if (accepted.length === 0) {
        alert('当前模式的参考图片已达到上限')
        return
      }
      setReferenceImages((prev) => [...prev, ...accepted])
    } catch (error) {
      alert(error instanceof Error ? error.message : '图片读取失败')
    }
  }, [
    imageGenSubMode,
    imageReferenceImages,
    imageSelectedModel,
    readLocalImageAsAsset,
    referenceImages.length,
    referenceVideos.length,
    selectedModel,
    setImageGenerationMode,
    setImageReferenceImages,
    setReferenceImages,
    videoGenMode,
  ])

  const handleOpenAssetPicker = useCallback((mode: 'image' | 'video' | 'audio') => {
    if (!hasObjectStorage) {
      if (mode !== 'image') {
        alert('当前团队未配置对象存储，不能上传或引用视频、音频素材')
        return
      }
      inlineImageInputRef.current?.click()
      return
    }

    openAssetPicker(mode)
  }, [hasObjectStorage, openAssetPicker])

  const handleCurrentEditorChange = useCallback((value: Descendant[]) => {
    const payload = serializeToApiPayload(value)
    if (activeTab === 'ai-image') {
      setImageEditorValue(value)
      setImagePrompt(payload.prompt)
      return
    }

    setEditorValue(value)
    setPrompt(payload.prompt)
  }, [activeTab, setEditorValue, setImageEditorValue, setImagePrompt, setPrompt])

  const handleStartSubjectImageCreation = useCallback((draft: any) => {
    const targetModel = draft.preferredModel || DEFAULT_IMAGE_MODEL
    const targetModelConfig = getImageModelConfig(targetModel)
    const inferred = inferSceneRatioQualityFromSize(draft.size || targetModelConfig.defaultSize, targetModel)
    const editorDraft: Descendant[] = [
      {
        type: 'paragraph',
        children: [{ text: draft.prompt }],
      },
    ]

    setActiveTabWithHistory('ai-video')
    setImageSelectedModel(targetModel)
    setImageReferenceImages(draft.referenceImages.slice(0, targetModelConfig.maxReferenceImages))
    setImageRatio(inferred.ratio)
    setImageSizeTier(inferred.tier)
    setImageSize(
      isWan27ImageModel(targetModel)
        ? resolveWanSize(inferred.tier, inferred.ratio)
        : (draft.size || targetModelConfig.defaultSize)
    )
    setImageOutputFormat(
      targetModelConfig.supportedOutputFormats.includes((draft.outputFormat || 'png') as 'jpeg' | 'png')
        ? (draft.outputFormat || 'png') as 'jpeg' | 'png'
        : targetModelConfig.defaultOutputFormat,
    )
    setImagePromptExtend(targetModelConfig.supportsPromptExtend ? targetModelConfig.defaultPromptExtend : false)
    setImageGenerationMode(
      'single'
    )
    setImageSequentialMode('disabled')
    setImageMaxImages(1)
    setImageWatermark(false)
    setImageEnableWebSearch(false)
    setImagePrompt(draft.prompt)
    setImageEditorValue(editorDraft)
    setImageEditorKey((prev) => prev + 1)
    setImageReferenceBoxesByAssetId({})

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [
    setActiveTabWithHistory,
    setImageEditorKey,
    setImageEditorValue,
    setImageEnableWebSearch,
    setImageMaxImages,
    setImageOutputFormat,
    setImageGenerationMode,
    setImagePrompt,
    setImagePromptExtend,
    setImageReferenceBoxesByAssetId,
    setImageReferenceImages,
    setImageSelectedModel,
    setImageSequentialMode,
    setImageSize,
    setImageWatermark,
    setImageRatio,
    setImageSizeTier,
  ])

  const handleStartStoryboardVideoCreation = useCallback((draft: any) => {
    const editorDraft: Descendant[] = [
      {
        type: 'paragraph',
        children: [{ text: draft.prompt }],
      },
    ]

    setActiveTabWithHistory('ai-video')
    setPrompt(draft.prompt)
    setEditorValue(editorDraft)
    setEditorKey((prev) => prev + 1)
    setRatio(draft.ratio || defaultVideoModelConfig.defaultRatio)
    setDuration(typeof draft.duration === 'number' ? draft.duration : defaultVideoModelConfig.defaultDuration)
    setResolution(draft.resolution || defaultVideoModelConfig.defaultResolution)
    setVideoPromptExtend(draft.promptExtend !== false)
    setVideoSeed(typeof draft.seed === 'number' && draft.seed >= 0 ? String(draft.seed) : '')
    setVideoGenerateAudio(draft.generateAudio !== false)
    setVideoGenMode(
      draft.referenceImages.length > 0 || draft.referenceVideos.length > 0 || draft.referenceAudios.length > 0
        ? 'reference'
        : 'text_to_video'
    )
    setReferenceImages(draft.referenceImages)
    setReferenceVideos(draft.referenceVideos)
    setReferenceAudios(draft.referenceAudios)

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [
    setActiveTabWithHistory,
    setDuration,
    setEditorKey,
    setEditorValue,
    setPrompt,
    setRatio,
    setResolution,
    setReferenceAudios,
    setReferenceImages,
    setReferenceVideos,
    setVideoGenMode,
    setVideoPromptExtend,
    setVideoGenerateAudio,
    setVideoSeed,
  ])

  const unifiedRightPanelTasks = useMemo(() => {
    const taskMap = new Map<string, Task>()
    sortTasksByCreatedAtDesc([...rightPanelTasks, ...imageTasks]).forEach((task) => {
      if (!taskMap.has(task.id)) {
        taskMap.set(task.id, task)
      }
    })
    return Array.from(taskMap.values())
  }, [imageTasks, rightPanelTasks])

  const unifiedFilteredRightPanelTasks = useMemo(() => {
    return unifiedRightPanelTasks.filter((task) => {
      const isImageTask = task.taskKind === 'image'

      if (displayFilter === 'video' && isImageTask) return false
      if (displayFilter === 'image' && !isImageTask) return false

      if (statusFilter === 'all') return true
      if (statusFilter === 'succeeded') return task.status === 'succeeded'
      if (statusFilter === 'failed') return task.status === 'failed' || task.status === 'expired'
      if (statusFilter === 'processing') {
        return ['processing', 'queued', 'running', 'pending', 'submit_unknown'].includes(task.status)
      }
      return true
    })
  }, [displayFilter, statusFilter, unifiedRightPanelTasks])

  const currentRightPanelTasks = unifiedRightPanelTasks
  const currentFilteredRightPanelTasks = unifiedFilteredRightPanelTasks
  const currentReferenceImagesForPanel = activeTab === 'ai-image' ? imageReferenceImages : referenceImages
  const currentEditorKey = activeTab === 'ai-image' ? imageEditorKey : editorKey
  const currentEditorValue = activeTab === 'ai-image' ? imageEditorValue : editorValue
  const currentPrompt = activeTab === 'ai-image' ? imagePrompt : prompt
  const currentIsGenerating = activeTab === 'ai-image' ? isImageGenerating : isGenerating

  const refreshTaskCenterTask = useCallback(async (taskId: string) => {
    const task = taskCenterTasks.find((item) => item.id === taskId)

    if (!task) {
      return { success: false, error: '任务不存在' }
    }

    setTaskCenterTasks((prev) => prev.map((item) => (
      item.id === taskId ? { ...item, isRefreshing: true } : item
    )))

    if (task.taskKind === 'image') {
      const token = getStoredToken()

      try {
        const response = await fetch(`/api/image-tasks/${taskId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error('Refresh failed')
        }

        const data = await response.json()
        const refreshedTask = data.task as Task

        setTaskCenterTasks((prev) => prev.map((item) => (
          item.id === taskId ? { ...refreshedTask, isRefreshing: false } : item
        )))
        setImageTasks((prev) => prev.map((item) => (
          item.id === taskId ? { ...refreshedTask, isRefreshing: false } : item
        )))
        if (selectedTaskDetail?.id === taskId) {
          setSelectedTaskDetail({ ...refreshedTask, isRefreshing: false })
        }

        if (['succeeded', 'failed'].includes(refreshedTask.status)) {
          await Promise.all([fetchStats(), fetchAssets(), fetchImageTasks()])
        }

        return { success: true }
      } catch (error) {
        console.error('[IMAGE TASK REFRESH] Error:', error)
        setTaskCenterTasks((prev) => prev.map((item) => (
          item.id === taskId ? { ...item, isRefreshing: false } : item
        )))
        return { success: false, error: '刷新失败' }
      }
    }

    const result = await refreshSingleTask(taskId)
    await fetchTaskCenterTasks(taskViewAll, taskStatusFilter, taskMemberFilter, 1, false).then((refreshResult) => {
      if (refreshResult) {
        setTaskPage(1)
        setHasMoreTasks(refreshResult.hasMore)
      }
    })
    return result
  }, [
    fetchAssets,
    fetchImageTasks,
    fetchStats,
    fetchTaskCenterTasks,
    refreshSingleTask,
    selectedTaskDetail,
    taskCenterTasks,
    taskMemberFilter,
    taskStatusFilter,
    taskViewAll,
  ])

  const handleLoadMore = useCallback(async () => {
    const nextPage = taskPage + 1
    const result = await fetchTaskCenterTasks(taskViewAll, taskStatusFilter, taskMemberFilter, nextPage, true)
    if (result) {
      setTaskPage(nextPage)
      setHasMoreTasks(result.hasMore)
    }
  }, [fetchTaskCenterTasks, taskPage, taskViewAll, taskStatusFilter, taskMemberFilter, setTaskPage, setHasMoreTasks])

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col md:flex-row" onClick={() => assetActionMenu && setAssetActionMenu(null)}>
      <DashboardSidebar
        activeTab={activeTab}
        isAdmin={user?.role === 'admin'}
        onTabChange={setActiveTabWithHistory}
        onOpenSettings={openTeamSettings}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-h-0">
        <DashboardMainContent
          activeTab={activeTab}
          user={user}
          assets={assets}
          tasks={tasks}
          taskCenterTasks={taskCenterTasks}
          stats={stats}
          uploadItems={uploadItems}
          assetLibraryTab={assetLibraryTab}
          subjectFilter={subjectFilter}
          assetTypeFilter={assetTypeFilter}
          hoveredAsset={hoveredAsset}
          assetActionMenu={assetActionMenu}
          taskViewAll={taskViewAll}
          taskStatusFilter={taskStatusFilter}
          taskMemberFilter={taskMemberFilter}
          taskTeamMembers={taskTeamMembers}
          isTaskAdmin={isTaskAdmin}
          statsViewTeam={statsViewTeam}
          teamInfo={teamInfo}
          teamMembers={teamMembers}
          currentUserId={user?.id}
          videoGenMode={videoGenMode}
          imageGenSubMode={imageGenSubMode}
          selectedModel={selectedModel}
          referenceImages={currentReferenceImagesForPanel}
          referenceVideos={currentReferenceVideos}
          referenceAudios={currentReferenceAudios}
          editorKey={currentEditorKey}
          editorValue={currentEditorValue}
          resolution={resolution}
          ratio={ratio}
          duration={duration}
          videoCount={videoCount}
          videoPromptExtend={videoPromptExtend}
          videoSeed={videoSeed}
          videoGenerateAudio={videoGenerateAudio}
          estimatedTokens={estimatedTokens}
          tokenResult={tokenResult}
          inputVideoDuration={inputVideoDuration}
          isGenerating={currentIsGenerating}
          prompt={currentPrompt}
          displayFilter={displayFilter}
          statusFilter={statusFilter}
          rightPanelTasks={currentRightPanelTasks}
          filteredRightPanelTasks={currentFilteredRightPanelTasks}
          hoverPreview={hoverPreview}
          audioPreviewRef={audioPreviewRef}
          onActiveTabChange={setActiveTabWithHistory}
          onMainTabChange={setActiveTabWithHistory}
          onStartSubjectImageCreation={handleStartSubjectImageCreation}
          onStartStoryboardVideoCreation={handleStartStoryboardVideoCreation}
          onRefreshAssets={fetchAssets}
          onVideoGenModeChange={handleVideoGenModeChange}
          onImageGenSubModeChange={setImageGenSubMode}
          onSelectedModelChange={handleVideoModelChange}
          hasObjectStorage={hasObjectStorage}
          canUploadAssets={canUploadAssets}
          onOpenAssetPicker={handleOpenAssetPicker}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onRemoveReference={handleRemoveReference}
          onEditorChange={handleCurrentEditorChange}
          onResolutionChange={setResolution}
          onRatioChange={setRatio}
          onDurationChange={setDuration}
          onVideoCountChange={setVideoCount}
          onVideoPromptExtendChange={setVideoPromptExtend}
          onVideoSeedChange={setVideoSeed}
          onVideoGenerateAudioChange={setVideoGenerateAudio}
          onGenerate={handleGenerate}
          imageSelectedModel={imageSelectedModel}
          imageReferenceImages={imageReferenceImages}
          imageReferenceBoxesByAssetId={imageReferenceBoxesByAssetId}
          imageEditorKey={imageEditorKey}
          imageEditorValue={imageEditorValue}
          imageSize={imageSize}
          imageRatio={imageRatio}
          imageRatioMode={imageRatioMode}
          imageSizeTier={imageSizeTier}
          imageCustomRatio={imageCustomRatio}
          imageOutputFormat={imageOutputFormat}
          imageGenerationMode={imageGenerationMode}
          imageSequentialMode={imageSequentialMode}
          imageMaxImages={imageMaxImages}
          imageWatermark={imageWatermark}
          imagePromptExtend={imagePromptExtend}
          imageEnableWebSearch={imageEnableWebSearch}
          isImageGenerating={isImageGenerating}
          imagePrompt={imagePrompt}
          onImageSelectedModelChange={handleImageSelectedModelChange}
          onImageSizeChange={setImageSize}
          onImageRatioChange={handleImageRatioChange}
          onImageRatioModeChange={handleImageRatioModeChange}
          onImageSizeTierChange={handleImageSizeTierChange}
          onImageCustomRatioChange={handleImageCustomRatioChange}
          onImageOutputFormatChange={setImageOutputFormat}
          onImageGenerationModeChange={setImageGenerationMode}
          onImageSequentialModeChange={setImageSequentialMode}
          onImageMaxImagesChange={setImageMaxImages}
          onImageWatermarkChange={setImageWatermark}
          onImagePromptExtendChange={setImagePromptExtend}
          onImageEnableWebSearchChange={setImageEnableWebSearch}
          onImageEditorChange={(value) => {
            const payload = serializeToApiPayload(value)
            setImageEditorValue(value)
            setImagePrompt(payload.prompt)
          }}
          onGenerateImage={handleGenerateImage}
          onOpenImageBboxEditor={handleOpenImageBboxEditor}
          onClearVideoConfig={handleClearVideoConfig}
          onClearImageConfig={handleClearImageConfig}
          onDisplayFilterChange={setDisplayFilter}
          onStatusFilterChange={setStatusFilter}
          onRefreshGenerationTasks={refreshGenerationTasks}
          onReEdit={(task, batchSize) => {
            if (task.taskKind === 'image') {
              handleImageReEdit(task)
              return
            }
            handleReEdit(task, batchSize)
          }}
          onReGenerate={(task, batchSize) => {
            if (task.taskKind === 'image') {
              void handleImageReGenerate(task)
              return
            }
            void handleReGenerate(task, batchSize)
          }}
          onUseImageTaskAsReference={handleUseImageTaskAsReference}
          onDeleteImageTask={handleDeleteImageTask}
          onUseVideoTasksAsReference={handleUseVideoTasksAsReference}
          onDeleteVideoTasks={handleDeleteVideoTasks}
          onVideoEdit={handleVideoEdit}
          renderPromptWithRefs={renderPromptWithRefs}
          getModeLabel={getModeLabel}
          formatGenerationTime={formatGenerationTime}
          onAudioPlay={setPlayingAudioId}
          onAudioPause={() => setPlayingAudioId(null)}
          onAssetLibraryTabChange={setAssetLibraryTab}
          onSubjectFilterChange={setSubjectFilter}
          onAssetTypeFilterChange={setAssetTypeFilter}
          onFileUpload={handleFileUpload}
          onHoverAsset={setHoveredAsset}
          onOpenAsset={openAssetDetail}
          onToggleActionMenu={setAssetActionMenu}
          onSaveAsSubject={setSaveAsSubjectAsset}
          onDeleteAssetRequest={setDeleteConfirmAsset}
          onTaskViewAllChange={handleTaskViewAllChange}
          onTaskStatusFilterChange={handleTaskStatusFilterChange}
          onTaskMemberFilterChange={handleTaskMemberFilterChange}
          onRefreshTasks={refreshTaskList}
          hasMoreTasks={hasMoreTasks}
          onLoadMore={handleLoadMore}
          onOpenTaskDetail={setSelectedTaskDetail}
          onRefreshTask={refreshTaskCenterTask}
          formatTokens={formatTokens}
          onToggleStatsViewTeam={toggleStatsViewTeam}
          onOpenRechargeModal={openRechargeModal}
          onOpenAddMemberModal={openAddMemberModal}
          onOpenAllocateModal={openAllocateModal}
          onOpenEditMemberModal={openEditMemberModal}
          onDeleteMember={deleteTeamMember}
        />
      </div>

      <input
        ref={inlineImageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInlineImageInputChange}
      />

      <DashboardModalLayer
        showAssetPicker={showAssetPicker}
        assetPickerMode={assetPickerMode}
        uploadItems={uploadItems}
        selectedPickerAssets={selectedPickerAssets}
        filteredAssets={filteredAssets}
        filteredAssetCount={filteredAssetCount}
        visibleAssets={visibleAssets}
        hasMoreAssets={hasMoreAssets}
        isLoadingAssets={isAssetPickerLoading}
        assetLoadError={assetLoadError}
        assetPickerSearch={assetPickerSearch}
        showAssetDetail={showAssetDetail}
        editingAsset={editingAsset}
        deleteConfirmAsset={deleteConfirmAsset}
        saveAsSubjectAsset={saveAsSubjectAsset}
        showSettings={showSettings}
        isConfigAdmin={isConfigAdmin}
        apiKeyConfigured={apiKeyConfigured}
        videoProviderId={videoProviderId}
        apiKey={apiKey}
        seedanceUrl={seedanceUrl}
        storageProviderId={storageProviderId}
        storageProviders={storageProviders}
        maxConcurrentTasks={maxConcurrentTasks}
        maxRequestsPerMinute={maxRequestsPerMinute}
        memberCooldownSeconds={memberCooldownSeconds}
        savingConfig={savingConfig}
        showAddMemberModal={showAddMemberModal}
        teamInfo={teamInfo}
        teamMembers={teamMembers}
        showEditMemberModal={showEditMemberModal}
        editingMember={editingMember}
        showRechargeModal={showRechargeModal}
        showAllocateModal={showAllocateModal}
        allocatingMember={allocatingMember}
        selectedTaskDetail={selectedTaskDetail}
        onCloseAssetPicker={closeAssetPicker}
        onAssetPickerSearchChange={setAssetPickerSearch}
        onAssetPickerScroll={handleAssetPickerScroll}
        onTogglePickerAsset={togglePickerAsset}
        onReferenceUpload={handleReferenceUpload}
        onConfirmSelectedReferences={addSelectedReferences}
        onCloseAssetDetail={closeAssetDetail}
        onEditingAssetChange={setEditingAsset}
        onSaveAssetDetail={() => editingAsset && updateAsset(editingAsset.id, { name: editingAsset.name, subjectName: editingAsset.subjectName })}
        onDeleteAssetFromDetail={(asset) => {
          closeAssetDetail()
          setDeleteConfirmAsset(asset)
        }}
        onCloseDeleteConfirm={closeDeleteConfirm}
        onConfirmDeleteAsset={() => deleteConfirmAsset && deleteAsset(deleteConfirmAsset.id)}
        onCloseSaveAsSubject={closeSaveAsSubject}
        onSaveAsSubject={(subjectType, name) => {
          if (!saveAsSubjectAsset) return
          handleSaveAsSubject(saveAsSubjectAsset, subjectType, name)
        }}
        onCloseSettings={() => setShowSettings(false)}
        onVideoProviderIdChange={(value) => handleVideoProviderChange(value as VideoGenerationProviderId)}
        onApiKeyChange={setApiKey}
        onSeedanceUrlChange={setSeedanceUrl}
        onStorageProviderIdChange={setStorageProviderId}
        onMaxConcurrentTasksChange={setMaxConcurrentTasks}
        onMaxRequestsPerMinuteChange={setMaxRequestsPerMinute}
        onMemberCooldownSecondsChange={setMemberCooldownSeconds}
        onSaveTeamConfig={saveTeamConfig}
        onCloseAddMemberModal={() => setShowAddMemberModal(false)}
        onAddTeamMember={addTeamMember}
        formatTokens={formatTokens}
        onCloseEditMemberModal={closeEditMemberModal}
        onUpdateTeamMember={updateTeamMember}
        onCloseRechargeModal={() => setShowRechargeModal(false)}
        onRechargeTeamBudget={rechargeTeamBudget}
        onCloseAllocateModal={closeAllocateModal}
        onAllocateBudget={allocateBudget}
        onCloseTaskDetail={closeTaskDetail}
      />

      <ImageBboxEditorModal
        isOpen={Boolean(editingImageBboxAsset)}
        asset={editingImageBboxAsset}
        initialBoxes={editingImageBboxAsset ? imageReferenceBoxesByAssetId[editingImageBboxAsset.id] || [] : []}
        onClose={() => setEditingImageBboxAsset(null)}
        onSave={handleSaveImageBboxes}
      />
    </div>
  )
}
