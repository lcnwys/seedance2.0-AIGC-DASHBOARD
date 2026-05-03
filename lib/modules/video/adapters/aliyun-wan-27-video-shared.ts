import type {
  BuildProviderCreateTaskInput,
  ProviderNormalizedTask,
} from '@/lib/modules/provider/types'

const HAPPYHORSE_T2V_MODEL_ID = 'happyhorse-1.0-t2v'
const HAPPYHORSE_I2V_MODEL_ID = 'happyhorse-1.0-i2v'
const HAPPYHORSE_R2V_MODEL_ID = 'happyhorse-1.0-r2v'
const HAPPYHORSE_VIDEO_EDIT_MODEL_ID = 'happyhorse-1.0-video-edit'
const HAPPYHORSE_VIDEO_MODEL_IDS = [
  HAPPYHORSE_T2V_MODEL_ID,
  HAPPYHORSE_I2V_MODEL_ID,
  HAPPYHORSE_R2V_MODEL_ID,
  HAPPYHORSE_VIDEO_EDIT_MODEL_ID,
] as const

type AliyunTaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN' | string

type AliyunListTaskItem = {
  task_id?: string
  task_status?: AliyunTaskStatus
  submit_time?: string
  scheduled_time?: string
  end_time?: string
  orig_prompt?: string
  video_url?: string
  model?: string
  request_id?: string
  code?: string
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
  request_id?: string
  code?: string
  message?: string
}

function normalizeLocalResolution(
  usage: AliyunTaskResponse['usage'],
  fallbackResolution: string | null | undefined
) {
  if (usage?.SR === 1080) return '1080p'
  if (usage?.SR === 720) return '720p'
  return fallbackResolution?.toLowerCase() === '1080p' ? '1080p' : '720p'
}

function parseAliyunTimestamp(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.trim().replace(' ', 'T')
  const withTimezone = normalized.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}+08:00`
  const timestamp = Date.parse(withTimezone)
  if (!Number.isFinite(timestamp)) {
    return null
  }
  return Math.floor(timestamp / 1000)
}

function calculateAliyunCostYuan(task: AliyunTaskResponse, model: string | null | undefined) {
  if (!model) {
    return null
  }

  const sr = task.usage?.SR
  const resolution = sr === 1080 ? '1080p' : '720p'
  const outputDuration =
    typeof task.usage?.output_video_duration === 'number'
      ? task.usage.output_video_duration
      : typeof task.usage?.duration === 'number'
        ? task.usage.duration
        : null
  const totalDuration =
    typeof task.usage?.duration === 'number'
      ? task.usage.duration
      : null
  const inputVideoDuration =
    typeof task.usage?.input_video_duration === 'number'
      ? task.usage.input_video_duration
      : null
  const billableDuration =
    typeof totalDuration === 'number'
      && typeof inputVideoDuration === 'number'
      && typeof outputDuration === 'number'
      && totalDuration > outputDuration
      ? totalDuration
      : outputDuration

  if (typeof billableDuration !== 'number' || !Number.isFinite(billableDuration)) {
    return null
  }

  const rate = isHappyHorseVideoModel(model)
    ? (resolution === '1080p' ? 1.6 : 0.9)
    : (sr === 1080 ? 1.0 : 0.6)
  return Number((billableDuration * rate).toFixed(6))
}

function isHappyHorseVideoModel(model: string | null | undefined): boolean {
  return HAPPYHORSE_VIDEO_MODEL_IDS.includes(model as (typeof HAPPYHORSE_VIDEO_MODEL_IDS)[number])
}

export function normalizeAliyunWan27VideoTask(
  task: AliyunTaskResponse,
  fallbackModel?: string | null,
): ProviderNormalizedTask {
  const output = task.output || {}
  const model = output.model || fallbackModel || 'wan2.7-r2v'
  const createdAt = parseAliyunTimestamp(output.submit_time) ?? 0
  const updatedAt =
    parseAliyunTimestamp(output.end_time)
    ?? parseAliyunTimestamp(output.scheduled_time)
    ?? createdAt

  return {
    id: output.task_id || '',
    task_id: output.task_id || '',
    model,
    status: output.task_status || 'UNKNOWN',
    created_at: createdAt,
    updated_at: updatedAt,
    video_path: output.video_url || null,
    last_frame_url: null,
    completion_tokens: 0,
    total_tokens: 0,
    cost: calculateAliyunCostYuan(task, model),
    error_message: output.message || task.message || null,
    seed: -1,
    resolution: normalizeLocalResolution(task.usage, null),
    ratio: task.usage?.ratio || '16:9',
    duration:
      typeof task.usage?.output_video_duration === 'number'
        ? task.usage.output_video_duration
        : typeof task.usage?.duration === 'number'
          ? task.usage.duration
          : null,
    frames: null,
    framespersecond: null,
    generate_audio: true,
    safety_identifier: null,
    user_id: null,
    service_tier: null,
    execution_expires_after: null,
    raw: task,
  }
}

function normalizeAliyunResolution(resolution: string | null | undefined) {
  return resolution?.toLowerCase() === '1080p' ? '1080P' : '720P'
}

function buildHappyHorseMedia(input: BuildProviderCreateTaskInput) {
  const referenceImageUrls = input.referenceImageUrls || []
  const referenceVideoUrls = input.referenceVideoUrls || []
  const referenceAudioUrls = input.referenceAudioUrls || []

  if (referenceAudioUrls.length > 0) {
    throw new Error('HappyHorse 当前不支持音频参考素材')
  }

  if (input.model === HAPPYHORSE_T2V_MODEL_ID) {
    if (input.mode !== 'text_to_video') {
      throw new Error('HappyHorse 文生视频仅支持文生视频模式')
    }

    if (referenceImageUrls.length > 0 || referenceVideoUrls.length > 0) {
      throw new Error('HappyHorse 文生视频不支持传入参考图片或参考视频')
    }

    return []
  }

  if (input.model === HAPPYHORSE_I2V_MODEL_ID) {
    if (input.mode !== 'first_frame') {
      throw new Error('HappyHorse 图生视频仅支持首帧生成模式')
    }

    if (!input.firstFrameUrl) {
      throw new Error('HappyHorse 图生视频需要 1 张首帧图片')
    }

    if (referenceImageUrls.length > 1 || referenceVideoUrls.length > 0) {
      throw new Error('HappyHorse 图生视频仅支持 1 张首帧图片')
    }

    return [{
      type: 'first_frame',
      url: input.firstFrameUrl,
    }]
  }

  if (input.model === HAPPYHORSE_VIDEO_EDIT_MODEL_ID) {
    if (input.mode !== 'video_edit') {
      throw new Error('HappyHorse 视频编辑仅支持视频编辑模式')
    }

    if (referenceVideoUrls.length !== 1) {
      throw new Error('HappyHorse 视频编辑需要且仅支持 1 段待编辑视频')
    }

    if (referenceImageUrls.length > 5) {
      throw new Error('HappyHorse 视频编辑最多支持 5 张参考图片')
    }

    return [
      {
        type: 'video',
        url: referenceVideoUrls[0],
      },
      ...referenceImageUrls.map((url) => ({
        type: 'reference_image',
        url,
      })),
    ]
  }

  if (input.mode !== 'reference') {
    throw new Error('HappyHorse 参考生视频仅支持参考生视频模式')
  }

  if (referenceImageUrls.length < 1) {
    throw new Error('HappyHorse 参考生视频至少需要 1 张参考图片')
  }

  if (referenceImageUrls.length > 9) {
    throw new Error('HappyHorse 参考生视频最多支持 9 张参考图片')
  }

  if (referenceVideoUrls.length > 0) {
    throw new Error('HappyHorse 参考生视频不支持参考视频')
  }

  return referenceImageUrls.map((url) => ({
    type: 'reference_image',
    url,
  }))
}

function buildAliyunMedia(input: BuildProviderCreateTaskInput) {
  const media: Array<{ type: string; url: string }> = []
  const isWanImageToVideoModel = input.model === 'wan2.7-i2v'

  if (isHappyHorseVideoModel(input.model)) {
    return buildHappyHorseMedia(input)
  }

  if (input.mode === 'video_edit') {
    const inputVideoUrl = (input.referenceVideoUrls || [])[0]
    const referenceImageUrls = input.referenceImageUrls || []

    if (!inputVideoUrl) {
      throw new Error('万相 Wan 2.7 视频编辑需要且仅支持 1 段待编辑视频')
    }

    if ((input.referenceVideoUrls || []).length !== 1) {
      throw new Error('万相 Wan 2.7 视频编辑需要且仅支持 1 段待编辑视频')
    }

    if ((input.referenceAudioUrls || []).length > 0) {
      throw new Error('万相 Wan 2.7 视频编辑当前不支持音频参考素材')
    }

    if (referenceImageUrls.length > 4) {
      throw new Error('万相 Wan 2.7 视频编辑最多支持 4 张参考图片')
    }

    media.push({
      type: 'video',
      url: inputVideoUrl,
    })

    for (const url of referenceImageUrls) {
      media.push({ type: 'reference_image', url })
    }

    return media
  }

  if (input.mode === 'first_frame') {
    if (!input.firstFrameUrl) {
      throw new Error('万相 Wan 2.7 首帧模式缺少首帧图片')
    }

    media.push({
      type: 'first_frame',
      url: input.firstFrameUrl,
    })

    return media
  }

  if (input.mode === 'first_last_frame') {
    if (!isWanImageToVideoModel) {
      throw new Error('当前万相模型不支持首尾帧模式')
    }

    if (!input.firstFrameUrl || !input.lastFrameUrl) {
      throw new Error('万相 Wan 2.7 首尾帧模式需要同时提供首帧和尾帧图片')
    }

    media.push(
      {
        type: 'first_frame',
        url: input.firstFrameUrl,
      },
      {
        type: 'last_frame',
        url: input.lastFrameUrl,
      },
    )

    return media
  }

  if (input.mode === 'first_clip') {
    if (!isWanImageToVideoModel) {
      throw new Error('当前万相模型不支持视频续写模式')
    }

    if (!input.firstClipUrl) {
      throw new Error('万相 Wan 2.7 视频续写模式缺少首段视频')
    }

    media.push({
      type: 'first_clip',
      url: input.firstClipUrl,
    })

    if (input.lastFrameUrl) {
      media.push({
        type: 'last_frame',
        url: input.lastFrameUrl,
      })
    }

    return media
  }

  if (input.mode === 'text_to_video') {
    if ((input.referenceImageUrls || []).length > 0 || (input.referenceVideoUrls || []).length > 0) {
      throw new Error('万相 Wan 2.7 文生视频不支持传入参考图片或参考视频')
    }

    if ((input.referenceAudioUrls || []).length > 0) {
      throw new Error('万相 Wan 2.7 文生视频当前不支持音频参考素材')
    }

    return media
  }

  for (const url of input.referenceImageUrls || []) {
    media.push({ type: 'reference_image', url })
  }

  for (const url of input.referenceVideoUrls || []) {
    media.push({ type: 'reference_video', url })
  }

  const referenceCount = media.filter((item) => item.type !== 'first_frame').length
  if (referenceCount === 0) {
    throw new Error('万相 Wan 2.7 参考生视频至少需要 1 张参考图片或 1 段参考视频')
  }

  if (referenceCount > 5) {
    throw new Error('万相 Wan 2.7 最多支持 5 个图片/视频参考素材')
  }

  return media
}

export function buildAliyunWan27CreateTaskBody(input: BuildProviderCreateTaskInput) {
  const media = buildAliyunMedia(input)
  const referenceVoice = (input.referenceAudioUrls || [])[0]
  const isHappyHorseModel = isHappyHorseVideoModel(input.model)
  const isHappyHorseVideoEditModel = input.model === HAPPYHORSE_VIDEO_EDIT_MODEL_ID
  const includeRatio = input.model !== 'wan2.7-i2v'
    && input.model !== HAPPYHORSE_I2V_MODEL_ID
    && !isHappyHorseVideoEditModel

  return {
    model: input.model,
    input: {
      prompt: input.prompt.trim(),
      ...(media.length > 0 || !isHappyHorseModel ? { media } : {}),
      ...(referenceVoice ? { reference_voice: referenceVoice } : {}),
    },
    parameters: {
      resolution: normalizeAliyunResolution(input.resolution),
      ...(includeRatio ? { ratio: input.ratio || '16:9' } : {}),
      ...(isHappyHorseVideoEditModel ? {} : {
        duration: typeof input.duration === 'number'
          ? input.duration
          : input.mode === 'video_edit'
            ? 0
            : 5,
      }),
      ...(input.mode === 'video_edit' ? { audio_setting: 'auto' } : {}),
      ...(isHappyHorseModel ? {} : { prompt_extend: input.promptExtend !== false }),
      watermark: Boolean(input.watermark),
      ...(typeof input.seed === 'bigint' && input.seed >= BigInt(0)
        ? { seed: Number(input.seed) }
        : {}),
    },
  }
}

export function normalizeAliyunWan27IncomingTask(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid Aliyun provider payload')
  }
  return normalizeAliyunWan27VideoTask(payload as AliyunTaskResponse)
}

export function mapAliyunWan27StatusToLocal(status: string) {
  switch (status) {
    case 'PENDING':
      return 'queued'
    case 'RUNNING':
      return 'processing'
    case 'SUCCEEDED':
      return 'succeeded'
    case 'FAILED':
      return 'failed'
    case 'CANCELED':
      return 'cancelled'
    case 'UNKNOWN':
      return 'expired'
    default:
      return status.toLowerCase()
  }
}

export function getAliyunWan27TaskGenerationTimeSeconds(task: {
  created_at?: number | null
  updated_at?: number | null
}) {
  if (
    typeof task.created_at !== 'number'
    || typeof task.updated_at !== 'number'
    || !Number.isFinite(task.created_at)
    || !Number.isFinite(task.updated_at)
  ) {
    return null
  }

  return Math.max(0, Math.floor(task.updated_at - task.created_at))
}
