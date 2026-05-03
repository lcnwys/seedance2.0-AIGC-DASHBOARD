export type VideoGenerationProviderId = 'volcengine' | 'aliyun'

export type ProviderTaskStatus =
  | 'queued'
  | 'running'
  | 'cancelled'
  | 'succeeded'
  | 'failed'
  | 'expired'
  | string

export type ProviderGenerationMode =
  | 'text_to_video'
  | 'first_frame'
  | 'first_last_frame'
  | 'first_clip'
  | 'reference'
  | 'video_edit'

export interface ProviderNormalizedTask {
  id: string
  task_id: string
  model: string
  status: ProviderTaskStatus
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
  raw: unknown
}

export interface BuildProviderCreateTaskInput {
  model: string
  mode: ProviderGenerationMode
  prompt: string
  ratio?: string
  duration?: number
  resolution?: string
  watermark?: boolean
  generateAudio?: boolean
  promptExtend?: boolean
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

export interface ProviderApiCredentials {
  apiUrl: string
  apiKey: string
}

export interface ProviderListTasksInput extends ProviderApiCredentials {
  pageNum?: number
  pageSize?: number
  status?: string
  taskIds?: string[]
  model?: string
  serviceTier?: string
}

export interface VideoGenerationProvider {
  id: VideoGenerationProviderId
  label: string
  defaultApiUrl: string
  buildSafetyIdentifier(userId: string): string
  buildCreateTaskBody(input: BuildProviderCreateTaskInput): Record<string, unknown>
  createTask(params: ProviderApiCredentials & { body: Record<string, unknown> }): Promise<{ id: string }>
  getTask(params: ProviderApiCredentials & { taskId: string; model?: string | null }): Promise<ProviderNormalizedTask>
  deleteTask(params: ProviderApiCredentials & { taskId: string }): Promise<void>
  listTasks(params: ProviderListTasksInput): Promise<{ items: ProviderNormalizedTask[]; total: number }>
  listAllTasks(params: Omit<ProviderListTasksInput, 'pageNum'>): Promise<{ items: ProviderNormalizedTask[]; total: number }>
  normalizeIncomingTask(payload: unknown): ProviderNormalizedTask
  mapStatusToLocal(status: string): string
  getTaskGenerationTimeSeconds(task: {
    created_at?: number | null
    updated_at?: number | null
  }): number | null
}
