import axios from 'axios'
import { DEFAULT_SEEDANCE_MODEL } from '@/lib/modules/provider/seedance/models'
import { serializeSeedForUpstream } from '@/lib/modules/provider/seedance/seed'

export const DEFAULT_ARK_API_URL = 'https://ark.cn-beijing.volces.com'
const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 500
const SAFETY_IDENTIFIER_PREFIX = 'user:'

export type ArkTaskStatus =
  | 'queued'
  | 'running'
  | 'cancelled'
  | 'succeeded'
  | 'failed'
  | 'expired'

type ArkError = {
  code?: string
  message?: string
} | null

type ArkTaskContent = {
  video_url?: string
  last_frame_url?: string
} | null

type ArkTaskUsage = {
  completion_tokens?: number
  total_tokens?: number
  tool_usage?: {
    web_search?: number
  }
} | null

export interface ArkTask {
  id: string
  model: string
  status: ArkTaskStatus | string
  error?: ArkError
  created_at: number
  updated_at: number
  content?: ArkTaskContent
  seed?: number
  resolution?: string
  ratio?: string
  duration?: number
  frames?: number
  framespersecond?: number
  generate_audio?: boolean
  safety_identifier?: string
  service_tier?: string
  execution_expires_after?: number
  usage?: ArkTaskUsage
}

export interface NormalizedArkTask {
  id: string
  task_id: string
  model: string
  status: string
  created_at: number
  updated_at: number
  video_path: string | null
  last_frame_url: string | null
  completion_tokens: number
  total_tokens: number
  cost: number | null
  error_message: string | null
  seed: number
  resolution: string
  ratio: string
  duration: number | null
  frames: number | null
  framespersecond: number | null
  generate_audio: boolean | null
  safety_identifier: string | null
  user_id: string | null
  service_tier: string | null
  execution_expires_after: number | null
  raw: ArkTask
}

export type LocalGenerationMode =
  | 'text_to_video'
  | 'first_frame'
  | 'first_last_frame'
  | 'first_clip'
  | 'reference'

type CreateArkTaskParams = {
  apiUrl: string
  apiKey: string
  body: Record<string, unknown>
}

type ListArkTasksParams = {
  apiUrl: string
  apiKey: string
  pageNum?: number
  pageSize?: number
  status?: string
  taskIds?: string[]
  model?: string
  serviceTier?: string
}

type BuildArkRequestInput = {
  model: string
  mode: LocalGenerationMode
  prompt: string
  ratio?: string
  duration?: number
  resolution?: string
  watermark?: boolean
  generateAudio?: boolean
  seed: bigint
  firstFrameUrl?: string | null
  lastFrameUrl?: string | null
  firstClipUrl?: string | null
  referenceImageUrls?: string[]
  referenceVideoUrls?: string[]
  referenceAudioUrls?: string[]
  safetyIdentifier?: string
  returnLastFrame?: boolean
  callbackUrl?: string | null
}

function createJsonHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function normalizeApiUrl(apiUrl: string) {
  return apiUrl.trim().replace(/\/+$/, '') || DEFAULT_ARK_API_URL
}

function clampPageSize(pageSize: number | undefined) {
  if (!pageSize || Number.isNaN(pageSize)) {
    return DEFAULT_PAGE_SIZE
  }
  return Math.max(1, Math.min(MAX_PAGE_SIZE, pageSize))
}

function buildListQueryString(params: Omit<ListArkTasksParams, 'apiUrl' | 'apiKey'>) {
  const query = new URLSearchParams()
  query.set('page_num', String(params.pageNum || 1))
  query.set('page_size', String(clampPageSize(params.pageSize)))

  if (params.status) {
    query.set('filter.status', params.status)
  }
  if (params.model) {
    query.set('filter.model', params.model)
  }
  if (params.serviceTier) {
    query.set('filter.service_tier', params.serviceTier)
  }
  for (const taskId of params.taskIds || []) {
    if (taskId) {
      query.append('filter.task_ids', taskId)
    }
  }

  return query.toString()
}

function normalizeNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function buildSafetyIdentifier(userId: string) {
  return `${SAFETY_IDENTIFIER_PREFIX}${userId}`
}

export function extractUserIdFromSafetyIdentifier(safetyIdentifier: string | null | undefined) {
  if (!safetyIdentifier?.startsWith(SAFETY_IDENTIFIER_PREFIX)) {
    return null
  }

  const userId = safetyIdentifier.slice(SAFETY_IDENTIFIER_PREFIX.length).trim()
  return userId || null
}

export function mapArkStatusToLocal(status: string) {
  if (status === 'running') return 'processing'
  return status
}

export function normalizeArkTask(task: ArkTask): NormalizedArkTask {
  const completionTokens = normalizeNumber(task.usage?.completion_tokens)
  const totalTokens = normalizeNumber(task.usage?.total_tokens, completionTokens)
  const seed = normalizeNumber(task.seed, -1)

  return {
    id: task.id,
    task_id: task.id,
    model: task.model || DEFAULT_SEEDANCE_MODEL,
    status: task.status,
    created_at: normalizeNumber(task.created_at),
    updated_at: normalizeNumber(task.updated_at),
    video_path: task.content?.video_url || null,
    last_frame_url: task.content?.last_frame_url || null,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    cost: null,
    error_message: task.error?.message || null,
    seed,
    resolution: task.resolution || '720p',
    ratio: task.ratio || 'adaptive',
    duration: typeof task.duration === 'number' ? task.duration : null,
    frames: typeof task.frames === 'number' ? task.frames : null,
    framespersecond: typeof task.framespersecond === 'number' ? task.framespersecond : null,
    generate_audio: typeof task.generate_audio === 'boolean' ? task.generate_audio : null,
    safety_identifier: task.safety_identifier || null,
    user_id: extractUserIdFromSafetyIdentifier(task.safety_identifier),
    service_tier: task.service_tier || null,
    execution_expires_after:
      typeof task.execution_expires_after === 'number' ? task.execution_expires_after : null,
    raw: task,
  }
}

export function getTaskGenerationTimeSeconds(task: { created_at?: number | null; updated_at?: number | null }) {
  if (
    typeof task.created_at !== 'number' ||
    typeof task.updated_at !== 'number' ||
    !Number.isFinite(task.created_at) ||
    !Number.isFinite(task.updated_at)
  ) {
    return null
  }

  return Math.max(0, Math.floor(task.updated_at - task.created_at))
}

export function buildArkCreateBody(input: BuildArkRequestInput) {
  const content: Array<Record<string, unknown>> = []
  const prompt = input.prompt.trim()

  if (prompt) {
    content.push({
      type: 'text',
      text: prompt,
    })
  }

  if (input.mode === 'first_frame') {
    if (!input.firstFrameUrl) {
      throw new Error('首帧生视频缺少首帧图片')
    }
    content.push({
      type: 'image_url',
      image_url: { url: input.firstFrameUrl },
      role: 'first_frame',
    })
  } else if (input.mode === 'first_last_frame') {
    if (!input.firstFrameUrl || !input.lastFrameUrl) {
      throw new Error('首尾帧生视频需要同时提供首帧和尾帧图片')
    }
    content.push(
      {
        type: 'image_url',
        image_url: { url: input.firstFrameUrl },
        role: 'first_frame',
      },
      {
        type: 'image_url',
        image_url: { url: input.lastFrameUrl },
        role: 'last_frame',
      }
    )
  } else if (input.mode === 'reference') {
    const referenceImageUrls = input.referenceImageUrls || []
    const referenceVideoUrls = input.referenceVideoUrls || []
    const referenceAudioUrls = input.referenceAudioUrls || []

    if (referenceAudioUrls.length > 0 && referenceImageUrls.length === 0 && referenceVideoUrls.length === 0) {
      throw new Error('参考生视频模式下，音频不能单独使用，至少需要搭配一张图片或一段视频')
    }

    for (const url of referenceImageUrls) {
      content.push({
        type: 'image_url',
        image_url: { url },
        role: 'reference_image',
      })
    }
    for (const url of referenceVideoUrls) {
      content.push({
        type: 'video_url',
        video_url: { url },
        role: 'reference_video',
      })
    }
    for (const url of referenceAudioUrls) {
      content.push({
        type: 'audio_url',
        audio_url: { url },
        role: 'reference_audio',
      })
    }
  }

  if (content.length === 0) {
    throw new Error('创建任务缺少有效输入内容')
  }

  return {
    model: input.model,
    content,
    generate_audio: input.generateAudio !== false,
    ratio: input.ratio || 'adaptive',
    duration: typeof input.duration === 'number' ? input.duration : 5,
    resolution: input.resolution || '720p',
    watermark: Boolean(input.watermark),
    seed: serializeSeedForUpstream(input.seed),
    safety_identifier: input.safetyIdentifier,
    return_last_frame: Boolean(input.returnLastFrame),
    ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
  }
}

export async function createArkTask(params: CreateArkTaskParams) {
  const response = await axios.post<{ id: string }>(
    `${normalizeApiUrl(params.apiUrl)}/api/v3/contents/generations/tasks`,
    params.body,
    {
      headers: createJsonHeaders(params.apiKey),
      timeout: 30000,
    }
  )

  return response.data
}

export async function getArkTask(apiUrl: string, apiKey: string, taskId: string) {
  const response = await axios.get<ArkTask>(
    `${normalizeApiUrl(apiUrl)}/api/v3/contents/generations/tasks/${taskId}`,
    {
      headers: createJsonHeaders(apiKey),
      timeout: 30000,
    }
  )

  return response.data
}

export async function deleteArkTask(apiUrl: string, apiKey: string, taskId: string) {
  await axios.delete(
    `${normalizeApiUrl(apiUrl)}/api/v3/contents/generations/tasks/${taskId}`,
    {
      headers: createJsonHeaders(apiKey),
      timeout: 30000,
    }
  )
}

export async function listArkTasks(params: ListArkTasksParams) {
  const query = buildListQueryString({
    pageNum: params.pageNum,
    pageSize: params.pageSize,
    status: params.status,
    taskIds: params.taskIds,
    model: params.model,
    serviceTier: params.serviceTier,
  })

  const response = await axios.get<{ items?: ArkTask[]; total?: number }>(
    `${normalizeApiUrl(params.apiUrl)}/api/v3/contents/generations/tasks?${query}`,
    {
      headers: createJsonHeaders(params.apiKey),
      timeout: 30000,
    }
  )

  return {
    items: response.data.items || [],
    total: normalizeNumber(response.data.total, (response.data.items || []).length),
  }
}

export async function listAllArkTasks(params: Omit<ListArkTasksParams, 'pageNum'>) {
  const pageSize = clampPageSize(params.pageSize)
  const allItems: ArkTask[] = []
  let pageNum = 1
  let total = 0

  while (pageNum <= 500) {
    const page = await listArkTasks({
      ...params,
      pageNum,
      pageSize,
    })

    if (pageNum === 1) {
      total = page.total
    }

    allItems.push(...page.items)

    if (allItems.length >= total || page.items.length === 0) {
      break
    }

    pageNum += 1
  }

  return {
    items: allItems,
    total,
  }
}
