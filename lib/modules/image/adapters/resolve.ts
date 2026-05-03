import type { ImageGenerationProviderId } from '@/lib/modules/image/types'
import {
  getImageGenerationAdapterByModel,
  getImageGenerationAdapterByProviderId,
} from '@/lib/modules/image/adapters/registry'

function normalizeImageProviderId(
  providerId?: string | null,
): ImageGenerationProviderId | null {
  return providerId === 'aliyun' || providerId === 'grsai' || providerId === 'volcengine'
    ? providerId
    : null
}

export function resolveImageGenerationAdapterForTask(task: {
  model?: string | null
  providerId?: string | null
}) {
  if (task.model) {
    return getImageGenerationAdapterByModel(task.model)
  }

  return getImageGenerationAdapterByProviderId(normalizeImageProviderId(task.providerId) || 'volcengine')
}
