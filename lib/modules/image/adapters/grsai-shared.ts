import axios from 'axios'
import type {
  BuildImageGenerationInput,
  ImageGenerationItemResult,
  ImageGenerationProviderResult,
} from '@/lib/modules/image/types'

const GRSAI_IMAGE_REQUEST_TIMEOUT_MS = 60000
const GRSAI_IMAGE_POLL_INTERVAL_MS = 2500
const GRSAI_IMAGE_MAX_POLLS = 120
const GRSAI_NANO_BANANA_DEFAULT_IMAGE_SIZE = '1K'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRecordValue(input: unknown, key: string): unknown {
  return input && typeof input === 'object' ? (input as Record<string, unknown>)[key] : undefined
}

function normalizeGrsaiErrorPayload(data: unknown) {
  if (typeof data === 'string' && data.trim()) {
    return {
      code: null,
      message: data.trim(),
      raw: data,
    }
  }

  if (!data || typeof data !== 'object') {
    return {
      code: null,
      message: null,
      raw: data ?? null,
    }
  }

  const payload = data as {
    code?: number | string
    msg?: string
    message?: string
    error?: string | { message?: string }
    failure_reason?: string
  }

  const message =
    typeof payload.msg === 'string'
      ? payload.msg
      : typeof payload.message === 'string'
        ? payload.message
        : typeof payload.error === 'string'
          ? payload.error
          : typeof payload.error?.message === 'string'
            ? payload.error.message
            : typeof payload.failure_reason === 'string'
              ? payload.failure_reason
              : null

  return {
    code: payload.code === undefined || payload.code === null ? null : String(payload.code),
    message,
    raw: payload,
  }
}

function stringifyGrsaiErrorPayload(raw: unknown) {
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

export function buildGrsaiRequestError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return error
  }

  const normalizedPayload = normalizeGrsaiErrorPayload(error.response?.data)
  const code = normalizedPayload.code
  const upstreamMessage = normalizedPayload.message
  const rawPayloadText = stringifyGrsaiErrorPayload(normalizedPayload.raw)
  const fallbackMessage = typeof error.message === 'string' && error.message.trim()
    ? error.message.trim()
    : 'GRSAI image generation request failed'
  const finalMessage = [
    upstreamMessage || fallbackMessage,
    error.response?.status ? `HTTP状态: ${error.response.status}` : null,
    code ? `错误码: ${code}` : null,
    !upstreamMessage && rawPayloadText ? `上游响应: ${rawPayloadText}` : null,
  ].filter(Boolean).join('\n')

  return Object.assign(new Error(finalMessage), {
    providerCode: code,
    providerMessage: upstreamMessage || fallbackMessage,
    providerStatus: error.response?.status || null,
    providerResponse: normalizedPayload.raw || null,
    isHandledProviderError: true,
  })
}

function normalizeGrsaiItems(raw: unknown): ImageGenerationItemResult[] {
  const rawResults = getRecordValue(raw, 'results')
  const rawUrl = getRecordValue(raw, 'url')
  const results = Array.isArray(rawResults)
    ? rawResults
    : typeof rawUrl === 'string'
      ? [{ url: rawUrl }]
      : []

  return results
    .filter((item): item is { url: string } => (
      Boolean(item)
      && typeof item === 'object'
      && typeof (item as Record<string, unknown>).url === 'string'
      && ((item as Record<string, unknown>).url as string).trim().length > 0
    ))
    .map((item) => ({
      url: item.url,
      size: null,
      errorCode: null,
      errorMessage: null,
    }))
}

function normalizeGrsaiUsage(raw: unknown, items: ImageGenerationItemResult[]) {
  const generatedImages = getRecordValue(raw, 'generated_images')
  return {
    generatedImages: typeof generatedImages === 'number' ? generatedImages : items.length,
    outputTokens: 0,
    totalTokens: 0,
    webSearchCalls: 0,
  }
}

function assertGrsaiSuccessEnvelope(data: unknown, action: string) {
  const code = getRecordValue(data, 'code')
  const msg = getRecordValue(data, 'msg')
  if (typeof code === 'number' && code !== 0) {
    const error = Object.assign(
      new Error(
        typeof msg === 'string' && msg.trim()
          ? msg.trim()
          : `GRSAI ${action} failed with code ${code}`,
      ),
      {
        providerCode: String(code),
        providerResponse: data,
        isHandledProviderError: true,
      },
    )
    throw error
  }
}

function parseNanoBananaSize(size: string | null | undefined) {
  const normalized = typeof size === 'string' && size.trim() ? size.trim() : 'auto'
  const [aspectRatio, imageSize] = normalized.split('@').map((item) => item.trim())

  return {
    aspectRatio: aspectRatio || 'auto',
    imageSize: imageSize || GRSAI_NANO_BANANA_DEFAULT_IMAGE_SIZE,
  }
}

export function buildGrsaiGptImageBody(input: BuildImageGenerationInput) {
  const urls = Array.isArray(input.images)
    ? input.images.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const body: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    size: input.size || '1:1',
    webHook: '-1',
    shutProgress: true,
  }

  if (urls.length > 0) {
    body.urls = urls
  }

  return body
}

export function buildGrsaiNanoBananaBody(input: BuildImageGenerationInput) {
  const urls = Array.isArray(input.images)
    ? input.images.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const { aspectRatio, imageSize } = parseNanoBananaSize(input.size)
  const body: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    aspectRatio,
    imageSize,
    webHook: '-1',
    shutProgress: true,
  }

  if (urls.length > 0) {
    body.urls = urls
  }

  return body
}

async function pollGrsaiResult(params: {
  endpoint: string
  apiKey: string
  taskId: string
}) {
  for (let attempt = 0; attempt < GRSAI_IMAGE_MAX_POLLS; attempt += 1) {
    if (attempt > 0) {
      await sleep(GRSAI_IMAGE_POLL_INTERVAL_MS)
    }

    const response = await axios.post(params.endpoint, { id: params.taskId }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      timeout: GRSAI_IMAGE_REQUEST_TIMEOUT_MS,
    })

    const data: unknown = response.data || {}
    assertGrsaiSuccessEnvelope(data, 'result polling')
    const result = getRecordValue(data, 'data') || data
    const status = getRecordValue(result, 'status')

    if (status === 'succeeded') {
      return result
    }

    if (status === 'failed') {
      const resultError = getRecordValue(result, 'error')
      const failureReason = getRecordValue(result, 'failure_reason')
      const error = Object.assign(
        new Error(
          typeof resultError === 'string'
            ? resultError
            : typeof failureReason === 'string'
              ? failureReason
              : 'GRSAI image generation failed',
        ),
        {
          providerCode: typeof failureReason === 'string' ? failureReason : null,
          providerResponse: result,
          isHandledProviderError: true,
        },
      )
      throw error
    }
  }

  throw Object.assign(
    new Error(`GRSAI image generation timed out after ${Math.round((GRSAI_IMAGE_MAX_POLLS * GRSAI_IMAGE_POLL_INTERVAL_MS) / 1000)}s`),
    {
      providerCode: 'TIMEOUT',
      isHandledProviderError: true,
    },
  )
}

async function generateGrsaiImages(params: {
  apiUrl: string
  apiKey: string
  body: Record<string, unknown>
  createPath: string
}) {
  const baseUrl = params.apiUrl.replace(/\/+$/, '')
  const createEndpoint = `${baseUrl}${params.createPath}`
  const resultEndpoint = `${baseUrl}/v1/draw/result`

  let createResponse
  try {
    createResponse = await axios.post(createEndpoint, params.body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      timeout: GRSAI_IMAGE_REQUEST_TIMEOUT_MS,
    })
  } catch (error) {
    throw buildGrsaiRequestError(error)
  }

  const createData: unknown = createResponse.data || {}
  assertGrsaiSuccessEnvelope(createData, 'task creation')
  const createDataBody = getRecordValue(createData, 'data')
  const nestedTaskId = getRecordValue(createDataBody, 'id')
  const topLevelTaskId = getRecordValue(createData, 'id')
  const taskId = typeof nestedTaskId === 'string'
    ? nestedTaskId
    : typeof topLevelTaskId === 'string'
      ? topLevelTaskId
      : null

  if (!taskId) {
    const directItems = normalizeGrsaiItems(createData)
    if (directItems.length > 0) {
      return {
        model: typeof params.body.model === 'string' ? params.body.model : '',
        createdAt: null,
        items: directItems,
        usage: normalizeGrsaiUsage(createData, directItems),
        raw: createData,
      } satisfies ImageGenerationProviderResult
    }

    throw Object.assign(
      new Error('GRSAI image generation did not return a task id'),
      {
        providerResponse: createData,
        isHandledProviderError: true,
      },
    )
  }

  let result
  try {
    result = await pollGrsaiResult({
      endpoint: resultEndpoint,
      apiKey: params.apiKey,
      taskId,
    })
  } catch (error) {
    throw buildGrsaiRequestError(error)
  }

  const items = normalizeGrsaiItems(result)
  return {
    model: typeof params.body.model === 'string' ? params.body.model : '',
    createdAt: null,
    items,
    usage: normalizeGrsaiUsage(result, items),
    raw: result,
  } satisfies ImageGenerationProviderResult
}

export function generateGrsaiGptImages(params: {
  apiUrl: string
  apiKey: string
  body: Record<string, unknown>
}) {
  return generateGrsaiImages({
    ...params,
    createPath: '/v1/draw/completions',
  })
}

export function generateGrsaiNanoBananaImages(params: {
  apiUrl: string
  apiKey: string
  body: Record<string, unknown>
}) {
  return generateGrsaiImages({
    ...params,
    createPath: '/v1/draw/nano-banana',
  })
}
