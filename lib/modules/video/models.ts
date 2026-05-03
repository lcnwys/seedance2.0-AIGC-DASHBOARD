import type {
  ProviderGenerationMode,
  VideoGenerationProviderId,
} from '@/lib/modules/provider/types'

export const DEFAULT_VIDEO_MODEL = 'doubao-seedance-2-0-260128' as const
export const DEFAULT_VIDEO_MODEL_KEY = 'seedance-2.0' as const

export type VideoModelPricing =
  | {
      strategy: 'tokens'
      rates: {
        with_video: number
        without_video: number
      }
    }
  | {
      strategy: 'duration'
      ratesByResolution: Record<string, number>
      billableUnit: 'seconds'
    }

export type VideoModelProviderProtocol =
  | 'volcengine-seedance-v1'
  | 'aliyun-wan-27-video'

export interface VideoModelConfig {
  key: string
  id: string
  providerId: VideoGenerationProviderId
  providerModelId: string
  providerProtocol: VideoModelProviderProtocol
  label: string
  description: string
  supportedModes: ProviderGenerationMode[]
  defaultMode: ProviderGenerationMode
  supportedResolutions: string[]
  defaultResolution: string
  supportedRatios: string[]
  defaultRatio: string
  supportedDurations: number[]
  defaultDuration: number
  pricing: VideoModelPricing
}

export interface VideoReferenceLimits {
  maxImages: number | null
  maxVideos: number | null
  maxAudios: number | null
  maxTotalVisual?: number
}

const SHARED_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as const
const HAPPYHORSE_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const
const WAN_27_VIDEO_MODEL_IDS = ['wan2.7-t2v', 'wan2.7-i2v', 'wan2.7-r2v', 'wan2.7-videoedit'] as const
export const HAPPYHORSE_T2V_MODEL_ID = 'happyhorse-1.0-t2v' as const
export const HAPPYHORSE_I2V_MODEL_ID = 'happyhorse-1.0-i2v' as const
export const HAPPYHORSE_R2V_MODEL_ID = 'happyhorse-1.0-r2v' as const
export const HAPPYHORSE_VIDEO_EDIT_MODEL_ID = 'happyhorse-1.0-video-edit' as const
export const HAPPYHORSE_VIDEO_MODEL_ID = HAPPYHORSE_R2V_MODEL_ID
const HAPPYHORSE_VIDEO_MODEL_IDS = [
  HAPPYHORSE_T2V_MODEL_ID,
  HAPPYHORSE_I2V_MODEL_ID,
  HAPPYHORSE_R2V_MODEL_ID,
  HAPPYHORSE_VIDEO_EDIT_MODEL_ID,
] as const
const WAN_REFERENCE_VIDEO_DURATIONS = Array.from({ length: 9 }, (_, index) => index + 2)
const WAN_NON_VIDEO_REFERENCE_DURATIONS = Array.from({ length: 14 }, (_, index) => index + 2)
const WAN_VIDEO_EDIT_DURATIONS = [0, ...WAN_REFERENCE_VIDEO_DURATIONS]
const HAPPYHORSE_DURATIONS = Array.from({ length: 13 }, (_, index) => index + 3)
const HAPPYHORSE_VIDEO_EDIT_DURATIONS = [0]
const HAPPYHORSE_PRICING: VideoModelPricing = {
  strategy: 'duration',
  billableUnit: 'seconds',
  ratesByResolution: {
    '720p': 0.9,
    '1080p': 1.6,
  },
}

export const VIDEO_MODEL_OPTIONS: VideoModelConfig[] = [
  {
    key: 'seedance-2.0',
    id: 'doubao-seedance-2-0-260128',
    providerId: 'volcengine',
    providerModelId: 'doubao-seedance-2-0-260128',
    providerProtocol: 'volcengine-seedance-v1',
    label: 'Seedance 2.0',
    description: '高质量视频生成，适合优先追求成片质量的场景',
    supportedModes: ['text_to_video', 'first_frame', 'first_last_frame', 'reference'],
    defaultMode: 'reference',
    supportedResolutions: ['480p', '720p', '1080p'],
    defaultResolution: '720p',
    supportedRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
    defaultRatio: 'adaptive',
    supportedDurations: [-1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaultDuration: 5,
    pricing: {
      strategy: 'tokens',
      rates: {
        with_video: 28,
        without_video: 46,
      },
    },
  },
  {
    key: 'seedance-2.0-fast',
    id: 'doubao-seedance-2-0-fast-260128',
    providerId: 'volcengine',
    providerModelId: 'doubao-seedance-2-0-fast-260128',
    providerProtocol: 'volcengine-seedance-v1',
    label: 'Seedance 2.0 Fast',
    description: '生成更快，价格更低，适合高频出片与快速试稿',
    supportedModes: ['text_to_video', 'first_frame', 'first_last_frame', 'reference'],
    defaultMode: 'reference',
    supportedResolutions: ['480p', '720p', '1080p'],
    defaultResolution: '720p',
    supportedRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
    defaultRatio: 'adaptive',
    supportedDurations: [-1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaultDuration: 5,
    pricing: {
      strategy: 'tokens',
      rates: {
        with_video: 22,
        without_video: 37,
      },
    },
  },
  {
    key: 'wan-2.7-t2v',
    id: 'wan2.7-t2v',
    providerId: 'aliyun',
    providerModelId: 'wan2.7-t2v',
    providerProtocol: 'aliyun-wan-27-video',
    label: '万相 Wan 2.7 文生视频',
    description: '阿里云万相文生视频模型，基于文本提示词生成视频',
    supportedModes: ['text_to_video'],
    defaultMode: 'text_to_video',
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportedRatios: [...SHARED_RATIOS],
    defaultRatio: '16:9',
    supportedDurations: [...WAN_NON_VIDEO_REFERENCE_DURATIONS],
    defaultDuration: 5,
    pricing: {
      strategy: 'duration',
      billableUnit: 'seconds',
      ratesByResolution: {
        '720p': 0.6,
        '1080p': 1.0,
      },
    },
  },
  {
    key: 'wan-2.7-i2v',
    id: 'wan2.7-i2v',
    providerId: 'aliyun',
    providerModelId: 'wan2.7-i2v',
    providerProtocol: 'aliyun-wan-27-video',
    label: '万相 Wan 2.7 图生视频',
    description: '阿里云万相图生视频模型，支持首帧、首尾帧和 first_clip 视频续写',
    supportedModes: ['first_frame', 'first_last_frame', 'first_clip'],
    defaultMode: 'first_frame',
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportedRatios: [...SHARED_RATIOS],
    defaultRatio: '16:9',
    supportedDurations: [...WAN_NON_VIDEO_REFERENCE_DURATIONS],
    defaultDuration: 5,
    pricing: {
      strategy: 'duration',
      billableUnit: 'seconds',
      ratesByResolution: {
        '720p': 0.6,
        '1080p': 1.0,
      },
    },
  },
  {
    key: 'wan-2.7-r2v',
    id: 'wan2.7-r2v',
    providerId: 'aliyun',
    providerModelId: 'wan2.7-r2v',
    providerProtocol: 'aliyun-wan-27-video',
    label: '万相 Wan 2.7',
    description: '阿里云万相参考生视频模型，支持图片/视频多主体参考，当前接入轮询结果获取',
    supportedModes: ['first_frame', 'reference'],
    defaultMode: 'reference',
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportedRatios: [...SHARED_RATIOS],
    defaultRatio: '16:9',
    supportedDurations: [...WAN_NON_VIDEO_REFERENCE_DURATIONS],
    defaultDuration: 5,
    pricing: {
      strategy: 'duration',
      billableUnit: 'seconds',
      // 当前按阿里云中国站万相视频秒级计费口径估算。
      ratesByResolution: {
        '720p': 0.6,
        '1080p': 1.0,
      },
    },
  },
  {
    key: 'wan-2.7-videoedit',
    id: 'wan2.7-videoedit',
    providerId: 'aliyun',
    providerModelId: 'wan2.7-videoedit',
    providerProtocol: 'aliyun-wan-27-video',
    label: '万相 Wan 2.7 视频编辑',
    description: '阿里云万相视频编辑模型，支持对单条视频做指令编辑，并可附加参考图片',
    supportedModes: ['video_edit'],
    defaultMode: 'video_edit',
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
    supportedRatios: [...SHARED_RATIOS],
    defaultRatio: '16:9',
    supportedDurations: [...WAN_VIDEO_EDIT_DURATIONS],
    defaultDuration: 0,
    pricing: {
      strategy: 'duration',
      billableUnit: 'seconds',
      ratesByResolution: {
        '720p': 0.6,
        '1080p': 1.0,
      },
    },
  },
  {
    key: 'happyhorse-t2v',
    id: HAPPYHORSE_T2V_MODEL_ID,
    providerId: 'aliyun',
    providerModelId: HAPPYHORSE_T2V_MODEL_ID,
    providerProtocol: 'aliyun-wan-27-video',
    label: 'HappyHorse',
    description: '阿里云 HappyHorse 文生视频模型，基于文本提示词生成视频',
    supportedModes: ['text_to_video'],
    defaultMode: 'text_to_video',
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportedRatios: [...HAPPYHORSE_RATIOS],
    defaultRatio: '16:9',
    supportedDurations: [...HAPPYHORSE_DURATIONS],
    defaultDuration: 5,
    pricing: HAPPYHORSE_PRICING,
  },
  {
    key: 'happyhorse-i2v',
    id: HAPPYHORSE_I2V_MODEL_ID,
    providerId: 'aliyun',
    providerModelId: HAPPYHORSE_I2V_MODEL_ID,
    providerProtocol: 'aliyun-wan-27-video',
    label: 'HappyHorse',
    description: '阿里云 HappyHorse 图生视频模型，基于 1 张首帧图片生成视频',
    supportedModes: ['first_frame'],
    defaultMode: 'first_frame',
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportedRatios: [...HAPPYHORSE_RATIOS],
    defaultRatio: '16:9',
    supportedDurations: [...HAPPYHORSE_DURATIONS],
    defaultDuration: 5,
    pricing: HAPPYHORSE_PRICING,
  },
  {
    key: 'happyhorse-r2v',
    id: HAPPYHORSE_R2V_MODEL_ID,
    providerId: 'aliyun',
    providerModelId: HAPPYHORSE_R2V_MODEL_ID,
    providerProtocol: 'aliyun-wan-27-video',
    label: 'HappyHorse',
    description: '阿里云 HappyHorse 参考生视频模型，支持 1-9 张参考图融合生成视频',
    supportedModes: ['reference'],
    defaultMode: 'reference',
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportedRatios: [...HAPPYHORSE_RATIOS],
    defaultRatio: '16:9',
    supportedDurations: [...HAPPYHORSE_DURATIONS],
    defaultDuration: 5,
    pricing: HAPPYHORSE_PRICING,
  },
  {
    key: 'happyhorse-video-edit',
    id: HAPPYHORSE_VIDEO_EDIT_MODEL_ID,
    providerId: 'aliyun',
    providerModelId: HAPPYHORSE_VIDEO_EDIT_MODEL_ID,
    providerProtocol: 'aliyun-wan-27-video',
    label: 'HappyHorse',
    description: '阿里云 HappyHorse 视频编辑模型，支持 1 条视频和最多 5 张参考图做指令编辑',
    supportedModes: ['video_edit'],
    defaultMode: 'video_edit',
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
    supportedRatios: [...HAPPYHORSE_RATIOS],
    defaultRatio: '16:9',
    supportedDurations: [...HAPPYHORSE_VIDEO_EDIT_DURATIONS],
    defaultDuration: 0,
    pricing: HAPPYHORSE_PRICING,
  },
]

const VIDEO_MODEL_CONFIGS_BY_ID = Object.fromEntries(
  VIDEO_MODEL_OPTIONS.map((config) => [config.id, config])
) as Record<string, VideoModelConfig>

const VIDEO_MODEL_CONFIGS_BY_KEY = Object.fromEntries(
  VIDEO_MODEL_OPTIONS.map((config) => [config.key, config])
) as Record<string, VideoModelConfig>

function normalizeLookupInput(input: string | null | undefined) {
  return typeof input === 'string' ? input.trim() : ''
}

export function isSupportedVideoModel(input: string | null | undefined): boolean {
  const value = normalizeLookupInput(input)
  return Boolean(value && VIDEO_MODEL_CONFIGS_BY_ID[value])
}

export function isSupportedVideoModelKey(input: string | null | undefined): boolean {
  const value = normalizeLookupInput(input)
  return Boolean(value && VIDEO_MODEL_CONFIGS_BY_KEY[value])
}

export function getVideoModelConfig(input?: string | null): VideoModelConfig {
  const value = normalizeLookupInput(input)
  return VIDEO_MODEL_CONFIGS_BY_ID[value]
    || VIDEO_MODEL_CONFIGS_BY_KEY[value]
    || VIDEO_MODEL_CONFIGS_BY_ID[DEFAULT_VIDEO_MODEL]
}

export function normalizeVideoModel(input?: string | null): string {
  return getVideoModelConfig(input).id
}

export function getVideoModelKey(input?: string | null): string {
  return getVideoModelConfig(input).key
}

export function getVideoModelProviderProtocol(input?: string | null): VideoModelProviderProtocol {
  return getVideoModelConfig(input).providerProtocol
}

export function getVideoModelProviderId(input?: string | null): VideoGenerationProviderId {
  return getVideoModelConfig(input).providerId
}

export function isWan27VideoModel(input?: string | null): boolean {
  const modelId = getVideoModelConfig(input).id
  return WAN_27_VIDEO_MODEL_IDS.includes(modelId as (typeof WAN_27_VIDEO_MODEL_IDS)[number])
}

export function isHappyHorseVideoModel(input?: string | null): boolean {
  const modelId = getVideoModelConfig(input).id
  return HAPPYHORSE_VIDEO_MODEL_IDS.includes(modelId as (typeof HAPPYHORSE_VIDEO_MODEL_IDS)[number])
}

export function getVideoReferenceLimits(
  model: string | null | undefined,
  mode: ProviderGenerationMode,
): VideoReferenceLimits {
  const modelConfig = getVideoModelConfig(model)

  if (modelConfig.id === HAPPYHORSE_T2V_MODEL_ID) {
    return {
      maxImages: 0,
      maxVideos: 0,
      maxAudios: 0,
    }
  }

  if (modelConfig.id === HAPPYHORSE_I2V_MODEL_ID) {
    return {
      maxImages: 1,
      maxVideos: 0,
      maxAudios: 0,
    }
  }

  if (modelConfig.id === HAPPYHORSE_R2V_MODEL_ID) {
    return {
      maxImages: 9,
      maxVideos: 0,
      maxAudios: 0,
    }
  }

  if (modelConfig.id === HAPPYHORSE_VIDEO_EDIT_MODEL_ID) {
    return {
      maxImages: 5,
      maxVideos: 1,
      maxAudios: 0,
    }
  }

  if (mode === 'video_edit') {
    return {
      maxImages: 4,
      maxVideos: 1,
      maxAudios: 0,
    }
  }

  if (mode === 'first_frame') {
    return {
      maxImages: 1,
      maxVideos: 0,
      maxAudios: 0,
    }
  }

  if (mode === 'first_last_frame') {
    return {
      maxImages: 2,
      maxVideos: 0,
      maxAudios: 0,
    }
  }

  if (mode === 'first_clip') {
    return {
      maxImages: 1,
      maxVideos: 1,
      maxAudios: 0,
    }
  }

  if (modelConfig.providerId === 'aliyun' && mode === 'reference') {
    return {
      maxImages: 5,
      maxVideos: 5,
      maxAudios: 0,
      maxTotalVisual: 5,
    }
  }

  return {
    maxImages: null,
    maxVideos: null,
    maxAudios: null,
  }
}

export function supportsVideoModelMode(
  model: string | null | undefined,
  mode: ProviderGenerationMode
): boolean {
  return getVideoModelConfig(model).supportedModes.includes(mode)
}

export function normalizeVideoResolution(model: string | null | undefined, resolution: string | null | undefined) {
  const config = getVideoModelConfig(model)
  const normalized = typeof resolution === 'string' ? resolution.trim().toLowerCase() : ''
  return config.supportedResolutions.includes(normalized)
    ? normalized
    : config.defaultResolution
}

export function normalizeVideoRatio(model: string | null | undefined, ratio: string | null | undefined) {
  const config = getVideoModelConfig(model)
  const normalized = typeof ratio === 'string' ? ratio.trim() : ''
  return config.supportedRatios.includes(normalized)
    ? normalized
    : config.defaultRatio
}

export function getSupportedVideoDurations(
  model: string | null | undefined,
  options?: {
    hasReferenceVideo?: boolean | null
  },
) {
  const config = getVideoModelConfig(model)

  if (config.id === 'wan2.7-r2v') {
    return options?.hasReferenceVideo
      ? WAN_REFERENCE_VIDEO_DURATIONS
      : WAN_NON_VIDEO_REFERENCE_DURATIONS
  }

  if (config.id === 'wan2.7-videoedit') {
    return WAN_VIDEO_EDIT_DURATIONS
  }

  return config.supportedDurations
}

export function normalizeVideoDuration(
  model: string | null | undefined,
  duration: number | null | undefined,
  options?: {
    hasReferenceVideo?: boolean | null
  },
) {
  const config = getVideoModelConfig(model)
  const supportedDurations = getSupportedVideoDurations(model, options)

  if (typeof duration === 'number' && supportedDurations.includes(duration)) {
    return duration
  }

  return supportedDurations.includes(config.defaultDuration)
    ? config.defaultDuration
    : supportedDurations[0] || config.defaultDuration
}

export function getVideoModelPricingSummary(
  model: string | null | undefined,
  resolution?: string | null
): string {
  const config = getVideoModelConfig(model)

  if (config.pricing.strategy === 'tokens') {
    return `含视频 ¥${config.pricing.rates.with_video}/百万tokens，不含视频 ¥${config.pricing.rates.without_video}/百万tokens`
  }

  const normalizedResolution = normalizeVideoResolution(config.id, resolution || config.defaultResolution)
  const rate = config.pricing.ratesByResolution[normalizedResolution]
  return `${normalizedResolution.toUpperCase()} ¥${rate.toFixed(2)}/秒`
}

export function getDurationModelRateYuan(
  model: string | null | undefined,
  resolution?: string | null
): number | null {
  const config = getVideoModelConfig(model)
  if (config.pricing.strategy !== 'duration') {
    return null
  }

  const normalizedResolution = normalizeVideoResolution(config.id, resolution || config.defaultResolution)
  return config.pricing.ratesByResolution[normalizedResolution] ?? null
}
