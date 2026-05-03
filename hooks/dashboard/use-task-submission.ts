'use client'

import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { flushSync } from 'react-dom'
import type { Descendant } from 'slate'
import type {
  DashboardAsset as Asset,
  DashboardTask as Task,
  VideoGenerationUiMode,
  VideoImageSubMode,
} from '@/components/dashboard/types'
import { getStoredToken } from '@/lib/modules/auth/browser-session'
import {
  DEFAULT_VIDEO_MODEL,
  getVideoModelConfig,
  getVideoReferenceLimits,
} from '@/lib/modules/video/models'
import { serializeToApiPayload } from '@/lib/slate'
import { sortTasksByCreatedAtDesc } from '@/hooks/dashboard/use-task-display'

interface RefreshTaskResult {
  success: boolean
  error?: string
}

export function useTaskSubmission({
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
  setPromptExtend,
  setVideoSeed,
  setVideoGenerateAudio,
  setVideoGenMode,
  setImageGenSubMode,
  setReferenceSubMode,
  setReferenceImages,
  setReferenceVideos,
  setReferenceAudios,
  setActiveTab,
  setSelectedModel,
  videoGenMode,
  imageGenSubMode,
  editorValue,
  selectedModel,
  ratio,
  resolution,
  duration,
  videoCount,
  promptExtend,
  videoSeed,
  videoGenerateAudio,
  estimatedTokens,
  billingType,
  referenceImages,
  referenceVideos,
  referenceAudios,
}: {
  setTasks: Dispatch<SetStateAction<Task[]>>
  setPendingTasks: Dispatch<SetStateAction<Task[]>>
  setIsGenerating: Dispatch<SetStateAction<boolean>>
  fetchTasks: (...args: any[]) => any
  fetchStats: (viewTeam?: boolean) => Promise<void>
  fetchAssets: () => Promise<void>
  broadcastAssetChange: () => void
  setPrompt: Dispatch<SetStateAction<string>>
  setEditorValue: Dispatch<SetStateAction<Descendant[]>>
  setEditorKey: Dispatch<SetStateAction<number>>
  setResolution: Dispatch<SetStateAction<string>>
  setRatio: Dispatch<SetStateAction<string>>
  setDuration: Dispatch<SetStateAction<number>>
  setVideoCount: Dispatch<SetStateAction<number>>
  setPromptExtend: Dispatch<SetStateAction<boolean>>
  setVideoSeed: Dispatch<SetStateAction<string>>
  setVideoGenerateAudio: Dispatch<SetStateAction<boolean>>
  setVideoGenMode: Dispatch<SetStateAction<VideoGenerationUiMode>>
  setImageGenSubMode: Dispatch<SetStateAction<VideoImageSubMode>>
  setReferenceSubMode: Dispatch<SetStateAction<'reference'>>
  setReferenceImages: Dispatch<SetStateAction<Asset[]>>
  setReferenceVideos: Dispatch<SetStateAction<Asset[]>>
  setReferenceAudios: Dispatch<SetStateAction<Asset[]>>
  setActiveTab: Dispatch<SetStateAction<string>>
  setSelectedModel: Dispatch<SetStateAction<string>>
  videoGenMode: VideoGenerationUiMode
  imageGenSubMode: VideoImageSubMode
  editorValue: Descendant[]
  selectedModel: string
  ratio: string
  resolution: string
  duration: number
  videoCount: number
  promptExtend: boolean
  videoSeed: string
  videoGenerateAudio: boolean
  estimatedTokens: number
  billingType?: Task['billingType']
  referenceImages: Asset[]
  referenceVideos: Asset[]
  referenceAudios: Asset[]
}) {
  const submissionLockRef = useRef(false)
  const createSubmissionBatchId = useCallback(
    () => `video_batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    [],
  )

  const addPendingTasks = useCallback((newPendingTasks: Task[]) => {
    flushSync(() => {
      setPendingTasks((prev) => sortTasksByCreatedAtDesc([...newPendingTasks, ...prev]))
    })
  }, [setPendingTasks])

  const removePendingTask = useCallback((pendingTaskId: string) => {
    setPendingTasks((prev) => prev.filter((task) => task.id !== pendingTaskId))
  }, [setPendingTasks])

  const getGenerationErrorMessage = useCallback((result: any) => {
    if (!result) return '生成请求失败'
    if (typeof result.task?.errorMessage === 'string' && result.task.errorMessage.trim()) {
      return result.task.errorMessage
    }
    if (typeof result.details === 'string' && result.details.trim()) return result.details
    if (result.details?.error?.message) return result.details.error.message
    if (result.details?.message) return result.details.message
    if (typeof result.error === 'string' && result.error.trim()) return result.error
    return '生成请求失败'
  }, [])

  const getSubmissionWarningMessage = useCallback((result: any) => {
    if (typeof result?.warning === 'string' && result.warning.trim()) {
      return '上游响应超时或异常，任务状态待确认。系统已保留预扣，请勿立即重复提交。'
    }
    return null
  }, [selectedModel])

  const getOrderedReferenceAssetsForMode = useCallback((mode: string, assets: {
    referenceImages: Asset[]
    referenceVideos: Asset[]
    referenceAudios: Asset[]
  }) => {
    if (mode === 'first_frame') {
      return assets.referenceImages.slice(0, 1)
    }

    if (mode === 'first_last_frame') {
      return assets.referenceImages.slice(0, 2)
    }

    if (mode === 'first_clip') {
      return [
        ...assets.referenceVideos.slice(0, 1),
        ...assets.referenceImages.slice(0, 1),
      ]
    }

    if (mode === 'video_edit') {
      const limits = getVideoReferenceLimits(selectedModel, 'video_edit')
      const maxImages = typeof limits.maxImages === 'number' ? limits.maxImages : 4

      return [
        ...assets.referenceVideos.slice(0, 1),
        ...assets.referenceImages.slice(0, maxImages),
      ]
    }

    return [
      ...assets.referenceImages,
      ...assets.referenceVideos,
      ...assets.referenceAudios,
    ]
  }, [])

  const buildRequestBodyForMode = useCallback((params: {
    batchId: string
    mode: string
    model: string
    prompt: string
    promptAst?: Descendant[]
    ratio: string
    duration: number
    resolution: string
    generateAudio: boolean
    promptExtend: boolean
    seed: string | number
    referenceImages: Asset[]
    referenceVideos: Asset[]
    referenceAudios: Asset[]
  }) => {
    const {
      batchId,
      mode,
      model,
      prompt,
      promptAst,
      ratio,
      duration,
      resolution,
      generateAudio,
      promptExtend,
      seed,
      referenceImages,
      referenceVideos,
      referenceAudios,
    } = params

    const imageUrls = referenceImages.map((asset) => asset.url)
    const videoUrls = referenceVideos.map((asset) => asset.url)
    const audioUrls = referenceAudios.map((asset) => asset.url)
    const requestBody: any = {
      model,
      mode,
      prompt,
      prompt_ast: promptAst,
      batch_id: batchId,
      ratio,
      duration,
      resolution,
      watermark: false,
      generate_audio: generateAudio,
      prompt_extend: promptExtend,
      seed,
    }

    if (mode === 'first_frame') {
      if (imageUrls.length === 0) {
        throw new Error('请先上传 1 张首帧图片')
      }
      requestBody.first_frame_url = imageUrls[0]
    } else if (mode === 'first_last_frame') {
      if (imageUrls.length < 2) {
        throw new Error('请先上传 2 张图片作为首尾帧')
      }
      requestBody.first_frame_url = imageUrls[0]
      requestBody.last_frame_url = imageUrls[1]
    } else if (mode === 'first_clip') {
      if (videoUrls.length === 0) {
        throw new Error('请先上传 1 段视频作为首段')
      }
      requestBody.first_clip_url = videoUrls[0]
      if (imageUrls.length > 0) {
        requestBody.last_frame_url = imageUrls[0]
      }
    } else if (mode === 'reference') {
      const modelConfig = getVideoModelConfig(model)
      const referenceLimits = getVideoReferenceLimits(model, 'reference')

      if (typeof referenceLimits.maxImages === 'number' && imageUrls.length > referenceLimits.maxImages) {
        throw new Error(`${modelConfig.label} 最多支持 ${referenceLimits.maxImages} 张参考图片`)
      }

      if (typeof referenceLimits.maxVideos === 'number' && videoUrls.length > referenceLimits.maxVideos) {
        throw new Error(`${modelConfig.label} 不支持参考视频`)
      }

      if (typeof referenceLimits.maxAudios === 'number' && audioUrls.length > referenceLimits.maxAudios) {
        throw new Error(`${modelConfig.label} 不支持音频参考素材`)
      }

      if (typeof referenceLimits.maxTotalVisual === 'number' && imageUrls.length + videoUrls.length > referenceLimits.maxTotalVisual) {
        throw new Error(`${modelConfig.label} 最多支持 ${referenceLimits.maxTotalVisual} 个图片/视频参考素材`)
      }

      if (imageUrls.length + videoUrls.length === 0) {
        throw new Error(`${modelConfig.label} 至少需要 1 个参考素材`)
      }

      if (imageUrls.length > 0) requestBody.reference_image_urls = imageUrls
      if (videoUrls.length > 0) requestBody.reference_video_urls = videoUrls
      if (audioUrls.length > 0) requestBody.reference_audio_urls = audioUrls
      if (videoUrls.length > 0) {
        requestBody.reference_video_durations = referenceVideos.map((asset) => (
          typeof asset.duration === 'number' ? asset.duration : null
        ))
      }
      if (audioUrls.length > 0) {
        requestBody.reference_audio_durations = referenceAudios.map((asset) => (
          typeof asset.duration === 'number' ? asset.duration : null
        ))
      }
    } else if (mode === 'video_edit') {
      const modelConfig = getVideoModelConfig(model)
      const referenceLimits = getVideoReferenceLimits(model, 'video_edit')
      const maxImages = typeof referenceLimits.maxImages === 'number' ? referenceLimits.maxImages : 4
      const maxVideos = typeof referenceLimits.maxVideos === 'number' ? referenceLimits.maxVideos : 1

      if (videoUrls.length === 0) {
        throw new Error(`${modelConfig.label} 视频编辑需要先选择 1 条待编辑视频`)
      }

      if (videoUrls.length > maxVideos) {
        throw new Error(`${modelConfig.label} 视频编辑只支持 ${maxVideos} 条待编辑视频`)
      }

      if (imageUrls.length > maxImages) {
        throw new Error(`${modelConfig.label} 视频编辑最多支持 ${maxImages} 张参考图片`)
      }

      requestBody.reference_image_urls = imageUrls.slice(0, maxImages)
      requestBody.reference_video_urls = videoUrls.slice(0, maxVideos)
    }

    return {
      requestBody,
      orderedReferenceAssets: getOrderedReferenceAssetsForMode(mode, {
        referenceImages,
        referenceVideos,
        referenceAudios,
      }),
    }
  }, [getOrderedReferenceAssetsForMode])

  const upsertResolvedTask = useCallback((pendingTask: Task, result: any) => {
      const resolvedTask: Task = {
      ...pendingTask,
      id: result.task.id,
      batchId: result.task.batchId || pendingTask.batchId,
      externalId: result.external_id || result.task.externalId,
      status: result.task.status || 'processing',
      outputUrl: result.video_path || pendingTask.outputUrl,
      errorMessage: ['failed', 'submit_unknown'].includes(result.task.status)
        ? getGenerationErrorMessage(result)
        : pendingTask.errorMessage,
      totalTokens: typeof result.total_tokens === 'number' ? result.total_tokens : pendingTask.totalTokens,
      costYuan: typeof result.cost === 'number' ? result.cost : pendingTask.costYuan,
      isOptimistic: false,
    }

    setPendingTasks((prev) => prev.filter((task) => task.id !== pendingTask.id))
    setTasks((prev) =>
      sortTasksByCreatedAtDesc([resolvedTask, ...prev.filter((task) => task.id !== resolvedTask.id)])
    )
  }, [getGenerationErrorMessage, setPendingTasks, setTasks])

  const buildPendingTask = useCallback(({
    batchId,
    prompt,
    promptAst,
    mode,
    model,
    ratio,
    resolution,
    duration,
    generateAudio,
    promptExtend,
    seed,
    estimatedTokens,
    referenceAssets,
    billingType,
    batchIndex,
  }: {
    batchId?: string
    prompt: string
    promptAst?: any[]
    mode: string
    model: string
    ratio: string
    resolution: string
    duration: number
    generateAudio: boolean
    promptExtend?: boolean
    seed?: number
    estimatedTokens: number
    referenceAssets: Asset[]
    billingType?: Task['billingType']
    batchIndex: number
  }): Task => {
    const createdAt = new Date(Date.now() + batchIndex).toISOString()

    return {
      id: `pending_${Date.now()}_${batchIndex}_${Math.random().toString(36).slice(2, 8)}`,
      batchId,
      mode,
      model,
      prompt,
      promptAst,
      status: 'pending',
      estimatedTokens,
      ratio,
      resolution,
      duration,
      generateAudio,
      promptExtend,
      seed,
      createdAt,
      referenceAssets,
      billingType,
      isOptimistic: true,
    }
  }, [])

  const submitGenerationBatch = useCallback(async ({
    requestBody,
    optimisticTasks,
  }: {
    requestBody: any
    optimisticTasks: Task[]
  }) => {
    const token = getStoredToken()
    if (!token || optimisticTasks.length === 0 || submissionLockRef.current) {
      return
    }

    submissionLockRef.current = true
    setIsGenerating(true)
    addPendingTasks(optimisticTasks)

    try {
      const results = await Promise.all(
        optimisticTasks.map(async (optimisticTask) => {
          try {
            const response = await fetch('/api/generate/video', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(requestBody),
            })

            const result = await response.json().catch(() => null)

            if (result?.task?.id) {
              upsertResolvedTask(optimisticTask, result)
            } else {
              removePendingTask(optimisticTask.id)
            }

            return {
              ok: response.ok,
              hasTask: Boolean(result?.task?.id),
              result,
              errorMessage: null as string | null,
            }
          } catch (error: any) {
            removePendingTask(optimisticTask.id)
            return {
              ok: false,
              hasTask: false,
              result: null,
              errorMessage: error?.message || 'Network error',
            }
          }
        })
      )

      if (results.some((item) => item.hasTask)) {
        await fetchTasks()
        await fetchStats()
      }

      const budgetError = results.find(
        (item) =>
          item.result?.code === 'INSUFFICIENT_BUDGET' ||
          item.result?.code === 'INSUFFICIENT_QUOTA'
      )

      if (budgetError?.result?.error) {
        alert(`预算不足：${budgetError.result.error}`)
        return
      }

      const guardError = results.find((item) => item.result?.code === 'SUBMISSION_GUARD_TRIGGERED')
      if (guardError?.result?.error) {
        alert(guardError.result.error)
        return
      }

      const submitUnknownResult = results.find((item) => item.result?.task?.status === 'submit_unknown')
      if (submitUnknownResult) {
        const warning = getSubmissionWarningMessage(submitUnknownResult.result)
        if (warning) {
          alert(warning)
        }
      }

      const failedSubmission = results.find((item) => !item.hasTask && (!item.ok || item.errorMessage))
      if (failedSubmission) {
        alert(failedSubmission.errorMessage || getGenerationErrorMessage(failedSubmission.result))
      }
    } finally {
      submissionLockRef.current = false
      setIsGenerating(false)
    }
  }, [addPendingTasks, fetchStats, fetchTasks, getGenerationErrorMessage, getSubmissionWarningMessage, removePendingTask, setIsGenerating, upsertResolvedTask])

  const refreshSingleTask = useCallback(async (taskId: string): Promise<RefreshTaskResult> => {
    const token = getStoredToken()

    try {
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, isRefreshing: true } : task)))

      const response = await fetch(`/api/tasks/${taskId}/status?attempt_confirm=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Refresh failed')
      }

      const data = await response.json()
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== taskId) return task
          return {
            ...task,
            status: data.status,
            outputUrl: data.video_path,
            totalTokens: data.total_tokens,
            errorMessage: data.error_message,
            generationTime: data.generation_time,
            isRefreshing: false,
          }
        })
      )

      if (['succeeded', 'failed', 'expired'].includes(data.status)) {
        if (data.status === 'succeeded' && data.video_path) {
          await fetchAssets()
          broadcastAssetChange()
        }
        await fetchStats()
      } else if (data.confirmation_deferred) {
        const retrySeconds = Math.max(1, Math.ceil((data.retry_after_ms || 0) / 1000))
        return { success: false, error: `确认请求过于频繁，请约 ${retrySeconds} 秒后再试` }
      }

      return { success: true }
    } catch (error) {
      console.error('[MANUAL REFRESH] Error:', error)
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, isRefreshing: false } : task)))
      return { success: false, error: '刷新失败' }
    }
  }, [broadcastAssetChange, fetchAssets, fetchStats, setTasks])

  const handleReEdit = useCallback((task: Task, batchSize = 1) => {
    const orderedReferenceAssets = task.referenceAssets || []
    const taskModelConfig = getVideoModelConfig(task.model || DEFAULT_VIDEO_MODEL)

    if (task.promptAst && Array.isArray(task.promptAst) && task.promptAst.length > 0) {
      setEditorValue(task.promptAst as Descendant[])
      const payload = serializeToApiPayload(task.promptAst as Descendant[])
      setPrompt(payload.prompt)
    } else {
      setPrompt(task.prompt)
      setEditorValue([
        { type: 'paragraph', children: [{ text: task.prompt || '' }] },
      ] as Descendant[])
    }

    setEditorKey((prev) => prev + 1)
    setResolution(task.resolution || taskModelConfig.defaultResolution)
    setRatio(task.ratio || taskModelConfig.defaultRatio)
    setDuration(typeof task.duration === 'number' ? task.duration : taskModelConfig.defaultDuration)
    setVideoCount(batchSize)
    setPromptExtend(task.promptExtend !== false)
    setVideoSeed(typeof task.seed === 'number' && task.seed >= 0 ? String(task.seed) : '')
    setVideoGenerateAudio(task.generateAudio !== false)

    if (task.mode === 'text_to_video') {
      setVideoGenMode('text_to_video')
    } else if (task.mode === 'video_edit') {
      setVideoGenMode('video_edit')
    } else if (task.mode === 'first_frame' || task.mode === 'first_last_frame' || task.mode === 'first_clip') {
      setVideoGenMode('image_to_video')
      setImageGenSubMode(task.mode as VideoImageSubMode)
    } else {
      setVideoGenMode('reference')
      setReferenceSubMode('reference')
    }

    setReferenceImages(orderedReferenceAssets.filter((asset) => asset.type === 'image'))
    setReferenceVideos(orderedReferenceAssets.filter((asset) => asset.type === 'video'))
    setReferenceAudios(orderedReferenceAssets.filter((asset) => asset.type === 'audio'))
    setSelectedModel(getVideoModelConfig(task.model).id)
    setActiveTab('ai-video')
  }, [
    setActiveTab,
    setDuration,
    setEditorKey,
    setEditorValue,
    setImageGenSubMode,
    setPrompt,
    setRatio,
    setReferenceAudios,
    setReferenceImages,
    setReferenceSubMode,
    setReferenceVideos,
    setResolution,
    setSelectedModel,
    setVideoCount,
    setVideoGenMode,
    setPromptExtend,
    setVideoSeed,
    setVideoGenerateAudio,
  ])

  const handleGenerateWithParams = useCallback(async (task: Task, batchSize = 1) => {
    const batchId = createSubmissionBatchId()
    const promptPayload = task.promptAst && Array.isArray(task.promptAst) && task.promptAst.length > 0
      ? serializeToApiPayload(task.promptAst as Descendant[])
      : null
    const effectivePrompt = promptPayload?.prompt || task.prompt

    if (!effectivePrompt.trim() || submissionLockRef.current) return

    const normalizedTaskMode = task.mode === 'video_extend' ? 'reference' : task.mode
    const orderedReferenceAssets = task.referenceAssets || []
    const referenceImagesForTask = orderedReferenceAssets.filter((asset) => asset.type === 'image')
    const referenceVideosForTask = orderedReferenceAssets.filter((asset) => asset.type === 'video')
    const referenceAudiosForTask = orderedReferenceAssets.filter((asset) => asset.type === 'audio')
    const { requestBody, orderedReferenceAssets: requestReferenceAssets } = buildRequestBodyForMode({
      batchId,
      mode: normalizedTaskMode,
      model: task.model || DEFAULT_VIDEO_MODEL,
      prompt: effectivePrompt,
      promptAst: task.promptAst as Descendant[] | undefined,
      ratio: task.ratio,
      duration: task.duration,
      resolution: task.resolution,
      generateAudio: task.generateAudio !== false,
      promptExtend: task.promptExtend !== false,
      seed: typeof task.seed === 'number' ? task.seed : -1,
      referenceImages: referenceImagesForTask,
      referenceVideos: referenceVideosForTask,
      referenceAudios: referenceAudiosForTask,
    })

    await submitGenerationBatch({
      requestBody,
      optimisticTasks: Array.from({ length: batchSize }, (_, batchIndex) =>
        buildPendingTask({
          prompt: effectivePrompt,
          promptAst: task.promptAst,
          batchId,
          mode: normalizedTaskMode,
          model: task.model || DEFAULT_VIDEO_MODEL,
          ratio: task.ratio,
          resolution: task.resolution,
          duration: task.duration,
          generateAudio: task.generateAudio,
          promptExtend: task.promptExtend !== false,
          seed: task.seed,
          estimatedTokens: Math.floor((task.estimatedTokens || 0) / batchSize),
          referenceAssets: requestReferenceAssets,
          billingType: task.billingType,
          batchIndex,
        }),
      ),
    })
  }, [buildPendingTask, buildRequestBodyForMode, createSubmissionBatchId, submitGenerationBatch])

  const handleReGenerate = useCallback(async (task: Task, batchSize = 1) => {
    handleReEdit(task, batchSize)
    setTimeout(() => {
      handleGenerateWithParams(task, batchSize)
    }, 100)
  }, [handleGenerateWithParams, handleReEdit])

  const handleVideoEdit = useCallback((task: Task) => {
    if (!task.outputUrl) return

    const videoAsset: Asset = {
      id: `generated_${task.id}`,
      name: `生成视频_${task.id.slice(-8)}`,
      type: 'video',
      url: task.outputUrl,
      category: 'creation',
    }

    setReferenceImages([])
    setReferenceVideos([videoAsset])
    setReferenceAudios([])
    setReferenceSubMode('reference')
    setSelectedModel('wan2.7-videoedit')
    setVideoGenMode('video_edit')
    setDuration(0)
    setVideoCount(1)
    setPromptExtend(true)
    setVideoSeed('')
    setVideoGenerateAudio(true)
    setPrompt('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [
    setDuration,
    setPrompt,
    setReferenceAudios,
    setReferenceImages,
    setReferenceSubMode,
    setReferenceVideos,
    setSelectedModel,
    setVideoCount,
    setVideoGenMode,
    setPromptExtend,
    setVideoSeed,
    setVideoGenerateAudio,
  ])

  const handleGenerate = useCallback(async () => {
    const batchId = createSubmissionBatchId()
    const payload = serializeToApiPayload(editorValue)
    if (!payload.prompt.trim() || submissionLockRef.current) return

    let actualMode = 'reference'
    if (videoGenMode === 'text_to_video') {
      actualMode = 'text_to_video'
    } else if (videoGenMode === 'image_to_video') {
      actualMode = imageGenSubMode
    } else if (videoGenMode === 'video_edit') {
      actualMode = 'video_edit'
    } else if (videoGenMode === 'reference') {
      actualMode = 'reference'
    }

    let requestBody: any
    let orderedReferenceAssets: Asset[]
    try {
      const requestPayload = buildRequestBodyForMode({
        batchId,
        mode: actualMode,
        model: selectedModel,
        prompt: payload.prompt,
        promptAst: editorValue,
        ratio,
        duration,
        resolution,
        generateAudio: videoGenerateAudio,
        promptExtend,
        seed: videoSeed.trim() === '' ? -1 : videoSeed.trim(),
        referenceImages,
        referenceVideos,
        referenceAudios,
      })
      requestBody = requestPayload.requestBody
      orderedReferenceAssets = requestPayload.orderedReferenceAssets
    } catch (error: any) {
      window.alert(error?.message || '生成参数不合法')
      return
    }

    const optimisticTasks = Array.from({ length: videoCount }, (_, batchIndex) =>
      buildPendingTask({
        prompt: payload.prompt,
        promptAst: editorValue,
        batchId,
        mode: actualMode,
        model: selectedModel,
          ratio,
          resolution,
          duration,
          generateAudio: videoGenerateAudio,
          promptExtend,
          seed: videoSeed.trim() === '' ? -1 : Number.parseInt(videoSeed.trim(), 10),
          estimatedTokens: Math.floor(estimatedTokens / videoCount),
        referenceAssets: orderedReferenceAssets,
        billingType,
        batchIndex,
      })
    )

    await submitGenerationBatch({
      requestBody,
      optimisticTasks,
    })
  }, [
    billingType,
    buildPendingTask,
    createSubmissionBatchId,
    duration,
    editorValue,
    estimatedTokens,
    imageGenSubMode,
    promptExtend,
    ratio,
    referenceAudios,
    referenceImages,
    referenceVideos,
    resolution,
    selectedModel,
    submitGenerationBatch,
    buildRequestBodyForMode,
    videoGenerateAudio,
    videoSeed,
    videoCount,
    videoGenMode,
  ])

  return {
    handleGenerate,
    handleGenerateWithParams,
    handleReEdit,
    handleReGenerate,
    handleVideoEdit,
    refreshSingleTask,
  }
}
