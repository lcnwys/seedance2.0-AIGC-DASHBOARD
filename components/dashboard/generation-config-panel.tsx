'use client'

import { useEffect, useRef, type DragEvent } from 'react'
import { PromptEditor, type Asset as PromptAsset } from '@/components/prompt-editor'
import { DashboardSelect } from '@/components/dashboard/dashboard-select'
import type {
  DashboardAsset as Asset,
  ImageGenerationUiMode,
  VideoGenerationUiMode,
  VideoImageSubMode,
} from '@/components/dashboard/types'
import {
  modelAllowsInlineImageReferences,
  modelRequiresObjectStorageForVideoMedia,
  videoModeAllowsNoStorageImageInputs,
} from '@/lib/modules/storage/media-input-policy'

import {
  getVideoModelConfig,
  getVideoModelPricingSummary,
  getVideoReferenceLimits,
  getSupportedVideoDurations,
  HAPPYHORSE_I2V_MODEL_ID,
  HAPPYHORSE_R2V_MODEL_ID,
  HAPPYHORSE_T2V_MODEL_ID,
  HAPPYHORSE_VIDEO_EDIT_MODEL_ID,
  isHappyHorseVideoModel,
  isWan27VideoModel,
  VIDEO_MODEL_OPTIONS,
} from '@/lib/modules/video/models'
import {
  getImageModelConfig,
  getImageModelProviderProtocol,
  getImageModelPricingSummary,
  IMAGE_MODEL_OPTIONS,
} from '@/lib/modules/image/models'
import {
  isWan27ImageModel,
  type SizeTier,
  DEFAULT_RATIOS,
  getAvailableSizeTiers,
  isValidCustomRatio,
} from '@/lib/modules/image/size-config'
import type { ImageEditBBox } from '@/lib/modules/image/types'
import { resolveImageEstimatedCostYuan } from '@/lib/modules/billing/cost'
import { RESOLUTION_DIMENSIONS, type TokenCalculationResult } from '@/lib/token-calculator'
import type { Descendant } from 'slate'
import type { ProviderGenerationMode } from '@/lib/modules/provider/types'

interface GenerationConfigPanelProps {
  activeTab: 'ai-video' | 'ai-image'
  hasObjectStorage: boolean
  videoGenMode: VideoGenerationUiMode
  imageGenSubMode: VideoImageSubMode
  selectedModel: string
  referenceImages: Asset[]
  referenceVideos: Asset[]
  referenceAudios: Asset[]
  editorKey: number
  editorValue: Descendant[]
  resolution: string
  ratio: string
  duration: number
  videoCount: number
  videoPromptExtend: boolean
  videoSeed: string
  videoGenerateAudio: boolean
  estimatedTokens: number
  tokenResult: TokenCalculationResult
  inputVideoDuration: number
  isGenerating: boolean
  prompt: string
  onActiveTabChange: (tab: 'ai-video' | 'ai-image') => void
  onVideoGenModeChange: (mode: VideoGenerationUiMode) => void
  onImageGenSubModeChange: (mode: VideoImageSubMode) => void
  onSelectedModelChange: (model: string) => void
  onOpenAssetPicker: (mode: 'image' | 'video' | 'audio') => void
  onDragStart: (type: 'image' | 'video' | 'audio', index: number) => void
  onDragOver: (event: DragEvent, type: 'image' | 'video' | 'audio', index: number) => void
  onDragEnd: () => void
  onRemoveReference: (type: 'image' | 'video' | 'audio', id: string) => void
  onEditorChange: (value: Descendant[]) => void
  onResolutionChange: (value: string) => void
  onRatioChange: (value: string) => void
  onDurationChange: (value: number) => void
  onVideoCountChange: (value: number) => void
  onVideoPromptExtendChange: (value: boolean) => void
  onVideoSeedChange: (value: string) => void
  onVideoGenerateAudioChange: (value: boolean) => void
  onGenerate: () => void
  imageSelectedModel: string
  imageReferenceImages: Asset[]
  imageReferenceBoxesByAssetId: Record<string, ImageEditBBox[]>
  imageEditorKey: number
  imageEditorValue: Descendant[]
  imageSize: string
  imageRatio: string
  imageRatioMode: 'preset' | 'custom'
  imageSizeTier: SizeTier
  imageCustomRatio: string
  imageOutputFormat: 'jpeg' | 'png'
  imageGenerationMode: ImageGenerationUiMode
  imageSequentialMode: 'disabled' | 'auto'
  imageMaxImages: number
  imageWatermark: boolean
  imagePromptExtend: boolean
  imageEnableWebSearch: boolean
  isImageGenerating: boolean
  imagePrompt: string
  onImageSelectedModelChange: (model: string) => void
  onImageSizeChange: (value: string) => void
  onImageRatioChange: (value: string) => void
  onImageRatioModeChange: (value: 'preset' | 'custom') => void
  onImageSizeTierChange: (value: string) => void
  onImageCustomRatioChange: (value: string) => void
  onImageOutputFormatChange: (value: 'jpeg' | 'png') => void
  onImageGenerationModeChange: (value: ImageGenerationUiMode) => void
  onImageSequentialModeChange: (value: 'disabled' | 'auto') => void
  onImageMaxImagesChange: (value: number) => void
  onImageWatermarkChange: (value: boolean) => void
  onImagePromptExtendChange: (value: boolean) => void
  onImageEnableWebSearchChange: (value: boolean) => void
  onImageEditorChange: (value: Descendant[]) => void
  onGenerateImage: () => void
  onOpenImageBboxEditor: (asset: Asset) => void
  onClearVideoConfig: () => void
  onClearImageConfig: () => void
}

export function GenerationConfigPanel({
  activeTab,
  hasObjectStorage,
  videoGenMode,
  imageGenSubMode,
  selectedModel,
  referenceImages,
  referenceVideos,
  referenceAudios,
  editorKey,
  editorValue,
  resolution,
  ratio,
  duration,
  videoCount,
  videoPromptExtend,
  videoSeed,
  videoGenerateAudio,
  estimatedTokens,
  tokenResult,
  inputVideoDuration,
  isGenerating,
  prompt,
  onActiveTabChange,
  onVideoGenModeChange,
  onImageGenSubModeChange,
  onSelectedModelChange,
  onOpenAssetPicker,
  onDragStart,
  onDragOver,
  onDragEnd,
  onRemoveReference,
  onEditorChange,
  onResolutionChange,
  onRatioChange,
  onDurationChange,
  onVideoCountChange,
  onVideoPromptExtendChange,
  onVideoSeedChange,
  onVideoGenerateAudioChange,
  onGenerate,
  imageSelectedModel,
  imageReferenceImages,
  imageReferenceBoxesByAssetId,
  imageEditorKey,
  imageEditorValue,
  imageSize,
  imageRatio,
  imageSizeTier,
  imageCustomRatio,
  imageRatioMode,
  imageOutputFormat,
  imageGenerationMode,
  imageSequentialMode,
  imageMaxImages,
  imageWatermark,
  imagePromptExtend,
  imageEnableWebSearch,
  isImageGenerating,
  imagePrompt,
  onImageSelectedModelChange,
  onImageSizeChange,
  onImageRatioChange,
  onImageRatioModeChange,
  onImageSizeTierChange,
  onImageCustomRatioChange,
  onImageOutputFormatChange,
  onImageGenerationModeChange,
  onImageSequentialModeChange,
  onImageMaxImagesChange,
  onImageWatermarkChange,
  onImagePromptExtendChange,
  onImageEnableWebSearchChange,
  onImageEditorChange,
  onGenerateImage,
  onOpenImageBboxEditor,
  onClearVideoConfig,
  onClearImageConfig,
}: GenerationConfigPanelProps) {
  const providerVideoMode: ProviderGenerationMode =
    videoGenMode === 'text_to_video' ? 'text_to_video' : videoGenMode === 'image_to_video' ? imageGenSubMode : videoGenMode
  const effectiveSelectedModel = selectedModel
  const selectedModelConfig = getVideoModelConfig(effectiveSelectedModel)
  const supportedVideoDurations = getSupportedVideoDurations(selectedModelConfig.id, {
    hasReferenceVideo: referenceVideos.length > 0,
  })
  const effectiveImageSelectedModel = imageSelectedModel
  const selectedImageModelConfig = getImageModelConfig(effectiveImageSelectedModel)
  const isWan27FamilyModel = isWan27VideoModel(selectedModelConfig.id)
  const isHappyHorseFamilyModel = isHappyHorseVideoModel(selectedModelConfig.id)
  const supportsImageToVideo = selectedModelConfig.supportedModes.includes('first_frame') || isWan27FamilyModel || isHappyHorseFamilyModel
  const supportsReference = selectedModelConfig.supportedModes.includes('reference') || isWan27FamilyModel || isHappyHorseFamilyModel
  const supportsTextToVideo = selectedModelConfig.supportedModes.includes('text_to_video') || isWan27FamilyModel || isHappyHorseFamilyModel
  const supportsVideoEdit = selectedModelConfig.supportedModes.includes('video_edit') || isWan27FamilyModel || isHappyHorseFamilyModel
  const supportsFirstLastFrame = selectedModelConfig.supportedModes.includes('first_last_frame')
  const supportsFirstClip = selectedModelConfig.supportedModes.includes('first_clip')
  const isDurationPricing = tokenResult.pricingMode === 'duration'
  const isVideoEditMode = videoGenMode === 'video_edit'
  const isWanImageToVideoModel = selectedModelConfig.id === 'wan2.7-i2v'
  const hidesRatioControl = isWanImageToVideoModel
    || selectedModelConfig.id === HAPPYHORSE_I2V_MODEL_ID
    || selectedModelConfig.id === HAPPYHORSE_VIDEO_EDIT_MODEL_ID
  const noStorageVideoMediaAllowed = hasObjectStorage
    || videoModeAllowsNoStorageImageInputs(selectedModelConfig.id, providerVideoMode)
  const canUseImageToVideoMode = supportsImageToVideo
    && (hasObjectStorage
      || videoModeAllowsNoStorageImageInputs(selectedModelConfig.id, 'first_frame'))
  const canUseReferenceMode = supportsReference
    && (hasObjectStorage
      || videoModeAllowsNoStorageImageInputs(selectedModelConfig.id, 'reference'))
  const canUseVideoEditMode = supportsVideoEdit && hasObjectStorage
  const canSubmitVideo = hasObjectStorage
    || (providerVideoMode !== 'first_clip'
      && providerVideoMode !== 'video_edit'
      && noStorageVideoMediaAllowed
      && referenceVideos.length === 0
      && referenceAudios.length === 0)
  const videoReferenceLimits = getVideoReferenceLimits(selectedModelConfig.id, providerVideoMode)
  const canAddVideoReference = hasObjectStorage && videoReferenceLimits.maxVideos !== 0
  const canAddAudioReference = hasObjectStorage && videoReferenceLimits.maxAudios !== 0
  const videoEditMaxReferenceImages = typeof videoReferenceLimits.maxImages === 'number'
    ? videoReferenceLimits.maxImages
    : 4
  const imageSupportsReferences = selectedImageModelConfig.supportedModes.includes('image_to_image')
  const imageSupportsSequential = selectedImageModelConfig.supportsSequential
  const imageSupportsWebSearch = selectedImageModelConfig.supportsWebSearch
  const imageSupportsBboxEdit = selectedImageModelConfig.supportsBboxEdit
  const imageSupportsPromptExtend = selectedImageModelConfig.supportsPromptExtend
  const imageReferenceLimit = selectedImageModelConfig.maxReferenceImages
  const imageReferenceCount = imageReferenceImages.length
  const usesWanImageSizeSystem = isWan27ImageModel(imageSelectedModel)
  const imageGenerationDisabled = true
  const imageRatioLocked = false
  const imageCustomRatioInputRef = useRef<HTMLInputElement | null>(null)
  const availableTiers = usesWanImageSizeSystem
    ? getAvailableSizeTiers(imageSelectedModel, imageReferenceCount > 0, imageGenerationMode === 'group')
    : []

  useEffect(() => {
    if (usesWanImageSizeSystem && imageRatioMode === 'custom') {
      imageCustomRatioInputRef.current?.focus()
    }
  }, [imageRatioMode, usesWanImageSizeSystem])
  const usesGrsaiImageRatioSystem = (
    getImageModelProviderProtocol(imageSelectedModel) === 'grsai-gpt-image'
    || getImageModelProviderProtocol(imageSelectedModel) === 'grsai-nano-banana'
  )
  const isSingleImageMode = imageGenerationMode === 'single'
  const imagePlannedCount = isSingleImageMode ? 1 : Math.max(1, imageMaxImages || 1)
  const imageEstimatedCostYuan = resolveImageEstimatedCostYuan({
    model: selectedImageModelConfig.id,
    promptExtend: imagePromptExtend,
    sequentialImageGeneration: isSingleImageMode ? 'disabled' : imageSequentialMode,
    maxImages: imagePlannedCount,
  })
  const imagePricingSummary = getImageModelPricingSummary(selectedImageModelConfig.id, imagePromptExtend)
  const imageCanUseReferences = imageSupportsReferences
    && (hasObjectStorage
      || modelAllowsInlineImageReferences(selectedImageModelConfig.id))
  const usesImageReferences = imageCanUseReferences && imageReferenceCount > 0
  const imageGroupVariantLabel =
    imageReferenceCount === 0 ? '文生组图' : imageReferenceCount === 1 ? '单图生组图' : '多图生组图'
  const imageSingleVariantLabel =
    imageReferenceCount === 0 ? '文生单图' : imageReferenceCount === 1 ? '单图参考生图' : '多图融合生图'
  const getImageReferenceBadgeLabel = (index: number) => {
    if (videoGenMode === 'image_to_video') {
      if (imageGenSubMode === 'first_last_frame') {
        if (index === 0) return '首帧'
        if (index === 1) return '尾帧'
      }

      if (imageGenSubMode === 'first_clip' && index === 0) {
        return '尾帧'
      }
    }

    return String(index + 1)
  }
  const getVideoReferenceBadgeLabel = (index: number) => {
    if (videoGenMode === 'image_to_video' && imageGenSubMode === 'first_clip' && index === 0) {
      return '首段'
    }

    return String(index + 1)
  }

  const wan27PickerModelId =
    videoGenMode === 'video_edit'
      ? 'wan2.7-videoedit'
      : videoGenMode === 'text_to_video'
        ? 'wan2.7-t2v'
        : videoGenMode === 'image_to_video'
          ? 'wan2.7-i2v'
          : 'wan2.7-r2v'
  const happyHorsePickerModelId =
    videoGenMode === 'video_edit'
      ? HAPPYHORSE_VIDEO_EDIT_MODEL_ID
      : videoGenMode === 'text_to_video'
        ? HAPPYHORSE_T2V_MODEL_ID
        : videoGenMode === 'image_to_video'
          ? HAPPYHORSE_I2V_MODEL_ID
          : HAPPYHORSE_R2V_MODEL_ID
  const videoModelOptions = [
      ...VIDEO_MODEL_OPTIONS.filter((modelOption) =>
        !isWan27VideoModel(modelOption.id) && !isHappyHorseVideoModel(modelOption.id)
      ),
      {
        ...getVideoModelConfig(wan27PickerModelId),
        label: '万相 Wan 2.7',
      },
      getVideoModelConfig(happyHorsePickerModelId),
    ]
  const selectedModelInPicker = videoModelOptions.some((modelOption) => modelOption.id === effectiveSelectedModel)
  const imageModelOptions = IMAGE_MODEL_OPTIONS
  const selectedImageModelInPicker = imageModelOptions.some((modelOption) => modelOption.id === effectiveImageSelectedModel)

  return (
    <div className="w-full shrink-0 border-b border-zinc-800 xl:flex xl:h-full xl:w-[420px] xl:flex-col xl:border-b-0 xl:border-r xl:overflow-hidden">
      <div className="border-b border-zinc-800 px-4 py-4 md:px-6">
        <div className="flex gap-4 overflow-x-auto">
          <button
            onClick={() => onActiveTabChange('ai-video')}
            className={`text-base font-medium transition-colors ${
              activeTab === 'ai-video' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            视频生成
          </button>
          {!imageGenerationDisabled && (
            <button
              onClick={() => onActiveTabChange('ai-image')}
              className={`text-base font-medium transition-colors ${
                activeTab === 'ai-image' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              图片生成
            </button>
          )}
        </div>
      </div>

      {activeTab === 'ai-video' && (
        <div className="space-y-4 px-4 py-4 md:px-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pb-6">
          <div className={`grid grid-cols-1 gap-2 ${supportsVideoEdit ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <button
              onClick={() => canUseImageToVideoMode && onVideoGenModeChange('image_to_video')}
              disabled={!canUseImageToVideoMode}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                videoGenMode === 'image_to_video'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : canUseImageToVideoMode
                    ? 'bg-zinc-900/50 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                    : 'bg-zinc-900/30 border border-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              图生视频
            </button>
            <button
              onClick={() => canUseReferenceMode && onVideoGenModeChange('reference')}
              disabled={!canUseReferenceMode}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                videoGenMode === 'reference'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : canUseReferenceMode
                    ? 'bg-zinc-900/50 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                    : 'bg-zinc-900/30 border border-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              参考生视频
            </button>
            <button
              onClick={() => supportsTextToVideo && onVideoGenModeChange('text_to_video')}
              disabled={!supportsTextToVideo}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                videoGenMode === 'text_to_video'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : supportsTextToVideo
                    ? 'bg-zinc-900/50 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                    : 'bg-zinc-900/30 border border-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              文生视频
            </button>
            <button
              onClick={() => canUseVideoEditMode && onVideoGenModeChange('video_edit')}
              disabled={!canUseVideoEditMode}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                videoGenMode === 'video_edit'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : canUseVideoEditMode
                    ? 'bg-zinc-900/50 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                    : 'bg-zinc-900/30 border border-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-4.553a1.5 1.5 0 10-2.122-2.122L12.88 7.88m2.12 2.12L8 17l-4 1 1-4 7-7m3 3l-3-3" />
              </svg>
              视频编辑
            </button>
          </div>

          <div className="glass rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <DashboardSelect
                  value={effectiveSelectedModel}
                  onChange={onSelectedModelChange}
                  options={[
                    ...(!selectedModelInPicker
                      ? [{ value: selectedModel, label: selectedModelConfig.label, disabled: true }]
                      : []),
                    ...videoModelOptions.map((modelOption) => ({
                      value: modelOption.id,
                      label: modelOption.label,
                      description: modelOption.description,
                    })),
                  ]}
                />
                <p className="text-[11px] text-zinc-600 mt-1">
                  {getVideoModelPricingSummary(selectedModelConfig.id, resolution)}
                </p>
              </div>
            </div>
          </div>

          {videoGenMode === 'image_to_video' && (
            <div className="glass rounded-xl p-4 border border-zinc-800">
              <h3 className="font-medium text-zinc-100 text-sm mb-3">生成模式</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  onClick={() => onImageGenSubModeChange('first_frame')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                    imageGenSubMode === 'first_frame'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-900/50 border border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  首帧生成
                </button>
                <button
                  onClick={() => supportsFirstLastFrame && onImageGenSubModeChange('first_last_frame')}
                  disabled={!supportsFirstLastFrame}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                    imageGenSubMode === 'first_last_frame'
                      ? 'bg-blue-600 text-white'
                      : supportsFirstLastFrame
                        ? 'bg-zinc-900/50 border border-zinc-700 text-zinc-400 hover:text-zinc-200'
                        : 'bg-zinc-900/30 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  首尾帧生成
                </button>
                {supportsFirstClip ? (
                  <button
                    onClick={() => hasObjectStorage && onImageGenSubModeChange('first_clip')}
                    disabled={!hasObjectStorage}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                      imageGenSubMode === 'first_clip'
                        ? 'bg-blue-600 text-white'
                        : hasObjectStorage
                          ? 'bg-zinc-900/50 border border-zinc-700 text-zinc-400 hover:text-zinc-200'
                          : 'bg-zinc-900/30 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    视频续写
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {(videoGenMode === 'reference' || videoGenMode === 'image_to_video' || videoGenMode === 'video_edit') && (
            <div className="glass rounded-xl p-4 border border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-zinc-100 text-sm">
                  {videoGenMode === 'image_to_video'
                    ? (imageGenSubMode === 'first_clip' ? '续写素材' : '参考图片')
                    : videoGenMode === 'video_edit'
                      ? '编辑素材'
                      : '参考素材'}
                </h3>
                <span className="text-xs text-zinc-500">拖拽调序</span>
              </div>

              <div className="flex gap-2 mb-3">
                {(videoGenMode === 'image_to_video' || videoGenMode === 'reference' || videoGenMode === 'video_edit') && (
                  <button
                    onClick={() => onOpenAssetPicker('image')}
                    disabled={!noStorageVideoMediaAllowed}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs transition-all ${
                      noStorageVideoMediaAllowed
                        ? 'border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:border-blue-500/50 hover:text-blue-400'
                        : 'cursor-not-allowed border-zinc-800 bg-zinc-900/30 text-zinc-600'
                    }`}
                  >
                    {videoGenMode === 'video_edit'
                      ? '🖼️ 添加参考图'
                      : videoGenMode === 'image_to_video' && imageGenSubMode === 'first_clip'
                        ? '🖼️ 添加尾帧'
                        : '🖼️ 添加图片'}
                  </button>
                )}
                {canAddVideoReference && (videoGenMode === 'reference' || videoGenMode === 'video_edit' || (videoGenMode === 'image_to_video' && imageGenSubMode === 'first_clip')) && (
                  <button
                    onClick={() => onOpenAssetPicker('video')}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/50 px-2 py-2 text-xs text-zinc-400 transition-all hover:border-green-500/50 hover:text-green-400"
                  >
                    {videoGenMode === 'video_edit'
                      ? '🎬 选择待编辑视频'
                      : videoGenMode === 'image_to_video' && imageGenSubMode === 'first_clip'
                        ? '🎬 添加首段视频'
                        : '🎬 添加视频'}
                  </button>
                )}
                {canAddAudioReference && videoGenMode === 'reference' && (
                  <button
                    onClick={() => onOpenAssetPicker('audio')}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/50 px-2 py-2 text-xs text-zinc-400 transition-all hover:border-pink-500/50 hover:text-pink-400"
                  >
                    🎵 添加音频
                  </button>
                )}
              </div>
              {!hasObjectStorage && modelRequiresObjectStorageForVideoMedia(selectedModelConfig.id) ? (
                <p className="mb-3 text-xs text-amber-300">
                  当前模型的媒体输入需要公网 URL，未配置对象存储时不可用。
                </p>
              ) : !hasObjectStorage ? (
                <p className="mb-3 text-xs text-zinc-500">
                  未配置对象存储时，只能添加本地图片作为临时参考；视频和音频入口已禁用。
                </p>
              ) : null}

              {(referenceImages.length > 0 || referenceVideos.length > 0 || referenceAudios.length > 0) ? (
                <div className="flex flex-wrap gap-2">
                  {referenceImages.map((img, idx) => (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={() => onDragStart('image', idx)}
                      onDragOver={(event) => onDragOver(event, 'image', idx)}
                      onDragEnd={onDragEnd}
                      className="relative group cursor-move"
                      title={img.name}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-blue-500/30 bg-zinc-900">
                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -top-1 -left-1 min-w-4 h-4 px-1 bg-blue-600 rounded-full flex items-center justify-center text-[9px] text-white">
                        {getImageReferenceBadgeLabel(idx)}
                      </div>
                      <button onClick={() => onRemoveReference('image', img.id)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-[10px] text-white opacity-0 group-hover:opacity-100">×</button>
                    </div>
                  ))}
                  {canAddVideoReference && (videoGenMode === 'reference' || videoGenMode === 'video_edit' || (videoGenMode === 'image_to_video' && imageGenSubMode === 'first_clip')) && referenceVideos.map((vid, idx) => (
                    <div
                      key={vid.id}
                      draggable
                      onDragStart={() => onDragStart('video', idx)}
                      onDragOver={(event) => onDragOver(event, 'video', idx)}
                      onDragEnd={onDragEnd}
                      className="relative group cursor-move"
                      title={vid.name}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-green-500/30 bg-zinc-900">
                        <video src={vid.url} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -top-1 -left-1 min-w-4 h-4 px-1 bg-green-600 rounded-full flex items-center justify-center text-[9px] text-white">
                        {getVideoReferenceBadgeLabel(idx)}
                      </div>
                      <button onClick={() => onRemoveReference('video', vid.id)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-[10px] text-white opacity-0 group-hover:opacity-100">×</button>
                    </div>
                  ))}
                  {canAddAudioReference && videoGenMode === 'reference' && referenceAudios.map((aud, idx) => (
                    <div
                      key={aud.id}
                      draggable
                      onDragStart={() => onDragStart('audio', idx)}
                      onDragOver={(event) => onDragOver(event, 'audio', idx)}
                      onDragEnd={onDragEnd}
                      className="relative group cursor-move"
                      title={aud.name}
                    >
                      <div className="w-12 h-12 rounded-lg border-2 border-pink-500/30 bg-zinc-900 flex items-center justify-center">
                        <span>🎵</span>
                      </div>
                      <div className="absolute -top-1 -left-1 w-4 h-4 bg-pink-600 rounded-full flex items-center justify-center text-[10px] text-white">{idx + 1}</div>
                      <button onClick={() => onRemoveReference('audio', aud.id)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-[10px] text-white opacity-0 group-hover:opacity-100">×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-zinc-500 text-xs py-4">
                  {videoGenMode === 'image_to_video'
                    ? (imageGenSubMode === 'first_frame'
                      ? '请上传1张图片作为首帧'
                      : imageGenSubMode === 'first_last_frame'
                        ? '请上传2张图片作为首尾帧'
                        : '请上传1段视频作为首段，可选1张图片作为尾帧')
                    : videoGenMode === 'video_edit'
                      ? `请先选择 1 条待编辑视频，可选最多 ${videoEditMaxReferenceImages} 张参考图`
                      : '点击上方按钮添加素材'}
                </p>
              )}
            </div>
          )}

          <div className="glass rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-medium text-zinc-100 text-sm">提示词</h3>
              <span className="text-xs text-blue-400">@ 引用素材</span>
            </div>
            <PromptEditor
              key={editorKey}
              assets={[
                ...referenceImages.map((asset, index) => ({ ...asset, subjectName: `图片${index + 1}` })),
                ...referenceVideos.map((asset, index) => ({ ...asset, subjectName: `视频${index + 1}` })),
                ...referenceAudios.map((asset, index) => ({ ...asset, subjectName: `音频${index + 1}` })),
              ] as PromptAsset[]}
              onChange={onEditorChange}
              initialValue={editorValue}
              placeholder="描述视频内容，使用 @ 引用素材..."
            />
          </div>

          <div className="glass rounded-xl p-4 border border-zinc-800">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-medium text-zinc-100 text-sm">参数设置</h3>
              <button
                type="button"
                onClick={activeTab === 'ai-video' ? onClearVideoConfig : onClearImageConfig}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-red-400/50 hover:text-red-300"
              >
                清空当前页
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">分辨率</label>
                <DashboardSelect
                  value={resolution}
                  onChange={onResolutionChange}
                  options={selectedModelConfig.supportedResolutions.map((item) => ({ value: item, label: item }))}
                />
              </div>
              {!hidesRatioControl ? (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">比例</label>
                  <DashboardSelect
                    value={ratio}
                    onChange={onRatioChange}
                    options={selectedModelConfig.supportedRatios.map((item) => ({
                      value: item,
                      label: item === 'adaptive' ? '智能比例' : item,
                    }))}
                  />
                </div>
              ) : null}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">秒数</label>
                <DashboardSelect
                  value={String(duration)}
                  onChange={(nextValue) => onDurationChange(parseInt(nextValue, 10))}
                  options={supportedVideoDurations.map((seconds) => ({
                    value: String(seconds),
                    label: seconds === -1 ? '智能时长' : seconds === 0 ? '原时长' : `${seconds}秒`,
                  }))}
                />
                {selectedModelConfig.providerId === 'volcengine' && duration === -1 ? (
                  <p className="mt-1 text-[11px] text-zinc-600">由 Seedance 在有效范围内自动选择输出时长</p>
                ) : null}
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">数量</label>
                <DashboardSelect
                  value={String(videoCount)}
                  onChange={(nextValue) => onVideoCountChange(parseInt(nextValue, 10))}
                  disabled={isVideoEditMode}
                  options={(isVideoEditMode ? [1] : [1, 2, 3, 4]).map((count) => ({
                    value: String(count),
                    label: `${count}个`,
                  }))}
                />
                {isVideoEditMode ? (
                  <p className="mt-1 text-[11px] text-zinc-600">视频编辑接口固定返回 1 条结果</p>
                ) : null}
              </div>
              {isWan27FamilyModel ? (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Prompt 扩写</label>
                  <label className="flex h-[42px] items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 text-sm text-zinc-100">
                    <input
                      type="checkbox"
                      checked={videoPromptExtend}
                      onChange={(e) => onVideoPromptExtendChange(e.target.checked)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    <span>开启智能改写</span>
                  </label>
                </div>
              ) : null}
              {isWan27FamilyModel || isHappyHorseFamilyModel || selectedModelConfig.providerId === 'volcengine' ? (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Seed</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={videoSeed}
                    onChange={(e) => onVideoSeedChange(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="留空则随机"
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-zinc-100 text-sm"
                  />
                  <p className="mt-1 text-[11px] text-zinc-600">支持 0 - 4294967295，留空表示随机（等同 -1）</p>
                </div>
              ) : null}
              {selectedModelConfig.providerId === 'volcengine' ? (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">音频生成</label>
                  <label className="flex h-[42px] items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 text-sm text-zinc-100">
                    <input
                      type="checkbox"
                      checked={videoGenerateAudio}
                      onChange={(e) => onVideoGenerateAudioChange(e.target.checked)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    <span>{videoGenerateAudio ? '输出有声视频' : '输出无声视频'}</span>
                  </label>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-zinc-500">预计消耗</span>
              <div className="relative group">
                <span className="text-blue-400 font-medium cursor-help border-b border-dashed border-blue-400/50">
                  {tokenResult.usageLabel}
                </span>
                <span className="text-zinc-400 ml-2">≈ ¥{tokenResult.costYuan.toFixed(2)}</span>
                <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                  <div className="font-medium text-zinc-100 mb-1">计算公式</div>
                  <div className="text-zinc-400">
                    {(() => {
                      const dims = RESOLUTION_DIMENSIONS[resolution]?.[ratio]
                      if (isDurationPricing) {
                        if (videoGenMode === 'video_edit' && selectedModelConfig.providerId === 'aliyun') {
                          const outputLabel = duration === 0 ? `原时长(${inputVideoDuration.toFixed(1)}s)` : `${duration}s`
                          return `(${inputVideoDuration.toFixed(1)}s 输入 + ${outputLabel} 输出) × ${videoCount}`
                        }
                        return `输出时长 ${duration}s × 数量 ${videoCount}`
                      }
                      if (duration === -1) {
                        return `智能时长（按模型自动选择） × 数量 ${videoCount}`
                      }
                      if (!dims) {
                        if (ratio === 'adaptive') {
                          return `自适应宽高比 × ${resolution} × ${duration}s × 数量 ${videoCount}`
                        }
                        return '无法计算'
                      }
                      const hasVideo = inputVideoDuration > 0
                      if (hasVideo) {
                        return `(${dims.width}×${dims.height}×24fps×(${inputVideoDuration.toFixed(1)}s+${duration}s))/1024×${videoCount}`
                      }
                      return `(${dims.width}×${dims.height}×24fps×${duration}s)/1024×${videoCount}`
                    })()}
                  </div>
                  <div className="mt-1 pt-1 border-t border-zinc-700 text-zinc-500">
                    单价: {tokenResult.unitPriceLabel}
                  </div>
                  <div className="absolute -bottom-1 right-4 w-2 h-2 bg-zinc-800 border-r border-b border-zinc-700 transform rotate-45"></div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onGenerate}
            disabled={isGenerating || !prompt.trim() || !canSubmitVideo}
            className="sticky bottom-0 z-10 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 font-medium text-white transition-all hover:from-blue-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            开始生成
          </button>
        </div>
      )}

      {!imageGenerationDisabled && activeTab === 'ai-image' && (
        <div className="space-y-4 px-4 py-4 md:px-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pb-6">
          <div className={`grid gap-2 ${imageSupportsSequential ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            <button
              onClick={() => {
                onImageGenerationModeChange('single')
                onImageSequentialModeChange('disabled')
              }}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isSingleImageMode
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white'
                  : 'bg-zinc-900/50 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              单图
            </button>
            <button
              onClick={() => {
                if (!imageSupportsSequential) return
                onImageGenerationModeChange('group')
                onImageSequentialModeChange('auto')
              }}
              disabled={!imageSupportsSequential}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                imageGenerationMode === 'group'
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white'
                  : imageSupportsSequential
                    ? 'bg-zinc-900/50 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                    : 'bg-zinc-900/30 border border-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              组图
            </button>
          </div>

          <div className="glass rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <DashboardSelect
                  value={effectiveImageSelectedModel}
                  onChange={onImageSelectedModelChange}
                  options={[
                    ...(!selectedImageModelInPicker
                      ? [{ value: imageSelectedModel, label: selectedImageModelConfig.label, disabled: true }]
                      : []),
                    ...imageModelOptions.map((modelOption) => ({
                      value: modelOption.id,
                      label: modelOption.label,
                      description: modelOption.description,
                    })),
                  ]}
                />
                <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                  <span>{isSingleImageMode ? imageSingleVariantLabel : imageGroupVariantLabel}</span>
                  <span className="text-zinc-700">/</span>
                  <span>{isSingleImageMode ? '单图' : '组图'}</span>
                </div>
              </div>
            </div>
          </div>

          {imageCanUseReferences ? (
            <div className="glass rounded-xl p-4 border border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-zinc-100 text-sm">参考图片</h3>
                <span className="text-xs text-zinc-500">{`${imageReferenceCount}/${imageReferenceLimit}`}</span>
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => onOpenAssetPicker('image')}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/50 px-2 py-2 text-xs text-zinc-400 transition-all hover:border-emerald-500/50 hover:text-emerald-400"
                >
                  🖼️ 添加图片
                </button>
              </div>

              {imageReferenceImages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {imageReferenceImages.map((img, idx) => (
                    <div key={img.id} className="flex flex-col items-center gap-1.5">
                      <div
                        draggable
                        onDragStart={() => onDragStart('image', idx)}
                        onDragOver={(event) => onDragOver(event, 'image', idx)}
                        onDragEnd={onDragEnd}
                        className="relative group cursor-move"
                        title={img.name}
                      >
                        <div className="h-14 w-14 overflow-hidden rounded-xl border-2 border-emerald-500/30 bg-zinc-900">
                          <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">{idx + 1}</div>
                        <button
                          onClick={() => onRemoveReference('image', img.id)}
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                      {imageSupportsBboxEdit ? (
                        <button
                          type="button"
                          onClick={() => onOpenImageBboxEditor(img)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                            (imageReferenceBoxesByAssetId[img.id]?.length || 0) > 0
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {(imageReferenceBoxesByAssetId[img.id]?.length || 0) > 0 ? '已框选' : '框选'}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-zinc-500 text-xs py-4">
                  直接生成可留空，需要参考效果时再添加
                </p>
              )}
            </div>
          ) : !imageCanUseReferences ? (
            <div className="glass rounded-xl p-4 border border-zinc-800">
              <div className="text-sm text-zinc-300">当前模型只支持无参考输入，系统会按单图或组图自动提交</div>
            </div>
          ) : null}

          {imageGenerationMode === 'group' && imageSupportsSequential && (
            <div className="glass rounded-xl p-4 border border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-zinc-100 text-sm">组图设置</h3>
                <span className="text-xs text-zinc-500">
                  {imageGroupVariantLabel}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">输出方式</label>
                  <div className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-zinc-200 text-sm">
                    组图输出
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">最多输出</label>
                  <DashboardSelect
                    value={String(imageMaxImages)}
                    onChange={(nextValue) => onImageMaxImagesChange(parseInt(nextValue, 10))}
                    options={selectedImageModelConfig.sequentialImageCountOptions.map((count) => ({
                      value: String(count),
                      label: `${count} 张`,
                    }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="glass rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-medium text-zinc-100 text-sm">提示词</h3>
              {imageCanUseReferences && imageReferenceCount > 0 && (
                <span className="text-xs text-emerald-400">@ 引用图片</span>
              )}
            </div>
            <PromptEditor
              key={imageEditorKey}
              assets={imageCanUseReferences
                ? imageReferenceImages.map((asset, index) => ({ ...asset, subjectName: `图片${index + 1}` })) as PromptAsset[]
                : []}
              onChange={onImageEditorChange}
              initialValue={imageEditorValue}
              placeholder={
                isSingleImageMode
                  ? usesImageReferences
                    ? '描述想生成的图片，使用 @ 引用参考图...'
                    : '描述想生成的图片内容...'
                  : usesImageReferences
                    ? '描述这组图片的统一主题、镜头推进或连续情节，可使用 @ 引用参考图...'
                    : '描述这组图片的统一主题、镜头推进或连续情节...'
              }
            />
          </div>

          <div className="glass rounded-xl p-4 border border-zinc-800">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-medium text-zinc-100 text-sm">参数设置</h3>
              <button
                type="button"
                onClick={onClearImageConfig}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-red-400/50 hover:text-red-300"
              >
                清空当前页
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {usesWanImageSizeSystem ? (
                <>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">比例</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DEFAULT_RATIOS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => onImageRatioChange(preset)}
                          disabled={imageRatioLocked}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                            imageRatio === preset
                              ? 'bg-blue-600 text-white'
                              : imageRatioLocked
                                ? 'bg-zinc-900/40 text-zinc-600 cursor-not-allowed'
                                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => onImageRatioModeChange('custom')}
                        disabled={imageRatioLocked}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                          imageRatioMode === 'custom'
                            ? 'bg-blue-600 text-white'
                            : imageRatioLocked
                              ? 'bg-zinc-900/40 text-zinc-600 cursor-not-allowed'
                              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                        >
                          自定义
                        </button>
                      </div>
                    <div className="mt-2">
                      <input
                        ref={imageCustomRatioInputRef}
                        type="text"
                        value={imageCustomRatio}
                        onChange={(e) => onImageCustomRatioChange(e.target.value)}
                        onFocus={() => onImageRatioModeChange('custom')}
                        placeholder="输入比例，如 2.35:1 或 5:4"
                        disabled={imageRatioLocked || imageRatioMode !== 'custom'}
                        className={`w-full rounded-lg border px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 ${
                          imageCustomRatio && !isValidCustomRatio(imageCustomRatio)
                            ? 'border-red-500/50 bg-red-500/5'
                            : imageRatioMode === 'custom'
                              ? 'border-blue-500/40 bg-blue-500/5'
                              : 'border-zinc-700 bg-zinc-900/50'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      />
                      <div className="mt-1 flex items-center justify-between gap-2">
                        {imageCustomRatio && !isValidCustomRatio(imageCustomRatio) ? (
                          <p className="text-[11px] text-red-400">比例范围 1:8 ~ 8:1，格式如 2.35:1</p>
                        ) : (
                          <p className="text-[11px] text-zinc-600">
                            {imageRatioMode === 'custom' ? '正在编辑自定义比例' : '点击“自定义”后可编辑任意比例'}
                          </p>
                        )}
                        {imageRatioMode === 'custom' && (
                          <button
                            type="button"
                            onClick={() => onImageRatioModeChange('preset')}
                            disabled={imageRatioLocked}
                            className="text-[11px] text-zinc-400 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            恢复预设
                          </button>
                        )}
                      </div>
                    </div>
                    {imageRatioLocked && (
                      <p className="mt-1 text-[11px] text-zinc-600">已根据参考图自动锁定比例</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">尺寸档位</label>
                    <div className="flex gap-1.5">
                      {availableTiers.map((tier) => (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => onImageSizeTierChange(tier)}
                          className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                            imageSizeTier === tier
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {tier}
                        </button>
                      ))}
                    </div>
                    {availableTiers.length < 3 && (
                      <p className="mt-1 text-[11px] text-zinc-600">
                        {imageReferenceCount > 0 ? '参考图模式下最高 2K' : '当前场景最高 2K'}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">
                    {usesGrsaiImageRatioSystem ? '输出比例' : '输出尺寸'}
                  </label>
                  <DashboardSelect
                    value={imageSize}
                    onChange={onImageSizeChange}
                    options={selectedImageModelConfig.supportedSizes.map((item) => ({ value: item, label: item }))}
                  />
                  {usesGrsaiImageRatioSystem ? (
                    <p className="mt-1 text-[11px] text-zinc-600">Nano Banana 当前按 1K 提交，后续可扩展 2K/4K 参数。</p>
                  ) : null}
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">输出格式</label>
                <DashboardSelect
                  value={imageOutputFormat}
                  onChange={(nextValue) => onImageOutputFormatChange(nextValue as 'jpeg' | 'png')}
                  options={selectedImageModelConfig.supportedOutputFormats.map((format) => ({
                    value: format,
                    label: format.toUpperCase(),
                  }))}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">实际提交</label>
                <div className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-zinc-200 text-sm">
                  {isSingleImageMode ? imageSingleVariantLabel : imageGroupVariantLabel}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">输出形态</label>
                <div className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-zinc-200 text-sm">
                  {isSingleImageMode ? '单图' : '组图'}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                <div className="text-sm text-zinc-200">添加水印</div>
                <input type="checkbox" checked={imageWatermark} onChange={(e) => onImageWatermarkChange(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
              </label>

              {imageSupportsWebSearch && (
                <label className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                  <div className="text-sm text-zinc-200">联网搜索</div>
                  <input type="checkbox" checked={imageEnableWebSearch} onChange={(e) => onImageEnableWebSearchChange(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                </label>
              )}

              {imageSupportsPromptExtend && (
                <label className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                  <div>
                    <div className="text-sm text-zinc-200">Prompt 扩写</div>
                    <div className="text-[11px] text-zinc-500">
                      {selectedImageModelConfig.id === 'z-image-turbo'
                        ? '开启后价格更高，但提示词会自动优化'
                        : '开启后会优化提示词，通常更稳定'}
                    </div>
                  </div>
                  <input type="checkbox" checked={imagePromptExtend} onChange={(e) => onImagePromptExtendChange(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                </label>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-zinc-500">费用</span>
              <div className="text-right">
                <div className="text-zinc-300">
                  {imagePricingSummary || '按实际出图计费'}
                  <span className="ml-2 text-zinc-500">
                    {imagePlannedCount} 张
                  </span>
                </div>
                <div className="text-xs text-zinc-500">
                  预计约 ¥{imageEstimatedCostYuan.toFixed(2)}，以成功出图张数为准
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onGenerateImage}
            disabled={isImageGenerating || !imagePrompt.trim()}
            className="sticky bottom-0 z-10 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3 font-medium text-white transition-all hover:from-emerald-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            {isImageGenerating
              ? '生成中...'
              : isSingleImageMode
                ? '开始生成单图'
                : '开始生成组图'}
          </button>
        </div>
      )}
    </div>
  )
}
