import axios from 'axios'
import type {
  BuildImageGenerationInput,
  ImageGenerationProviderResult,
  ImageGenerationUsage,
} from '@/lib/modules/image/types'

function normalizeVolcengineImageUsage(raw: unknown): ImageGenerationUsage {
  const usage = raw as {
    generated_images?: number
    output_tokens?: number
    total_tokens?: number
    tool_usage?: {
      web_search?: number
    }
  }

  return {
    generatedImages: typeof usage?.generated_images === 'number' ? usage.generated_images : 0,
    outputTokens: typeof usage?.output_tokens === 'number' ? usage.output_tokens : 0,
    totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : 0,
    webSearchCalls: typeof usage?.tool_usage?.web_search === 'number' ? usage.tool_usage.web_search : 0,
  }
}

function normalizeVolcengineImageItems(rawData: unknown): ImageGenerationProviderResult['items'] {
  if (!Array.isArray(rawData)) {
    return []
  }

  return rawData.map((item) => {
    const imageItem = item as {
      url?: string
      size?: string
      error?: {
        code?: string
        message?: string
      }
    }

    return {
      url: typeof imageItem?.url === 'string' ? imageItem.url : null,
      size: typeof imageItem?.size === 'string' ? imageItem.size : null,
      errorCode: typeof imageItem?.error?.code === 'string' ? imageItem.error.code : null,
      errorMessage: typeof imageItem?.error?.message === 'string' ? imageItem.error.message : null,
    }
  })
}

export function buildVolcengineImagesV1Body(input: BuildImageGenerationInput) {
  const body: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    size: input.size,
    stream: false,
    response_format: input.responseFormat,
    output_format: input.outputFormat,
    watermark: input.watermark,
    sequential_image_generation: input.sequentialImageGeneration,
    optimize_prompt_options: {
      mode: input.optimizePromptMode,
    },
  }

  if (input.images && input.images.length > 0) {
    body.image = input.images.length === 1 ? input.images[0] : input.images
  }

  if (input.sequentialImageGeneration === 'auto' && typeof input.maxImages === 'number') {
    body.sequential_image_generation_options = {
      max_images: input.maxImages,
    }
  }

  if (input.enableWebSearch) {
    body.tools = [{ type: 'web_search' }]
  }

  return body
}

export async function generateVolcengineImagesV1(params: {
  apiUrl: string
  apiKey: string
  body: Record<string, unknown>
}) {
  const endpoint = `${params.apiUrl.replace(/\/+$/, '')}/api/v3/images/generations`
  const response = await axios.post(endpoint, params.body, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    timeout: 120000,
  })

  const data = response.data || {}
  return {
    model: typeof (data as { model?: unknown }).model === 'string'
      ? (data as { model: string }).model
      : String(params.body.model || ''),
    createdAt: typeof (data as { created?: unknown }).created === 'number'
      ? (data as { created: number }).created
      : null,
    items: normalizeVolcengineImageItems((data as { data?: unknown }).data),
    usage: normalizeVolcengineImageUsage((data as { usage?: unknown }).usage),
    raw: data,
  } satisfies ImageGenerationProviderResult
}
