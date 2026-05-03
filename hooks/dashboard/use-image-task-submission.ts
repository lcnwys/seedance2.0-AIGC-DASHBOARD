'use client'

import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { flushSync } from 'react-dom'
import type { Descendant } from 'slate'
import type {
  DashboardAsset as Asset,
  DashboardTask as Task,
  ImageGenerationUiMode,
} from '@/components/dashboard/types'
import { getStoredToken } from '@/lib/modules/auth/browser-session'
import type { ImageEditBBox } from '@/lib/modules/image/types'
import { getImageModelConfig, normalizeImageMaxImages } from '@/lib/modules/image/models'
import {
  inferSceneRatioQualityFromSize,
  isWan27ImageModel,
  type SizeTier,
  resolveWanSize,
} from '@/lib/modules/image/size-config'
import { serializeToApiPayload } from '@/lib/slate'
import { sortTasksByCreatedAtDesc } from '@/hooks/dashboard/use-task-display'

export function useImageTaskSubmission({
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
  setActiveTab,
  imageEditorValue,
  imageSelectedModel,
  imageReferenceImages,
  imageReferenceBoxesByAssetId,
  imageSize,
  imageRatio,
  imageSizeTier,
  imageOutputFormat,
  imageGenerationMode,
  imageWatermark,
  imagePromptExtend,
  imageSequentialMode,
  imageMaxImages,
  imageEnableWebSearch,
}: {
  setImageTasks: Dispatch<SetStateAction<Task[]>>
  setIsImageGenerating: Dispatch<SetStateAction<boolean>>
  fetchImageTasks: () => Promise<void>
  fetchAssets: () => Promise<void>
  broadcastAssetChange: () => void
  setImagePrompt: Dispatch<SetStateAction<string>>
  setImageEditorValue: Dispatch<SetStateAction<Descendant[]>>
  setImageEditorKey: Dispatch<SetStateAction<number>>
  setImageSelectedModel: Dispatch<SetStateAction<string>>
  setImageReferenceImages: Dispatch<SetStateAction<Asset[]>>
  setImageReferenceBoxesByAssetId: Dispatch<SetStateAction<Record<string, ImageEditBBox[]>>>
  setImageSize: Dispatch<SetStateAction<string>>
  setImageRatio: Dispatch<SetStateAction<string>>
  setImageSizeTier: Dispatch<SetStateAction<SizeTier>>
  setImageOutputFormat: Dispatch<SetStateAction<'jpeg' | 'png'>>
  setImageGenerationMode: Dispatch<SetStateAction<ImageGenerationUiMode>>
  setImageWatermark: Dispatch<SetStateAction<boolean>>
  setImagePromptExtend: Dispatch<SetStateAction<boolean>>
  setImageSequentialMode: Dispatch<SetStateAction<'disabled' | 'auto'>>
  setImageMaxImages: Dispatch<SetStateAction<number>>
  setImageEnableWebSearch: Dispatch<SetStateAction<boolean>>
  setActiveTab: Dispatch<SetStateAction<string>>
  imageEditorValue: Descendant[]
  imageSelectedModel: string
  imageReferenceImages: Asset[]
  imageReferenceBoxesByAssetId: Record<string, ImageEditBBox[]>
  imageSize: string
  imageRatio: string
  imageSizeTier: SizeTier
  imageOutputFormat: 'jpeg' | 'png'
  imageGenerationMode: ImageGenerationUiMode
  imageWatermark: boolean
  imagePromptExtend: boolean
  imageSequentialMode: 'disabled' | 'auto'
  imageMaxImages: number
  imageEnableWebSearch: boolean
}) {
  const submissionLockRef = useRef(false)
  const imageGenerationDisabled = true

  const addOptimisticImageTask = useCallback((task: Task) => {
    flushSync(() => {
      setImageTasks((prev) => sortTasksByCreatedAtDesc([task, ...prev]))
    })
  }, [setImageTasks])

  const removeOptimisticImageTask = useCallback((taskId: string) => {
    setImageTasks((prev) => prev.filter((task) => task.id !== taskId))
  }, [setImageTasks])

  const buildPendingImageTask = useCallback(({
    prompt,
    promptAst,
    mode,
    model,
    size,
    outputFormat,
    referenceAssets,
    imageEditConfig,
    promptExtend,
  }: {
    prompt: string
    promptAst?: any[]
    mode: string
    model: string
    size: string
    outputFormat: 'jpeg' | 'png'
    referenceAssets: Asset[]
    imageEditConfig?: Task['imageEditConfig']
    promptExtend?: boolean
  }): Task => ({
    id: `pending_image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    taskKind: 'image',
    mode,
    model,
    prompt,
    promptAst,
    status: 'pending',
    estimatedTokens: 0,
    ratio: '1:1',
    resolution: size,
    size,
    outputFormat,
    promptExtend,
    duration: 0,
    generateAudio: false,
    createdAt: new Date().toISOString(),
    referenceAssets,
    imageEditConfig,
    outputAssets: [],
    isOptimistic: true,
  }), [])

  const upsertResolvedImageTask = useCallback((pendingTaskId: string, task: Task) => {
    flushSync(() => {
      setImageTasks((prev) =>
        sortTasksByCreatedAtDesc([
          task,
          ...prev.filter((item) => item.id !== pendingTaskId && item.id !== task.id),
        ])
      )
    })
  }, [setImageTasks])

  const applyImageTaskToForm = useCallback((task: Task) => {
    const modelConfig = getImageModelConfig(task.model)

    if (task.promptAst && Array.isArray(task.promptAst) && task.promptAst.length > 0) {
      setImageEditorValue(task.promptAst as Descendant[])
      const payload = serializeToApiPayload(task.promptAst as Descendant[])
      setImagePrompt(payload.prompt)
    } else {
      setImagePrompt(task.prompt)
      setImageEditorValue([
        { type: 'paragraph', children: [{ text: task.prompt || '' }] },
      ] as Descendant[])
    }

    setImageEditorKey((prev) => prev + 1)
    setImageSelectedModel(task.model)
    setImageReferenceImages(
      modelConfig.supportedModes.includes('image_to_image')
        ? (task.referenceAssets?.filter((asset) => asset.type === 'image') || []).slice(0, modelConfig.maxReferenceImages)
        : [],
    )
    setImageReferenceBoxesByAssetId(() => {
      const nextState: Record<string, ImageEditBBox[]> = {}
      const imageReferenceAssets = (task.referenceAssets?.filter((asset) => asset.type === 'image') || []).slice(0, modelConfig.maxReferenceImages)
      const bboxList = task.imageEditConfig?.bboxList || []

      imageReferenceAssets.forEach((asset, index) => {
        if ((bboxList[index] || []).length > 0) {
          nextState[asset.id] = bboxList[index]
        }
      })

      return nextState
    })
    const resolvedSize = task.size || task.resolution || '2K'
    const inferred = inferSceneRatioQualityFromSize(resolvedSize, task.model)

    setImageRatio(inferred.ratio)
    setImageSizeTier(inferred.tier)
    setImageSize(isWan27ImageModel(task.model) ? resolveWanSize(inferred.tier, inferred.ratio) : resolvedSize)
    setImageOutputFormat(
      modelConfig.supportedOutputFormats.includes('png') && task.outputFormat === 'png'
        ? 'png'
        : modelConfig.defaultOutputFormat,
    )
    setImageWatermark(task.watermark ?? false)
    setImagePromptExtend(task.promptExtend !== false)
    setImageGenerationMode(
      modelConfig.supportsSequential && (task.generatedImages || 0) > 1
        ? 'group'
        : 'single',
    )
    setImageSequentialMode(
      modelConfig.supportsSequential && task.generatedImages && task.generatedImages > 1
        ? 'auto'
        : 'disabled',
    )
    setImageMaxImages(normalizeImageMaxImages(task.model, task.generatedImages || imageMaxImages))
    setImageEnableWebSearch(modelConfig.supportsWebSearch ? imageEnableWebSearch : false)
    setActiveTab('ai-video')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [
    imageMaxImages,
    imageWatermark,
    setActiveTab,
    setImageEditorKey,
    setImageEditorValue,
    imageEnableWebSearch,
    setImageEnableWebSearch,
    setImageMaxImages,
    setImageOutputFormat,
    setImagePrompt,
    setImageReferenceImages,
    setImageGenerationMode,
    setImageRatio,
    setImageSizeTier,
    setImageSelectedModel,
    setImageSequentialMode,
    setImageSize,
    setImageWatermark,
    setImagePromptExtend,
    setImageReferenceBoxesByAssetId,
  ])

  const submitImageRequest = useCallback(async ({
    requestBody,
    optimisticTask,
  }: {
    requestBody: Record<string, unknown>
    optimisticTask: Task
  }) => {
    if (imageGenerationDisabled) {
      window.alert('图片生成功能已移除')
      return null
    }

    const token = getStoredToken()
    if (!token || submissionLockRef.current) {
      return null
    }

    submissionLockRef.current = true
    setIsImageGenerating(true)
    addOptimisticImageTask(optimisticTask)

    try {
      const response = await fetch('/api/generate/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        removeOptimisticImageTask(optimisticTask.id)
        throw new Error(result?.error || '图片生成失败')
      }

      if (result?.task) {
        upsertResolvedImageTask(optimisticTask.id, result.task)
      } else {
        removeOptimisticImageTask(optimisticTask.id)
        await fetchImageTasks()
      }

      return result?.task || null
    } catch (error) {
      removeOptimisticImageTask(optimisticTask.id)
      await fetchImageTasks().catch(() => null)
      throw error
    } finally {
      submissionLockRef.current = false
      setIsImageGenerating(false)
    }
  }, [
    addOptimisticImageTask,
    fetchImageTasks,
    removeOptimisticImageTask,
    setIsImageGenerating,
    upsertResolvedImageTask,
  ])

  const handleGenerateImage = useCallback(async () => {
    if (imageGenerationDisabled) {
      window.alert('图片生成功能已移除')
      return
    }

    const payload = serializeToApiPayload(imageEditorValue)
    if (!payload.prompt.trim()) {
      return
    }

    const modelConfig = getImageModelConfig(imageSelectedModel)
    const hasAnyReferenceImages = imageReferenceImages.length > 0
    const usesReferenceImages =
      (imageGenerationMode === 'single' || imageGenerationMode === 'group')
      && hasAnyReferenceImages

    if (!modelConfig.supportedModes.includes('image_to_image') && usesReferenceImages) {
      window.alert(`${modelConfig.label} 当前只接入基础文生图，请移除参考图片后再生成`)
      return
    }

    const imageUrls = modelConfig.supportedModes.includes('image_to_image') && usesReferenceImages
      ? imageReferenceImages.map((asset) => asset.url)
      : []
    const orderedReferenceAssets = imageUrls
      .map((url) => imageReferenceImages.find((asset) => asset.url === url))
      .filter((asset): asset is Asset => Boolean(asset))
    const bboxList = modelConfig.supportsBboxEdit
      ? orderedReferenceAssets.map((asset) => imageReferenceBoxesByAssetId[asset.id] || [])
      : []
    const shouldSendBboxList = modelConfig.supportsBboxEdit && bboxList.some((items) => items.length > 0)

    if (imageUrls.length > modelConfig.maxReferenceImages) {
      window.alert(`${modelConfig.label} 最多支持 ${modelConfig.maxReferenceImages} 张参考图片`)
      return
    }

    const actualMode = imageUrls.length > 0 ? 'image_to_image' : 'text_to_image'
    const effectiveSize = isWan27ImageModel(imageSelectedModel) ? resolveWanSize(imageSizeTier, imageRatio) : imageSize
    const optimisticTask = buildPendingImageTask({
      prompt: payload.prompt,
      promptAst: imageEditorValue,
      mode: actualMode,
      model: imageSelectedModel,
      size: effectiveSize,
      outputFormat: imageOutputFormat,
      referenceAssets: orderedReferenceAssets,
      imageEditConfig: bboxList.some((items) => items.length > 0) ? { bboxList } : undefined,
      promptExtend: modelConfig.supportsPromptExtend ? imagePromptExtend : false,
    })

    try {
      await submitImageRequest({
        requestBody: {
          model: imageSelectedModel,
          prompt: payload.prompt,
          prompt_ast: imageEditorValue,
          reference_image_urls: imageUrls,
          ...(shouldSendBboxList ? { bbox_list: bboxList } : {}),
          size: effectiveSize,
          ...(isWan27ImageModel(imageSelectedModel)
            ? {
                image_ratio: imageRatio,
                image_size_tier: imageSizeTier,
              }
            : {}),
          output_format: imageOutputFormat,
          watermark: imageWatermark,
          prompt_extend: modelConfig.supportsPromptExtend ? imagePromptExtend : false,
          sequential_image_generation: modelConfig.supportsSequential && imageGenerationMode === 'group' ? 'auto' : 'disabled',
          max_images: modelConfig.supportsSequential && imageGenerationMode === 'group'
            ? normalizeImageMaxImages(imageSelectedModel, imageMaxImages)
            : 1,
          enable_web_search: modelConfig.supportsWebSearch ? imageEnableWebSearch : false,
        },
        optimisticTask,
      })
    } catch (error: any) {
      window.alert(error?.message || '图片生成失败')
    }
  }, [
    imageEditorValue,
    imageEnableWebSearch,
    imageMaxImages,
    imageOutputFormat,
    imageReferenceImages,
    imageGenerationMode,
    imageSelectedModel,
    imageSequentialMode,
    imageSize,
    imageRatio,
    imageSizeTier,
    imageWatermark,
    imagePromptExtend,
    imageReferenceBoxesByAssetId,
    buildPendingImageTask,
    submitImageRequest,
  ])

  const handleImageReEdit = useCallback((task: Task) => {
    if (imageGenerationDisabled) {
      window.alert('图片生成功能已移除')
      return
    }

    applyImageTaskToForm(task)
  }, [applyImageTaskToForm])

  const handleImageReGenerate = useCallback(async (task: Task) => {
    if (imageGenerationDisabled) {
      window.alert('图片生成功能已移除')
      return
    }

    const modelConfig = getImageModelConfig(task.model)
    applyImageTaskToForm(task)
    const promptPayload = task.promptAst && Array.isArray(task.promptAst) && task.promptAst.length > 0
      ? serializeToApiPayload(task.promptAst as Descendant[])
      : null
    const effectivePrompt = promptPayload?.prompt || task.prompt
    const resolvedSize = task.size || task.resolution || '2K'
    const inferred = inferSceneRatioQualityFromSize(resolvedSize, task.model)
    const optimisticTask = buildPendingImageTask({
      prompt: effectivePrompt,
      promptAst: task.promptAst,
      mode: task.mode,
      model: task.model,
      size: resolvedSize,
      outputFormat: task.outputFormat === 'png' && modelConfig.supportedOutputFormats.includes('png') ? 'png' : modelConfig.defaultOutputFormat,
      referenceAssets: task.referenceAssets?.filter((asset) => asset.type === 'image') || [],
      imageEditConfig: task.imageEditConfig,
      promptExtend: task.promptExtend !== false,
    })
    try {
      await submitImageRequest({
        requestBody: {
          model: task.model,
          prompt: effectivePrompt,
          prompt_ast: task.promptAst,
          reference_image_urls: modelConfig.supportedModes.includes('image_to_image')
          ? task.referenceAssets?.filter((asset) => asset.type === 'image').map((asset) => asset.url) || []
            : [],
          ...(modelConfig.supportsBboxEdit && task.imageEditConfig?.bboxList?.some((items) => items.length > 0)
            ? { bbox_list: task.imageEditConfig.bboxList }
            : {}),
          size: resolvedSize,
          ...(isWan27ImageModel(task.model)
            ? {
                image_ratio: inferred.ratio,
                image_size_tier: inferred.tier,
              }
            : {}),
          output_format: task.outputFormat === 'png' && modelConfig.supportedOutputFormats.includes('png') ? 'png' : modelConfig.defaultOutputFormat,
          watermark: task.watermark ?? false,
          prompt_extend: modelConfig.supportsPromptExtend ? task.promptExtend !== false : false,
          sequential_image_generation: modelConfig.supportsSequential && (task.generatedImages || 0) > 1 ? 'auto' : 'disabled',
          max_images: modelConfig.supportsSequential ? normalizeImageMaxImages(task.model, task.generatedImages || 1) : 1,
          enable_web_search: false,
        },
        optimisticTask,
      })
    } catch (error: any) {
      window.alert(error?.message || '图片生成失败')
    }
  }, [applyImageTaskToForm, buildPendingImageTask, submitImageRequest])

  return {
    handleGenerateImage,
    handleImageReEdit,
    handleImageReGenerate,
  }
}
