import axios from 'axios'
import {
  buildAliyunImageRequestError,
  buildAliyunImageRequestHeaders,
} from '@/lib/modules/image/adapters/aliyun-wan-27-shared'
import type {
  BuildImageGenerationInput,
  ImageGenerationItemResult,
  ImageGenerationProviderResult,
  ImageGenerationUsage,
} from '@/lib/modules/image/types'

const ALIYUN_IMAGE_REQUEST_TIMEOUT_MS = 300000

function normalizeAliyunDashscopeItems(raw: unknown): ImageGenerationItemResult[] {
  const content = (raw as {
    output?: {
      choices?: Array<{
        message?: {
          content?: Array<{ type?: string; image?: string }>
        }
      }>
    }
    usage?: {
      size?: string
    }
  })?.output?.choices?.[0]?.message?.content

  if (!Array.isArray(content)) {
    return []
  }

  return content
    .filter((item) => (item?.type === undefined || item?.type === 'image') && typeof item?.image === 'string')
    .map((item) => ({
      url: item.image || null,
      size: typeof (raw as { usage?: { size?: string } })?.usage?.size === 'string'
        ? (raw as { usage?: { size?: string } }).usage?.size || null
        : null,
      errorCode: null,
      errorMessage: null,
    }))
}

function normalizeAliyunDashscopeUsage(raw: unknown): ImageGenerationUsage {
  const usage = (raw as {
    usage?: {
      image_count?: number
      output_tokens?: number
      total_tokens?: number
    }
  })?.usage

  return {
    generatedImages: typeof usage?.image_count === 'number' ? usage.image_count : 0,
    outputTokens: typeof usage?.output_tokens === 'number' ? usage.output_tokens : 0,
    totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : 0,
    webSearchCalls: 0,
  }
}

export function buildAliyunDashscopeImageBody(input: BuildImageGenerationInput) {
  const imageContent = Array.isArray(input.images)
    ? input.images
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((image) => ({ image }))
    : []

  const supportsSequential = input.model.startsWith('qwen-image-2.0')
  const imageCount = supportsSequential && input.sequentialImageGeneration === 'auto'
    ? Math.max(1, Math.min(6, Number(input.maxImages) || 4))
    : 1

  const parameters: Record<string, unknown> = {
    size: input.size,
    n: imageCount,
    watermark: input.watermark,
    prompt_extend: input.promptExtend !== false,
  }

  if (supportsSequential && input.sequentialImageGeneration === 'auto' && typeof input.maxImages === 'number') {
    parameters.n = Math.max(1, Math.min(6, input.maxImages))
  }

  return {
    model: input.model,
    input: {
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              text: input.prompt,
            },
          ],
        },
      ],
    },
    parameters,
  }
}

export async function generateAliyunDashscopeImages(params: {
  apiUrl: string
  apiKey: string
  body: Record<string, unknown>
}) {
  const endpoint = `${params.apiUrl.replace(/\/+$/, '')}/api/v1/services/aigc/multimodal-generation/generation`
  let response
  try {
    response = await axios.post(endpoint, params.body, {
      headers: buildAliyunImageRequestHeaders(params.apiKey),
      timeout: ALIYUN_IMAGE_REQUEST_TIMEOUT_MS,
    })
  } catch (error) {
    throw buildAliyunImageRequestError(error)
  }

  const data = response.data || {}
  return {
    model: typeof params.body.model === 'string' ? params.body.model : '',
    createdAt: null,
    items: normalizeAliyunDashscopeItems(data),
    usage: normalizeAliyunDashscopeUsage(data),
    raw: data,
  } satisfies ImageGenerationProviderResult
}
