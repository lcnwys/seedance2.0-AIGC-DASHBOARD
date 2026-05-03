import axios from 'axios'
import type { VideoGenerationAdapter } from '@/lib/modules/video/adapters/types'
import type {
  ProviderApiCredentials,
  ProviderListTasksInput,
  ProviderNormalizedTask,
} from '@/lib/modules/provider/types'
import {
  buildAliyunWan27CreateTaskBody,
  getAliyunWan27TaskGenerationTimeSeconds,
  mapAliyunWan27StatusToLocal,
  normalizeAliyunWan27IncomingTask,
  normalizeAliyunWan27VideoTask,
} from '@/lib/modules/video/adapters/aliyun-wan-27-video-shared'

const DEFAULT_ALIYUN_API_URL = 'https://dashscope.aliyuncs.com'

type AliyunCreateResponse = {
  output?: {
    task_id?: string
  }
  code?: string
  message?: string
}

type AliyunListTaskItem = {
  task_id?: string
  task_status?: string
  submit_time?: string
  scheduled_time?: string
  end_time?: string
  video_url?: string
  model?: string
  message?: string
}

type AliyunTaskResponse = {
  output?: AliyunListTaskItem
  usage?: {
    duration?: number
    input_video_duration?: number
    output_video_duration?: number
    video_count?: number
    SR?: number
    ratio?: string
    size?: string
  }
  code?: string
  message?: string
}

type AliyunListTasksResponse = {
  output?: {
    total_count?: number
    tasks?: AliyunListTaskItem[]
  }
}

function normalizeApiUrl(apiUrl: string | null | undefined) {
  const trimmed = apiUrl?.trim().replace(/\/+$/, '')
  return trimmed || DEFAULT_ALIYUN_API_URL
}

function buildHeaders(apiKey: string, options?: {
  asyncEnabled?: boolean
}) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...(options?.asyncEnabled ? { 'X-DashScope-Async': 'enable' } : {}),
  }
}

async function createAliyunTask(params: ProviderApiCredentials & { body: Record<string, unknown> }) {
  const response = await axios.post<AliyunCreateResponse>(
    `${normalizeApiUrl(params.apiUrl)}/api/v1/services/aigc/video-generation/video-synthesis`,
    params.body,
    {
      headers: buildHeaders(params.apiKey, {
        asyncEnabled: true,
      }),
      timeout: 30000,
    },
  )

  const taskId = response.data.output?.task_id
  if (!taskId) {
    throw new Error(response.data.message || response.data.code || 'Aliyun task creation failed')
  }

  return { id: taskId }
}

async function getAliyunTask(apiUrl: string, apiKey: string, taskId: string) {
  const response = await axios.get<AliyunTaskResponse>(
    `${normalizeApiUrl(apiUrl)}/api/v1/tasks/${taskId}`,
    {
      headers: buildHeaders(apiKey),
      timeout: 30000,
    },
  )

  return response.data
}

async function listAliyunTasks(params: ProviderListTasksInput) {
  const query = new URLSearchParams()
  query.set('page_number', String(params.pageNum || 1))
  query.set('page_size', String(params.pageSize || 20))

  if (params.status) {
    query.set('task_status', params.status)
  }

  const response = await axios.get<AliyunListTasksResponse>(
    `${normalizeApiUrl(params.apiUrl)}/api/v1/tasks?${query.toString()}`,
    {
      headers: buildHeaders(params.apiKey),
      timeout: 30000,
    },
  )

  const tasks = response.data.output?.tasks || []
  return {
    items: tasks.map((task) =>
      normalizeAliyunWan27VideoTask({
        output: task,
      }),
    ),
    total: response.data.output?.total_count || tasks.length,
  }
}

async function listAllAliyunTasks(params: Omit<ProviderListTasksInput, 'pageNum'>) {
  const pageSize = Math.max(1, Math.min(100, params.pageSize || 50))
  const allItems: ProviderNormalizedTask[] = []
  let pageNum = 1
  let total = 0

  while (pageNum <= 100) {
    const page = await listAliyunTasks({
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

export const aliyunWan27VideoAdapter: VideoGenerationAdapter = {
  id: 'aliyun',
  label: 'Aliyun DashScope Wan',
  defaultApiUrl: DEFAULT_ALIYUN_API_URL,
  protocol: 'aliyun-wan-27-video',
  providerId: 'aliyun',
  buildSafetyIdentifier() {
    return ''
  },
  buildCreateTaskBody(input) {
    return buildAliyunWan27CreateTaskBody(input)
  },
  async createTask(params) {
    return createAliyunTask(params)
  },
  async getTask(params) {
    const response = await getAliyunTask(params.apiUrl, params.apiKey, params.taskId)
    return normalizeAliyunWan27VideoTask(response, params.model)
  },
  async deleteTask(params) {
    await axios.post(
      `${normalizeApiUrl(params.apiUrl)}/api/v1/tasks/${params.taskId}/cancel`,
      {},
      {
        headers: buildHeaders(params.apiKey),
        timeout: 30000,
      },
    )
  },
  async listTasks(params) {
    return listAliyunTasks(params)
  },
  async listAllTasks(params) {
    return listAllAliyunTasks(params)
  },
  normalizeIncomingTask(payload: unknown) {
    return normalizeAliyunWan27IncomingTask(payload)
  },
  mapStatusToLocal(status: string) {
    return mapAliyunWan27StatusToLocal(status)
  },
  getTaskGenerationTimeSeconds(task) {
    return getAliyunWan27TaskGenerationTimeSeconds(task)
  },
}
