import axios from 'axios'
import type {
  BuildImageGenerationInput,
  ImageGenerationItemResult,
  ImageGenerationProviderResult,
} from '@/lib/modules/image/types'

const ALIYUN_IMAGE_REQUEST_TIMEOUT_MS = 300000
export function buildAliyunImageRequestHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
}

function normalizeAliyunErrorPayload(data: unknown) {
  if (typeof data === 'string' && data.trim()) {
    return {
      code: null,
      message: data.trim(),
      requestId: null,
      raw: data,
    }
  }

  if (!data || typeof data !== 'object') {
    return {
      code: null,
      message: null,
      requestId: null,
      raw: data ?? null,
    }
  }

  const payload = data as {
    code?: string
    message?: string
    request_id?: string
    requestId?: string
    error?: {
      code?: string
      message?: string
    }
  }

  const code =
    typeof payload.code === 'string'
      ? payload.code
      : typeof payload.error?.code === 'string'
        ? payload.error.code
        : null
  const message =
    typeof payload.message === 'string'
      ? payload.message
      : typeof payload.error?.message === 'string'
        ? payload.error.message
        : null
  const requestId =
    typeof payload.request_id === 'string'
      ? payload.request_id
      : typeof payload.requestId === 'string'
        ? payload.requestId
        : null

  return {
    code,
    message,
    requestId,
    raw: payload,
  }
}

function stringifyAliyunErrorPayload(raw: unknown) {
  if (!raw) {
    return null
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    return trimmed || null
  }

  try {
    return JSON.stringify(raw)
  } catch {
    return null
  }
}

export function buildAliyunImageRequestError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return error
  }

  const normalizedPayload = normalizeAliyunErrorPayload(error.response?.data)
  const code = normalizedPayload.code
  const upstreamMessage = normalizedPayload.message
  const requestId = normalizedPayload.requestId
  const isTimeout = error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')
  const rawPayloadText = stringifyAliyunErrorPayload(normalizedPayload.raw)
  const fallbackMessage = isTimeout
    ? `Aliyun image generation request timed out after ${Math.round(ALIYUN_IMAGE_REQUEST_TIMEOUT_MS / 1000)}s`
    : (typeof error.message === 'string' && error.message.trim()
      ? error.message.trim()
      : 'Aliyun image generation request failed')
  const finalMessage = [
    upstreamMessage || fallbackMessage,
    error.response?.status ? `HTTP状态: ${error.response.status}` : null,
    code ? `错误码: ${code}` : null,
    requestId ? `请求ID: ${requestId}` : null,
    !upstreamMessage && rawPayloadText ? `上游响应: ${rawPayloadText}` : null,
  ].filter(Boolean).join('\n')

  const providerError = new Error(finalMessage)
  ;(providerError as Error & Record<string, unknown>).providerCode = code
  ;(providerError as Error & Record<string, unknown>).providerMessage = upstreamMessage || fallbackMessage
  ;(providerError as Error & Record<string, unknown>).providerStatus = error.response?.status || null
  ;(providerError as Error & Record<string, unknown>).providerResponse = normalizedPayload.raw || null
  ;(providerError as Error & Record<string, unknown>).isHandledProviderError = true

  return providerError
}

export function buildAliyunWan27ImageBody(input: BuildImageGenerationInput) {
  const imageContent = Array.isArray(input.images)
    ? input.images
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((image) => ({ image }))
    : []
  const isSequential = input.sequentialImageGeneration === 'auto'
  const imageCount = isSequential
    ? Math.max(1, Math.min(12, Number(input.maxImages) || 4))
    : 1

  const parameters: Record<string, unknown> = {
    size: input.size,
    n: imageCount,
    watermark: input.watermark,
  }

  if (Array.isArray(input.bboxList) && input.bboxList.some((boxes) => boxes.length > 0)) {
    parameters.bbox_list = input.bboxList
  }

  if (isSequential) {
    parameters.enable_sequential = true
  } else if (imageContent.length === 0) {
    parameters.thinking_mode = true
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

function normalizeAliyunItems(raw: unknown): ImageGenerationItemResult[] {
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

function normalizeAliyunUsage(raw: unknown) {
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

export async function generateAliyunWan27Images(params: {
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
    items: normalizeAliyunItems(data),
    usage: normalizeAliyunUsage(data),
    raw: data,
  } satisfies ImageGenerationProviderResult
}
