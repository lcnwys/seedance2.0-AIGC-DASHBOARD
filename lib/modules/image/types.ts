export type ImageGenerationProviderId = 'volcengine' | 'aliyun' | 'grsai'

export type ImageGenerationMode = 'text_to_image' | 'image_to_image'
export type ImageEditBBox = [number, number, number, number]

export interface ImageEditConfig {
  bboxList: ImageEditBBox[][]
}

export interface ImageGenerationUsage {
  generatedImages: number
  outputTokens: number
  totalTokens: number
  webSearchCalls: number
}

export interface ImageGenerationItemResult {
  url: string | null
  size: string | null
  errorCode: string | null
  errorMessage: string | null
}

export interface ImageGenerationProviderResult {
  model: string
  createdAt: number | null
  items: ImageGenerationItemResult[]
  usage: ImageGenerationUsage
  raw: unknown
}

export interface BuildImageGenerationInput {
  model: string
  prompt: string
  images?: string[]
  bboxList?: ImageEditBBox[][]
  size: string
  outputFormat: 'jpeg' | 'png'
  responseFormat: 'url'
  watermark: boolean
  promptExtend?: boolean
  sequentialImageGeneration: 'disabled' | 'auto'
  maxImages?: number | null
  optimizePromptMode: 'standard'
  enableWebSearch: boolean
}

export interface ImageProviderApiCredentials {
  apiUrl: string
  apiKey: string
}

export interface ImageGenerationProvider {
  id: ImageGenerationProviderId
  label: string
  defaultApiUrl: string
  buildGenerateBody(input: BuildImageGenerationInput): Record<string, unknown>
  generateImages(params: ImageProviderApiCredentials & { body: Record<string, unknown> }): Promise<ImageGenerationProviderResult>
}
