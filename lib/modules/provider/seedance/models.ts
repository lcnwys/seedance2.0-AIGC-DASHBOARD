import type { VideoGenerationProviderId } from '@/lib/modules/provider/types'

export const DEFAULT_SEEDANCE_MODEL = 'doubao-seedance-2-0-260128' as const
export const FAST_SEEDANCE_MODEL = 'doubao-seedance-2-0-fast-260128' as const
export const DEFAULT_SEEDANCE_MODEL_KEY = 'seedance-2.0' as const
export const FAST_SEEDANCE_MODEL_KEY = 'seedance-2.0-fast' as const

export type SeedanceModelId =
  | typeof DEFAULT_SEEDANCE_MODEL
  | typeof FAST_SEEDANCE_MODEL

export type SeedanceModelKey =
  | typeof DEFAULT_SEEDANCE_MODEL_KEY
  | typeof FAST_SEEDANCE_MODEL_KEY

export type SeedanceBillingType = 'with_video' | 'without_video'

type SeedanceModelConfig = {
  key: SeedanceModelKey
  id: SeedanceModelId
  providerId: VideoGenerationProviderId
  label: string
  description: string
  pricing: Record<SeedanceBillingType, number>
}

export const SEEDANCE_MODEL_CONFIGS: Record<SeedanceModelId, SeedanceModelConfig> = {
  [DEFAULT_SEEDANCE_MODEL]: {
    key: DEFAULT_SEEDANCE_MODEL_KEY,
    id: DEFAULT_SEEDANCE_MODEL,
    providerId: 'volcengine',
    label: 'Seedance 2.0',
    description: '高质量视频生成，适合优先追求成片质量的场景',
    pricing: {
      with_video: 28,
      without_video: 46,
    },
  },
  [FAST_SEEDANCE_MODEL]: {
    key: FAST_SEEDANCE_MODEL_KEY,
    id: FAST_SEEDANCE_MODEL,
    providerId: 'volcengine',
    label: 'Seedance 2.0 Fast',
    description: '生成更快，价格更低，适合高频出片与快速试稿',
    pricing: {
      with_video: 22,
      without_video: 37,
    },
  },
}

export const SEEDANCE_MODEL_OPTIONS = Object.values(SEEDANCE_MODEL_CONFIGS)
export const SEEDANCE_MODEL_CONFIGS_BY_KEY: Record<SeedanceModelKey, SeedanceModelConfig> = {
  [DEFAULT_SEEDANCE_MODEL_KEY]: SEEDANCE_MODEL_CONFIGS[DEFAULT_SEEDANCE_MODEL],
  [FAST_SEEDANCE_MODEL_KEY]: SEEDANCE_MODEL_CONFIGS[FAST_SEEDANCE_MODEL],
}

export function isSupportedSeedanceModel(model: string | null | undefined): model is SeedanceModelId {
  return Boolean(model && model in SEEDANCE_MODEL_CONFIGS)
}

export function isSupportedSeedanceModelKey(modelKey: string | null | undefined): modelKey is SeedanceModelKey {
  return Boolean(modelKey && modelKey in SEEDANCE_MODEL_CONFIGS_BY_KEY)
}

export function normalizeSeedanceModel(model: string | null | undefined): SeedanceModelId {
  return isSupportedSeedanceModel(model) ? model : DEFAULT_SEEDANCE_MODEL
}

export function normalizeSeedanceModelKey(modelKey: string | null | undefined): SeedanceModelKey {
  return isSupportedSeedanceModelKey(modelKey) ? modelKey : DEFAULT_SEEDANCE_MODEL_KEY
}

export function getSeedanceModelConfig(model: string | null | undefined): SeedanceModelConfig {
  return SEEDANCE_MODEL_CONFIGS[normalizeSeedanceModel(model)]
}

export function getSeedanceModelConfigByKey(modelKey: string | null | undefined): SeedanceModelConfig {
  return SEEDANCE_MODEL_CONFIGS_BY_KEY[normalizeSeedanceModelKey(modelKey)]
}

export function getSeedanceModelKey(model: string | null | undefined): SeedanceModelKey {
  return getSeedanceModelConfig(model).key
}

export function getSeedanceBillingRate(
  model: string | null | undefined,
  billingType: SeedanceBillingType
): number {
  return getSeedanceModelConfig(model).pricing[billingType]
}

export function getSeedanceBillingRangeLabel(billingType: SeedanceBillingType): string {
  const rates = SEEDANCE_MODEL_OPTIONS.map((option) => option.pricing[billingType]).sort((a, b) => a - b)
  const min = rates[0]
  const max = rates[rates.length - 1]
  return min === max ? `¥${min}/百万tokens` : `¥${min}-${max}/百万tokens`
}
