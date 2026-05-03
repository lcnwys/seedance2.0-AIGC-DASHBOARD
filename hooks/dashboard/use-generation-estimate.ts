'use client'

import { useMemo } from 'react'
import type { DashboardAsset as Asset } from '@/components/dashboard/types'
import { calculateTokens } from '@/lib/token-calculator'

export function useGenerationEstimate(
  selectedModel: string,
  referenceVideos: Asset[],
  resolution: string,
  ratio: string,
  duration: number,
  videoCount: number
) {
  const inputVideoDuration = useMemo(() => {
    return referenceVideos.reduce((sum, video) => sum + (video.duration || 0), 0)
  }, [referenceVideos])

  const tokenResult = useMemo(
    () => calculateTokens(selectedModel, resolution, ratio, duration, inputVideoDuration, videoCount),
    [selectedModel, resolution, ratio, duration, inputVideoDuration, videoCount]
  )

  return {
    inputVideoDuration,
    tokenResult,
    estimatedTokens: tokenResult.tokens,
    billingType: tokenResult.billingType,
  }
}
