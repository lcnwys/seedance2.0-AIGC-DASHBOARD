export type SizeTier = '1K' | '2K' | '4K'

export const SIZE_TIERS: SizeTier[] = ['1K', '2K', '4K']

export const AREA_MAP: Record<SizeTier, number> = {
  '1K': 1024 * 1024,
  '2K': 2048 * 2048,
  '4K': 4096 * 4096,
}

export const WAN_SIZE_PRESETS: Record<SizeTier, Record<string, string>> = {
  '1K': {
    '1:1': '1024*1024',
    '4:3': '1176*880',
    '3:4': '880*1176',
    '16:9': '1360*768',
    '9:16': '768*1360',
    '21:9': '1560*664',
  },
  '2K': {
    '1:1': '2048*2048',
    '4:3': '2360*1768',
    '3:4': '1768*2360',
    '16:9': '2728*1536',
    '9:16': '1536*2728',
    '21:9': '3128*1336',
  },
  '4K': {
    '1:1': '4096*4096',
    '4:3': '4728*3544',
    '3:4': '3544*4728',
    '16:9': '5456*3072',
    '9:16': '3072*5456',
    '21:9': '6256*2680',
  },
}

export const DEFAULT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'] as const

export function isWan27ImageModel(model: string | null | undefined) {
  return model === 'wan2.7-image' || model === 'wan2.7-image-pro'
}

// --- Custom ratio parsing ---

export function parseCustomRatio(input: string): { w: number; h: number; ratio: number } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const matched = trimmed.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/)
  if (!matched) return null

  const w = Number(matched[1])
  const h = Number(matched[2])
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null

  const ratio = w / h
  if (ratio < 1 / 8 || ratio > 8) return null

  return { w, h, ratio }
}

export function isValidCustomRatio(input: string): boolean {
  return parseCustomRatio(input) !== null
}

export function normalizeRatioString(input: string): string | null {
  const parsed = parseCustomRatio(input)
  if (!parsed) return null

  const gcdValue = gcd(parsed.w, parsed.h)
  const rw = Math.round(parsed.w / gcdValue)
  const rh = Math.round(parsed.h / gcdValue)
  if (rw <= 0 || rh <= 0) return null

  return `${rw}:${rh}`
}

// --- Size calculation ---

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a))
  let y = Math.abs(Math.trunc(b))

  while (y !== 0) {
    const next = x % y
    x = y
    y = next
  }

  return x || 1
}

function floorToMultiple(value: number, multiple = 8): number {
  return Math.max(multiple, Math.floor(value / multiple) * multiple)
}

function calcSizeByAreaAndRatio(
  area: number,
  ratio: number,
  align = 8,
): { width: number; height: number; size: string } {
  const rawWidth = Math.sqrt(area * ratio)
  const rawHeight = Math.sqrt(area / ratio)

  let w = floorToMultiple(rawWidth, align)
  let h = floorToMultiple(rawHeight, align)

  if (w * h > area) {
    if (w / h > ratio) {
      w -= align
      h = floorToMultiple(w / ratio, align)
    } else {
      h -= align
      w = floorToMultiple(h * ratio, align)
    }
  }

  w = Math.max(align, w)
  h = Math.max(align, h)

  return { width: w, height: h, size: `${w}*${h}` }
}

export function resolveWanSize(tier: SizeTier, ratioInput: string): string {
  const preset = WAN_SIZE_PRESETS[tier]?.[ratioInput]
  if (preset) return preset

  const parsed = parseCustomRatio(ratioInput)
  if (parsed) {
    return calcSizeByAreaAndRatio(AREA_MAP[tier], parsed.ratio, 8).size
  }

  // Fallback: try parsing as "w:h" format without strict validation
  const parts = ratioInput.split(':').map(Number)
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
    const ratioValue = parts[0] / parts[1]
    if (ratioValue >= 1 / 8 && ratioValue <= 8) {
      return calcSizeByAreaAndRatio(AREA_MAP[tier], ratioValue, 8).size
    }
  }

  return WAN_SIZE_PRESETS[tier]['1:1']
}

// --- Model tier constraints ---

export function getAvailableSizeTiers(
  model: string | null | undefined,
  hasReferenceImages: boolean,
  isSequential: boolean,
): SizeTier[] {
  if (model === 'wan2.7-image') {
    return ['1K', '2K']
  }

  if (model === 'wan2.7-image-pro') {
    if (!hasReferenceImages && !isSequential) {
      return ['1K', '2K', '4K']
    }
    return ['1K', '2K']
  }

  return ['1K', '2K', '4K']
}

export function resolveEffectiveSizeTier(
  model: string | null | undefined,
  requestedTier: SizeTier | null | undefined,
  hasReferenceImages: boolean,
  isSequential: boolean,
): SizeTier {
  const available = getAvailableSizeTiers(model, hasReferenceImages, isSequential)

  if (requestedTier && available.includes(requestedTier)) {
    return requestedTier
  }

  return available[available.length - 1] || '2K'
}

// --- Size tier inference from pixel size ---

export function inferSizeTierFromPixelSize(size: string | null | undefined, model: string | null | undefined): SizeTier {
  const parsed = parseImageSize(size)
  if (!parsed) {
    return model === 'wan2.7-image' ? '2K' : '2K'
  }

  const area = parsed.width * parsed.height
  const oneK = AREA_MAP['1K']
  const twoK = AREA_MAP['2K']
  const fourK = AREA_MAP['4K']

  if (area <= oneK * 1.5) return '1K'
  if (area <= twoK * 1.5) return '2K'
  return '4K'
}

// --- Backward-compatible utilities ---

export function parseImageSize(size: string | null | undefined) {
  const matched = typeof size === 'string' ? size.trim().match(/^(\d+)\*(\d+)$/) : null
  if (!matched) return null

  const width = Number(matched[1])
  const height = Number(matched[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null

  return { width, height }
}

export function formatRatioFromDimensions(width: number, height: number) {
  const divisor = gcd(width, height)
  return `${Math.max(1, Math.round(width / divisor))}:${Math.max(1, Math.round(height / divisor))}`
}

export function inferRatioFromSize(size: string | null | undefined) {
  const parsed = parseImageSize(size)
  if (!parsed) return null
  return formatRatioFromDimensions(parsed.width, parsed.height)
}

export function generateSize(ratioKey: string, tier: string): string {
  if (isWan27ImageModel(null) === false && (tier === '1K' || tier === '2K' || tier === '4K')) {
    return resolveWanSize(tier as SizeTier, ratioKey)
  }
  return resolveWanSize(tier as SizeTier, ratioKey)
}

export function inferSceneRatioQualityFromSize(
  size: string | null | undefined,
  model: string | null | undefined,
) {
  const ratio = inferRatioFromSize(size) || '1:1'
  const tier = inferSizeTierFromPixelSize(size, model)

  return { ratio, tier, scene: 'ecommerce' as const }
}

// --- Kept for non-Wan model backward compatibility ---

export function getAvailableImageQualityOptions(_model: string | null | undefined): string[] {
  return ['standard', 'high', 'ultra']
}

export function normalizeImageQuality(
  quality: string | null | undefined,
  model: string | null | undefined,
): string {
  if (quality === '1K' || quality === '2K' || quality === '4K') return quality
  if (quality && ['standard', 'high', 'ultra'].includes(quality)) return quality
  return '2K'
}

export function normalizeImageScene(scene: string | null | undefined): string {
  return 'ecommerce'
}

export function getDefaultQualityForScene(_scene: string, _model: string | null | undefined): string {
  return '2K'
}

export function getAllowedRatiosForScene(_scene: string): string[] {
  return [...DEFAULT_RATIOS]
}

export function findBestSceneForRatio(_ratio: string | null | undefined): string {
  return 'ecommerce'
}

export function inferQualityFromSize(size: string | null | undefined, model: string | null | undefined): string {
  return inferSizeTierFromPixelSize(size, model)
}
