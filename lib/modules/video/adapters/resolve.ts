import type { VideoGenerationProviderId } from '@/lib/modules/provider/types'
import {
  getVideoGenerationAdapterByModel,
  getVideoGenerationAdapterByProviderId,
} from '@/lib/modules/video/adapters/registry'

export function resolveVideoGenerationAdapterForTask(task: {
  model?: string | null
  providerId?: VideoGenerationProviderId | null
}) {
  if (task.model) {
    return getVideoGenerationAdapterByModel(task.model)
  }

  return getVideoGenerationAdapterByProviderId(task.providerId || 'volcengine')
}
