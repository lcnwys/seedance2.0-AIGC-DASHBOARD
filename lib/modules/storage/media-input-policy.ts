import type { ProviderGenerationMode } from '@/lib/modules/provider/types'
import {
  HAPPYHORSE_I2V_MODEL_ID,
  HAPPYHORSE_R2V_MODEL_ID,
  HAPPYHORSE_T2V_MODEL_ID,
  HAPPYHORSE_VIDEO_EDIT_MODEL_ID,
  getVideoModelConfig,
  isHappyHorseVideoModel,
  isWan27VideoModel,
} from '@/lib/modules/video/models'
import { getImageModelConfig } from '@/lib/modules/image/models'

export const INLINE_IMAGE_MAX_BYTES = 20 * 1024 * 1024

export function isInlineBase64ImageUrl(value: unknown): value is string {
  return typeof value === 'string'
    && /^data:image\/(?:jpeg|jpg|png|webp|bmp);base64,[A-Za-z0-9+/=\s]+$/i.test(value.trim())
}

export function estimateInlineBase64Bytes(value: string) {
  const commaIndex = value.indexOf(',')
  const payload = commaIndex >= 0 ? value.slice(commaIndex + 1) : value
  const normalized = payload.replace(/\s/g, '')
  return Math.floor((normalized.length * 3) / 4)
}

export function modelAllowsInlineImageReferences(model: string | null | undefined) {
  const config = getImageModelConfig(model)
  return config.providerId === 'volcengine' || config.providerId === 'aliyun'
}

export function videoModeAllowsNoStorageImageInputs(
  model: string | null | undefined,
  mode: ProviderGenerationMode,
) {
  const config = getVideoModelConfig(model)

  if (mode === 'text_to_video') {
    return true
  }

  if (config.providerId === 'volcengine') {
    return mode === 'first_frame' || mode === 'first_last_frame' || mode === 'reference'
  }

  if (isHappyHorseVideoModel(config.id)) {
    return config.id === HAPPYHORSE_T2V_MODEL_ID
  }

  if (isWan27VideoModel(config.id)) {
    if (config.id === 'wan2.7-r2v') {
      return mode === 'reference'
    }

    return config.id !== 'wan2.7-videoedit'
      && mode !== 'first_clip'
      && mode !== 'video_edit'
  }

  return false
}

export function modelRequiresObjectStorageForVideoMedia(model: string | null | undefined) {
  const config = getVideoModelConfig(model)
  return config.id === HAPPYHORSE_I2V_MODEL_ID
    || config.id === HAPPYHORSE_R2V_MODEL_ID
    || config.id === HAPPYHORSE_VIDEO_EDIT_MODEL_ID
    || config.id === 'wan2.7-videoedit'
}
