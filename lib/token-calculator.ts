// Token 计算公式:
// - 含视频输入: (宽 × 高 × 帧率 × (输入时长+输出时长)) / 1024
// - 不含视频输入: (宽 × 高 × 帧率 × 输出时长) / 1024
// 帧率统一为 24fps

const FRAME_RATE = 24

import {
  DEFAULT_VIDEO_MODEL,
  getDurationModelRateYuan,
  getVideoModelConfig,
  normalizeVideoModel,
  normalizeVideoRatio,
  normalizeVideoResolution,
} from '@/lib/modules/video/models'

// 默认保留标准版价格，兼容仍然读取该常量的旧代码
export const BILLING_RATES = {
  with_video: 28,
  without_video: 46,
} as const

export type BillingType = 'with_video' | 'without_video'

// 分辨率像素对照表 (2026-04-17 更新)
export const RESOLUTION_DIMENSIONS: Record<string, Record<string, { width: number; height: number }>> = {
  '480p': {
    '16:9': { width: 864, height: 496 },
    '4:3': { width: 752, height: 560 },
    '1:1': { width: 640, height: 640 },
    '3:4': { width: 560, height: 752 },
    '9:16': { width: 496, height: 864 },
    '21:9': { width: 992, height: 432 },
  },
  '720p': {
    '16:9': { width: 1280, height: 720 },
    '4:3': { width: 1112, height: 834 },
    '1:1': { width: 960, height: 960 },
    '3:4': { width: 834, height: 1112 },
    '9:16': { width: 720, height: 1280 },
    '21:9': { width: 1470, height: 630 },
  },
  '1080p': {
    '16:9': { width: 1920, height: 1080 },
    '4:3': { width: 1664, height: 1248 },
    '1:1': { width: 1440, height: 1440 },
    '3:4': { width: 1248, height: 1648 },
    '9:16': { width: 1080, height: 1920 },
    '21:9': { width: 2206, height: 946 },
  },
}

export interface TokenCalculationResult {
  model: string
  tokens: number
  billingType: BillingType
  unitPriceYuan: number
  costYuan: number
  pricingMode: 'tokens' | 'duration'
  usageAmount: number
  usageUnit: 'tokens' | 'seconds'
  usageLabel: string
  unitPriceLabel: string
}

function resolveAdaptiveRatio(ratio: string) {
  return ratio === 'adaptive' ? '16:9' : ratio
}

function resolveEstimatedOutputDuration(model: string, outputDuration: number) {
  if (outputDuration === -1) {
    return getVideoModelConfig(model).defaultDuration
  }

  return outputDuration
}

function resolveDurationPricingOutputSeconds(model: string, outputDuration: number, inputVideoDuration: number) {
  if (model === 'wan2.7-videoedit') {
    if (outputDuration === 0) {
      return Math.max(0, inputVideoDuration)
    }
  }

  return Math.max(0, outputDuration)
}

function resolveDurationPricingBillableSeconds(model: string, outputDuration: number, inputVideoDuration: number) {
  const normalizedOutputSeconds = resolveDurationPricingOutputSeconds(model, outputDuration, inputVideoDuration)

  if (model === 'wan2.7-videoedit') {
    return Math.max(0, inputVideoDuration) + normalizedOutputSeconds
  }

  return normalizedOutputSeconds
}

/**
 * 计算 token 用量
 * @param resolution 分辨率 ('480p' | '720p')
 * @param ratio 宽高比 ('16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9')
 * @param outputDuration 输出视频时长（秒）
 * @param inputVideoDuration 输入视频总时长（秒），默认0表示无视频输入
 * @param count 生成条数
 */
export function calculateTokens(
  model: string,
  resolution: string,
  ratio: string,
  outputDuration: number,
  inputVideoDuration: number = 0,
  count: number = 1
): TokenCalculationResult {
  const modelConfig = getVideoModelConfig(model)
  const normalizedModel = normalizeVideoModel(model)
  const normalizedResolution = normalizeVideoResolution(modelConfig.id, resolution)
  const normalizedRatio = normalizeVideoRatio(modelConfig.id, ratio)
  const resolvedRatio = resolveAdaptiveRatio(normalizedRatio)
  const dims = RESOLUTION_DIMENSIONS[normalizedResolution]?.[resolvedRatio]
  const hasVideoInput = inputVideoDuration > 0
  const billingType: BillingType = hasVideoInput ? 'with_video' : 'without_video'
  const estimatedOutputDuration = resolveEstimatedOutputDuration(modelConfig.id, outputDuration)

  if (modelConfig.pricing.strategy === 'duration') {
    const rate = getDurationModelRateYuan(modelConfig.id, normalizedResolution) || 0
    const billableSeconds = resolveDurationPricingBillableSeconds(
      modelConfig.id,
      estimatedOutputDuration,
      inputVideoDuration,
    ) * Math.max(1, count)
    const costYuan = billableSeconds * rate
    const usageLabel = outputDuration === -1 ? `约${billableSeconds}s` : `${billableSeconds}s`

    return {
      model: normalizedModel,
      tokens: 0,
      billingType,
      unitPriceYuan: rate,
      costYuan,
      pricingMode: 'duration',
      usageAmount: billableSeconds,
      usageUnit: 'seconds',
      usageLabel,
      unitPriceLabel: `¥${rate.toFixed(2)}/秒`,
    }
  }

  if (!dims) {
    return {
      model: normalizedModel,
      tokens: 0,
      billingType,
      unitPriceYuan: modelConfig.pricing.rates.without_video,
      costYuan: 0,
      pricingMode: 'tokens',
      usageAmount: 0,
      usageUnit: 'tokens',
      usageLabel: '0 tokens',
      unitPriceLabel: `¥${modelConfig.pricing.rates.without_video}/百万tokens`,
    }
  }

  // 计算总时长
  const totalDuration = hasVideoInput 
    ? (inputVideoDuration + estimatedOutputDuration) 
    : estimatedOutputDuration
  
  // Token 公式: (宽 × 高 × 帧率 × 时长) / 1024 × 条数
  const tokens = Math.round(
    (dims.width * dims.height * FRAME_RATE * totalDuration) / 1024 * count
  )
  
  // 费用计算
  const rate = modelConfig.pricing.rates[billingType]
  const costYuan = (tokens / 1_000_000) * rate
  
  return {
    model: normalizedModel,
    tokens,
    billingType,
    unitPriceYuan: rate,
    costYuan,
    pricingMode: 'tokens',
    usageAmount: tokens,
    usageUnit: 'tokens',
    usageLabel: outputDuration === -1 ? `约${tokens.toLocaleString()} tokens` : `${tokens.toLocaleString()} tokens`,
    unitPriceLabel: `¥${rate}/百万tokens`,
  }
}

/**
 * 简化版：只获取 token 数量（向后兼容）
 */
export function calculateTokensSimple(
  resolution: string,
  ratio: string,
  duration: number,
  count: number = 1,
  model: string = DEFAULT_VIDEO_MODEL
): number {
  return calculateTokens(model, resolution, ratio, duration, 0, count).tokens
}

export function formatTokenCount(tokens: number): string {
  return tokens.toLocaleString()
}

/**
 * 格式化费用
 */
export function formatCostYuan(costYuan: number): string {
  return `¥${costYuan.toFixed(2)}`
}
