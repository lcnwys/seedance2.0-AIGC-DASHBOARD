import {
  DEFAULT_VIDEO_MODEL,
  getDurationModelRateYuan,
  getVideoModelConfig,
} from '@/lib/modules/video/models'
import { getImageModelRateYuan } from '@/lib/modules/image/models'

export const BILLING_RATES = {
  with_video: 28,
  without_video: 46,
} as const

export type BillingType = 'with_video' | 'without_video'

export interface AssetLike {
  type?: string | null
}

export interface CostResolutionInput {
  costYuan?: number | null
  actualCostCents?: number | null
  totalTokens?: number | null
  billingType?: string | null
  model?: string | null
  duration?: number | null
  resolution?: string | null
  referenceAssets?: AssetLike[] | null
}

export interface ImageCostResolutionInput {
  costYuan?: number | null
  generatedImages?: number | null
  model?: string | null
  promptExtend?: boolean | null
}

export interface ImageEstimatedCostInput {
  model?: string | null
  promptExtend?: boolean | null
  sequentialImageGeneration?: string | null
  maxImages?: number | null
}

export function inferBillingType(input: {
  billingType?: string | null
  referenceAssets?: AssetLike[] | null
}): BillingType {
  const explicit = input.billingType
  if (explicit === 'with_video' || explicit === 'without_video') {
    return explicit
  }

  const hasVideoInput = input.referenceAssets?.some(asset => asset.type === 'video')
  return hasVideoInput ? 'with_video' : 'without_video'
}

export function calculateCostYuanFromTokens(
  tokens: number,
  billingType: BillingType,
  model: string | null | undefined = DEFAULT_VIDEO_MODEL
): number {
  const modelConfig = getVideoModelConfig(model)

  if (modelConfig.pricing.strategy !== 'tokens') {
    return 0
  }

  return (tokens / 1_000_000) * modelConfig.pricing.rates[billingType]
}

export function resolveActualCostYuan(input: CostResolutionInput): number {
  if (typeof input.costYuan === 'number' && Number.isFinite(input.costYuan)) {
    return input.costYuan
  }

  if (typeof input.actualCostCents === 'number' && Number.isFinite(input.actualCostCents)) {
    return input.actualCostCents / 100
  }

  const tokens = input.totalTokens || 0
  const modelConfig = getVideoModelConfig(input.model)

  if (modelConfig.pricing.strategy === 'duration') {
    const rate = getDurationModelRateYuan(input.model, input.resolution)
    const duration = typeof input.duration === 'number' ? input.duration : 0
    if (!rate || !duration) return 0
    return duration * rate
  }

  if (!tokens) return 0

  return calculateCostYuanFromTokens(tokens, inferBillingType(input), input.model)
}

export function calculateActualCostCents(costYuan: number): number {
  return Math.round(costYuan * 100)
}

export function resolveImageActualCostYuan(input: ImageCostResolutionInput): number {
  const generatedImages = input.generatedImages || 0
  const rateYuan = getImageModelRateYuan(input.model, input.promptExtend)
  if (generatedImages > 0 && rateYuan !== null) {
    return generatedImages * rateYuan
  }

  if (typeof input.costYuan === 'number' && Number.isFinite(input.costYuan)) {
    return input.costYuan
  }

  return 0
}

export function resolveImagePlannedCount(input: {
  sequentialImageGeneration?: string | null
  maxImages?: number | null
}): number {
  if (input.sequentialImageGeneration === 'auto') {
    const requested = Number(input.maxImages || 1)
    return Number.isFinite(requested) ? Math.max(1, Math.trunc(requested)) : 1
  }

  return 1
}

export function resolveImageEstimatedCostYuan(input: ImageEstimatedCostInput): number {
  return resolveImageActualCostYuan({
    generatedImages: resolveImagePlannedCount(input),
    model: input.model,
    promptExtend: input.promptExtend,
  })
}
