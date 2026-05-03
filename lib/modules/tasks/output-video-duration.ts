interface ReferenceAssetWithDuration {
  type?: string | null
  duration?: number | null
}

interface TaskLikeWithOutputDuration {
  model?: string | null
  mode?: string | null
  duration?: number | null
  referenceAssets?: ReferenceAssetWithDuration[] | null
}

function normalizePositiveDuration(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return value
}

function resolveReferenceVideoDuration(referenceAssets?: ReferenceAssetWithDuration[] | null) {
  if (!Array.isArray(referenceAssets) || referenceAssets.length === 0) {
    return null
  }

  const totalDuration = referenceAssets.reduce((sum, asset) => {
    if (asset?.type !== 'video') {
      return sum
    }

    return sum + (normalizePositiveDuration(asset.duration) || 0)
  }, 0)

  return totalDuration > 0 ? totalDuration : null
}

export function resolveTaskOutputVideoDuration(task: TaskLikeWithOutputDuration) {
  const normalizedDuration = normalizePositiveDuration(task.duration)
  if (normalizedDuration !== null) {
    return normalizedDuration
  }

  const isWanVideoEditOriginalDuration =
    (task.model === 'wan2.7-videoedit' || task.mode === 'video_edit') &&
    task.duration === 0

  if (!isWanVideoEditOriginalDuration) {
    return null
  }

  return resolveReferenceVideoDuration(task.referenceAssets)
}
