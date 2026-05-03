import type { ImageGenerationMode, ImageGenerationProviderId } from '@/lib/modules/image/types'
import { isWan27ImageModel, parseImageSize } from '@/lib/modules/image/size-config'

export const DEFAULT_IMAGE_MODEL = 'doubao-seedream-5-0-260128' as const
export const DEFAULT_IMAGE_MODEL_KEY = 'seedream-5-0-260128' as const

export interface ImageModelPricing {
  strategy: 'per_image'
  rateYuan: number
  promptExtendRateYuan?: number
}

export type ImageModelProviderProtocol =
  | 'volcengine-images-v1'
  | 'aliyun-wan-27'
  | 'aliyun-dashscope-image'
  | 'grsai-gpt-image'
  | 'grsai-nano-banana'

export interface ImageModelConfig {
  key: string
  id: string
  providerId: ImageGenerationProviderId
  providerModelId: string
  providerProtocol: ImageModelProviderProtocol
  label: string
  description: string
  supportedModes: ImageGenerationMode[]
  defaultMode: ImageGenerationMode
  supportedSizes: string[]
  defaultSize: string
  supportedOutputFormats: Array<'jpeg' | 'png'>
  defaultOutputFormat: 'jpeg' | 'png'
  supportsSequential: boolean
  supportsWebSearch: boolean
  supportsBboxEdit: boolean
  supportsPromptExtend: boolean
  defaultPromptExtend: boolean
  maxReferenceImages: number
  maxSequentialImages: number
  sequentialImageCountOptions: number[]
  pricing?: ImageModelPricing
}

const RECOMMENDED_IMAGE_SIZES = [
  '2K',
  '3K',
  '2048x2048',
  '2304x1728',
  '1728x2304',
  '2848x1600',
  '1600x2848',
  '2496x1664',
  '1664x2496',
  '3136x1344',
] as const

const DASHSCOPE_IMAGE_SIZES = [
  '1024*1024',
  '1280*1280',
  '1536*1536',
  '768*1152',
  '1024*1536',
  '1248*1872',
  '1152*768',
  '1536*1024',
  '1872*1248',
  '960*1280',
  '1080*1440',
  '1296*1728',
  '1280*960',
  '1440*1080',
  '1728*1296',
  '720*1280',
  '864*1536',
  '1152*2048',
  '1280*720',
  '1536*864',
  '2048*1152',
  '1344*576',
  '1680*720',
  '2016*864',
  '576*1344',
  '720*1680',
  '864*2016',
] as const

const GRSAI_GPT_IMAGE_RATIOS = [
  'auto',
  '1:1',
  '3:2',
  '2:3',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '21:9',
  '9:21',
  '1:3',
  '3:1',
  '2:1',
  '1:2',
] as const

const GRSAI_NANO_BANANA_RATIOS = [
  'auto',
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '5:4',
  '4:5',
  '21:9',
] as const

const GRSAI_NANO_BANANA_2_RATIOS = [
  ...GRSAI_NANO_BANANA_RATIOS,
  '1:4',
  '4:1',
  '1:8',
  '8:1',
] as const

export const IMAGE_MODEL_OPTIONS: ImageModelConfig[] = [
  {
    key: 'seedream-5-0-260128',
    id: 'doubao-seedream-5-0-260128',
    providerId: 'volcengine',
    providerModelId: 'doubao-seedream-5-0-260128',
    providerProtocol: 'volcengine-images-v1',
    label: 'Seedream 5.0',
    description: '火山图片生成模型，支持文生图、多图参考、组图输出与联网搜索',
    supportedModes: ['text_to_image', 'image_to_image'],
    defaultMode: 'text_to_image',
    supportedSizes: [...RECOMMENDED_IMAGE_SIZES],
    defaultSize: '2K',
    supportedOutputFormats: ['jpeg', 'png'],
    defaultOutputFormat: 'jpeg',
    supportsSequential: true,
    supportsWebSearch: true,
    supportsBboxEdit: false,
    supportsPromptExtend: false,
    defaultPromptExtend: false,
    maxReferenceImages: 14,
    maxSequentialImages: 15,
    sequentialImageCountOptions: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15],
    pricing: {
      strategy: 'per_image',
      rateYuan: 0.22,
    },
  },
  {
    key: 'wan-2.7-image',
    id: 'wan2.7-image',
    providerId: 'aliyun',
    providerModelId: 'wan2.7-image',
    providerProtocol: 'aliyun-wan-27',
    label: '万相 Wan 2.7 Image',
    description: '阿里云万相 2.7 图片模型，支持文生图、参考生图与组图生成',
    supportedModes: ['text_to_image', 'image_to_image'],
    defaultMode: 'text_to_image',
    supportedSizes: ['1K', '2K'],
    defaultSize: '2K',
    supportedOutputFormats: ['png'],
    defaultOutputFormat: 'png',
    supportsSequential: true,
    supportsWebSearch: false,
    supportsBboxEdit: true,
    supportsPromptExtend: false,
    defaultPromptExtend: false,
    maxReferenceImages: 9,
    maxSequentialImages: 12,
    sequentialImageCountOptions: [1, 2, 3, 4, 5, 6, 8, 10, 12],
    pricing: {
      strategy: 'per_image',
      rateYuan: 0.2,
    },
  },
  {
    key: 'wan-2.7-image-pro',
    id: 'wan2.7-image-pro',
    providerId: 'aliyun',
    providerModelId: 'wan2.7-image-pro',
    providerProtocol: 'aliyun-wan-27',
    label: '万相 Wan 2.7 Image Pro',
    description: '阿里云万相 2.7 图片专业版，支持 4K 文生图、参考生图与组图生成',
    supportedModes: ['text_to_image', 'image_to_image'],
    defaultMode: 'text_to_image',
    supportedSizes: ['1K', '2K', '4K'],
    defaultSize: '2K',
    supportedOutputFormats: ['png'],
    defaultOutputFormat: 'png',
    supportsSequential: true,
    supportsWebSearch: false,
    supportsBboxEdit: true,
    supportsPromptExtend: false,
    defaultPromptExtend: false,
    maxReferenceImages: 9,
    maxSequentialImages: 12,
    sequentialImageCountOptions: [1, 2, 3, 4, 5, 6, 8, 10, 12],
    pricing: {
      strategy: 'per_image',
      rateYuan: 0.5,
    },
  },
  {
    key: 'grsai-gpt-image-2',
    id: 'gpt-image-2',
    providerId: 'grsai',
    providerModelId: 'gpt-image-2',
    providerProtocol: 'grsai-gpt-image',
    label: 'GRSAI GPT Image 2',
    description: 'GRSAI GPT Image API，支持文生图和多张参考图生成',
    supportedModes: ['text_to_image', 'image_to_image'],
    defaultMode: 'text_to_image',
    supportedSizes: [...GRSAI_GPT_IMAGE_RATIOS],
    defaultSize: '1:1',
    supportedOutputFormats: ['png', 'jpeg'],
    defaultOutputFormat: 'png',
    supportsSequential: false,
    supportsWebSearch: false,
    supportsBboxEdit: false,
    supportsPromptExtend: false,
    defaultPromptExtend: false,
    maxReferenceImages: 10,
    maxSequentialImages: 1,
    sequentialImageCountOptions: [1],
    pricing: {
      strategy: 'per_image',
      rateYuan: 0.06,
    },
  },
  {
    key: 'grsai-nano-banana-pro',
    id: 'nano-banana-pro',
    providerId: 'grsai',
    providerModelId: 'nano-banana-pro',
    providerProtocol: 'grsai-nano-banana',
    label: 'GRSAI Nano Banana Pro',
    description: 'GRSAI Nano Banana Pro 绘画模型，支持文生图和参考图生成',
    supportedModes: ['text_to_image', 'image_to_image'],
    defaultMode: 'text_to_image',
    supportedSizes: [...GRSAI_NANO_BANANA_RATIOS],
    defaultSize: 'auto',
    supportedOutputFormats: ['png', 'jpeg'],
    defaultOutputFormat: 'png',
    supportsSequential: false,
    supportsWebSearch: false,
    supportsBboxEdit: false,
    supportsPromptExtend: false,
    defaultPromptExtend: false,
    maxReferenceImages: 10,
    maxSequentialImages: 1,
    sequentialImageCountOptions: [1],
    pricing: {
      strategy: 'per_image',
      rateYuan: 0.18,
    },
  },
  {
    key: 'grsai-nano-banana-2',
    id: 'nano-banana-2',
    providerId: 'grsai',
    providerModelId: 'nano-banana-2',
    providerProtocol: 'grsai-nano-banana',
    label: 'GRSAI Nano Banana 2',
    description: 'GRSAI Nano Banana 2 绘画模型，支持文生图、参考图和超宽/超长比例',
    supportedModes: ['text_to_image', 'image_to_image'],
    defaultMode: 'text_to_image',
    supportedSizes: [...GRSAI_NANO_BANANA_2_RATIOS],
    defaultSize: 'auto',
    supportedOutputFormats: ['png', 'jpeg'],
    defaultOutputFormat: 'png',
    supportsSequential: false,
    supportsWebSearch: false,
    supportsBboxEdit: false,
    supportsPromptExtend: false,
    defaultPromptExtend: false,
    maxReferenceImages: 10,
    maxSequentialImages: 1,
    sequentialImageCountOptions: [1],
    pricing: {
      strategy: 'per_image',
      rateYuan: 0.12,
    },
  },
  {
    key: 'qwen-image-2.0',
    id: 'qwen-image-2.0',
    providerId: 'aliyun',
    providerModelId: 'qwen-image-2.0',
    providerProtocol: 'aliyun-dashscope-image',
    label: 'Qwen Image 2.0',
    description: '阿里云千问图像生成与编辑模型，支持文生图、图生图、多图输入和多图输出',
    supportedModes: ['text_to_image', 'image_to_image'],
    defaultMode: 'text_to_image',
    supportedSizes: [...DASHSCOPE_IMAGE_SIZES],
    defaultSize: '1024*1024',
    supportedOutputFormats: ['png'],
    defaultOutputFormat: 'png',
    supportsSequential: true,
    supportsWebSearch: false,
    supportsBboxEdit: false,
    supportsPromptExtend: true,
    defaultPromptExtend: true,
    maxReferenceImages: 3,
    maxSequentialImages: 6,
    sequentialImageCountOptions: [1, 2, 3, 4, 5, 6],
    pricing: {
      strategy: 'per_image',
      rateYuan: 0.2,
    },
  },
  {
    key: 'qwen-image-2.0-pro',
    id: 'qwen-image-2.0-pro',
    providerId: 'aliyun',
    providerModelId: 'qwen-image-2.0-pro',
    providerProtocol: 'aliyun-dashscope-image',
    label: 'Qwen Image 2.0 Pro',
    description: '阿里云千问图像 Pro 版，文字渲染和语义遵循更强，支持文生图和图生图',
    supportedModes: ['text_to_image', 'image_to_image'],
    defaultMode: 'text_to_image',
    supportedSizes: [...DASHSCOPE_IMAGE_SIZES],
    defaultSize: '1024*1024',
    supportedOutputFormats: ['png'],
    defaultOutputFormat: 'png',
    supportsSequential: true,
    supportsWebSearch: false,
    supportsBboxEdit: false,
    supportsPromptExtend: true,
    defaultPromptExtend: true,
    maxReferenceImages: 3,
    maxSequentialImages: 6,
    sequentialImageCountOptions: [1, 2, 3, 4, 5, 6],
    pricing: {
      strategy: 'per_image',
      rateYuan: 0.5,
    },
  },
  {
    key: 'z-image-turbo',
    id: 'z-image-turbo',
    providerId: 'aliyun',
    providerModelId: 'z-image-turbo',
    providerProtocol: 'aliyun-dashscope-image',
    label: 'Z-Image Turbo',
    description: '阿里云轻量级文生图模型，速度快，支持中英文字渲染和提示词智能改写',
    supportedModes: ['text_to_image'],
    defaultMode: 'text_to_image',
    supportedSizes: [...DASHSCOPE_IMAGE_SIZES],
    defaultSize: '1024*1536',
    supportedOutputFormats: ['png'],
    defaultOutputFormat: 'png',
    supportsSequential: false,
    supportsWebSearch: false,
    supportsBboxEdit: false,
    supportsPromptExtend: true,
    defaultPromptExtend: false,
    maxReferenceImages: 0,
    maxSequentialImages: 1,
    sequentialImageCountOptions: [1],
    pricing: {
      strategy: 'per_image',
      rateYuan: 0.1,
      promptExtendRateYuan: 0.2,
    },
  },
]

const IMAGE_MODEL_CONFIGS_BY_ID = Object.fromEntries(
  IMAGE_MODEL_OPTIONS.map((config) => [config.id, config])
) as Record<string, ImageModelConfig>

const IMAGE_MODEL_CONFIGS_BY_KEY = Object.fromEntries(
  IMAGE_MODEL_OPTIONS.map((config) => [config.key, config])
) as Record<string, ImageModelConfig>

function normalizeLookupInput(input: string | null | undefined) {
  return typeof input === 'string' ? input.trim() : ''
}

function normalizeImageModelAlias(value: string) {
  const normalized = value.toLowerCase()
  if (normalized.startsWith('qwen-image-2.0-pro-')) {
    return 'qwen-image-2.0-pro'
  }
  if (normalized.startsWith('qwen-image-2.0-')) {
    return 'qwen-image-2.0'
  }
  return value
}

export function getImageModelConfig(input?: string | null): ImageModelConfig {
  const value = normalizeImageModelAlias(normalizeLookupInput(input))
  return IMAGE_MODEL_CONFIGS_BY_ID[value]
    || IMAGE_MODEL_CONFIGS_BY_KEY[value]
    || IMAGE_MODEL_CONFIGS_BY_ID[DEFAULT_IMAGE_MODEL]
}

export function normalizeImageModel(input?: string | null): string {
  return getImageModelConfig(input).id
}

export function getImageModelKey(input?: string | null): string {
  return getImageModelConfig(input).key
}

export function getImageModelProviderProtocol(input?: string | null): ImageModelProviderProtocol {
  return getImageModelConfig(input).providerProtocol
}

export function normalizeImageSize(model: string | null | undefined, size: string | null | undefined) {
  const config = getImageModelConfig(model)
  const normalized = typeof size === 'string' ? size.trim() : ''
  if (config.supportedSizes.includes(normalized as never)) {
    return normalized
  }

  if (isWan27ImageModel(config.id)) {
    const parsed = parseImageSize(normalized)
    if (parsed && parsed.width <= 4096 && parsed.height <= 4096) {
      return normalized
    }
  }

  if (config.providerProtocol === 'aliyun-dashscope-image') {
    const parsed = parseImageSize(normalized)
    if (parsed) {
      const area = parsed.width * parsed.height
      const minArea = 512 * 512
      const maxArea = 2048 * 2048
      if (
        parsed.width >= 512
        && parsed.height >= 512
        && parsed.width <= 2048
        && parsed.height <= 2048
        && area >= minArea
        && area <= maxArea
      ) {
        return normalized
      }
    }
  }

  return config.defaultSize
}

export function normalizeImageOutputFormat(
  model: string | null | undefined,
  outputFormat: string | null | undefined,
): 'jpeg' | 'png' {
  const config = getImageModelConfig(model)
  const normalized = typeof outputFormat === 'string' ? outputFormat.trim().toLowerCase() : ''
  return config.supportedOutputFormats.includes(normalized as 'jpeg' | 'png')
    ? normalized as 'jpeg' | 'png'
    : config.defaultOutputFormat
}

export function normalizeImageMaxImages(
  model: string | null | undefined,
  maxImages: number | string | null | undefined,
): number {
  const config = getImageModelConfig(model)
  if (!config.supportsSequential) {
    return 1
  }

  const numericValue = Number(maxImages)
  if (!Number.isFinite(numericValue)) {
    return Math.min(4, config.maxSequentialImages)
  }

  return Math.max(1, Math.min(config.maxSequentialImages, Math.trunc(numericValue)))
}

export function getImageModelRateYuan(
  model: string | null | undefined,
  promptExtend?: boolean | null,
): number | null {
  const pricing = getImageModelConfig(model).pricing
  if (!pricing) {
    return null
  }

  if (promptExtend === true && typeof pricing.promptExtendRateYuan === 'number') {
    return pricing.promptExtendRateYuan
  }

  return pricing.rateYuan
}

export function getImageModelPricingSummary(
  model: string | null | undefined,
  promptExtend?: boolean | null,
): string | null {
  const config = getImageModelConfig(model)
  const pricing = config.pricing
  if (!pricing) {
    return null
  }

  if (config.supportsPromptExtend && typeof pricing.promptExtendRateYuan === 'number' && pricing.promptExtendRateYuan !== pricing.rateYuan) {
    if (typeof promptExtend === 'boolean') {
      const rateYuan = getImageModelRateYuan(model, promptExtend)
      return rateYuan === null
        ? null
        : `¥${rateYuan.toFixed(2)}/张${promptExtend ? '（开启提示词改写）' : '（关闭提示词改写）'}`
    }

    return `关闭提示词改写 ¥${pricing.rateYuan.toFixed(2)}/张，开启提示词改写 ¥${pricing.promptExtendRateYuan.toFixed(2)}/张`
  }

  const rateYuan = getImageModelRateYuan(model, promptExtend)
  if (rateYuan === null) {
    return null
  }
  return `¥${rateYuan.toFixed(2)}/张`
}
