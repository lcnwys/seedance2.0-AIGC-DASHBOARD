type TimestampLike = Date | string | number | null | undefined

const TERMINAL_STATUSES = new Set([
  'succeeded',
  'failed',
  'expired',
  'cancelled',
  'canceled',
])

function normalizePositiveSeconds(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return Math.max(1, Math.trunc(value))
}

function normalizeTimestampMs(value: TimestampLike) {
  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isFinite(timestamp) ? timestamp : null
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) ? timestamp : null
  }

  return null
}

function deriveLifecycleGenerationTimeSeconds(input: {
  createdAt?: TimestampLike
  updatedAt?: TimestampLike
  status?: string | null
}) {
  if (!input.status || !TERMINAL_STATUSES.has(input.status)) {
    return null
  }

  const createdAtMs = normalizeTimestampMs(input.createdAt)
  const updatedAtMs = normalizeTimestampMs(input.updatedAt)

  if (createdAtMs === null || updatedAtMs === null || updatedAtMs <= createdAtMs) {
    return null
  }

  return Math.max(1, Math.round((updatedAtMs - createdAtMs) / 1000))
}

export function resolveVideoTaskGenerationTimeSeconds(input: {
  generationTime?: number | null
  createdAt?: TimestampLike
  updatedAt?: TimestampLike
  status?: string | null
}) {
  return normalizePositiveSeconds(input.generationTime)
    ?? deriveLifecycleGenerationTimeSeconds(input)
    ?? undefined
}

export function resolveImageTaskGenerationTimeSeconds(input: {
  providerId?: string | null
  createdAt?: TimestampLike
  updatedAt?: TimestampLike
  status?: string | null
}) {
  switch (input.providerId) {
    case 'aliyun':
      // Aliyun image generation is an async task. The local task lifecycle spans submit -> finish.
      return deriveLifecycleGenerationTimeSeconds(input) ?? undefined
    case 'volcengine':
      // Volcengine image generation is handled in a single blocking request. The local task lifecycle
      // spans request start -> response received, which is the best available wall-clock duration here.
      return deriveLifecycleGenerationTimeSeconds(input) ?? undefined
    default:
      return deriveLifecycleGenerationTimeSeconds(input) ?? undefined
  }
}
