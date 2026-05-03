import type { ImageEditConfig } from '@/lib/modules/image/types'

export type DashboardAssetType = 'image' | 'video' | 'audio'
export type ImageGenerationUiMode = 'single' | 'group'
export type VideoGenerationUiMode = 'image_to_video' | 'reference' | 'text_to_video' | 'video_edit'
export type VideoImageSubMode = 'first_frame' | 'first_last_frame' | 'first_clip'

export interface DashboardAsset {
  id: string
  name: string
  type: DashboardAssetType
  url: string
  createdAt?: string
  duration?: number
  category: 'creation' | 'subject'
  subjectType?: 'character' | 'scene' | 'prop'
  subjectName?: string
}

export interface DashboardUploadItem {
  id: string
  name: string
  type: DashboardAssetType
  size: number
  progress: number
  status: 'preparing' | 'uploading' | 'finalizing' | 'completed' | 'failed'
  errorMessage?: string
  createdAt: string
}

export interface DashboardTask {
  id: string
  taskKind?: 'video' | 'image'
  batchId?: string
  externalId?: string
  mode: string
  prompt: string
  promptAst?: any[]
  status: string
  outputUrl?: string
  outputAssets?: DashboardAsset[]
  errorMessage?: string
  estimatedTokens: number
  outputTokens?: number
  totalTokens?: number
  ratio: string
  resolution: string
  duration: number
  generateAudio: boolean
  promptExtend?: boolean
  seed?: number
  model: string
  modelKey?: string
  providerId?: string
  providerModelId?: string
  size?: string
  outputFormat?: string
  responseFormat?: string
  generatedImages?: number
  watermark?: boolean
  createdAt: string
  generationTime?: number
  referenceAssets: DashboardAsset[]
  billingType?: 'with_video' | 'without_video' | 'refunded'
  costYuan?: number
  recordedCostYuan?: number | null
  actualCostSource?: 'recorded' | 'derived' | 'none'
  imageEditConfig?: ImageEditConfig
  submitter?: {
    id: string
    name: string
    email: string
  }
  isRefreshing?: boolean
  isOptimistic?: boolean
}
