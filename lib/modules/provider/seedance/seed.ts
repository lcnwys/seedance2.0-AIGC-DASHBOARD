export const DEFAULT_SEED = BigInt(-1)
export const MAX_SEED = BigInt('4294967295')

export function normalizeSeed(rawSeed: unknown): bigint | null {
  if (rawSeed === undefined || rawSeed === null || rawSeed === '') {
    return DEFAULT_SEED
  }

  let seedValue: bigint

  if (typeof rawSeed === 'bigint') {
    seedValue = rawSeed
  } else if (typeof rawSeed === 'number') {
    if (!Number.isInteger(rawSeed)) return null
    seedValue = BigInt(rawSeed)
  } else if (typeof rawSeed === 'string') {
    const trimmed = rawSeed.trim()
    if (!/^-?\d+$/.test(trimmed)) return null
    seedValue = BigInt(trimmed)
  } else {
    return null
  }

  if (seedValue < DEFAULT_SEED || seedValue > MAX_SEED) {
    return null
  }

  return seedValue
}

export function serializeSeedForUpstream(seed: bigint): number {
  return Number(seed)
}
