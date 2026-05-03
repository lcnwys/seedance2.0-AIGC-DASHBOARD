import type { VideoGenerationProviderId } from '@/lib/modules/provider/types'
import {
  getVideoModelConfig,
  type VideoModelProviderProtocol,
} from '@/lib/modules/video/models'
import type { VideoGenerationAdapter } from '@/lib/modules/video/adapters/types'
import { aliyunWan27VideoAdapter } from '@/lib/modules/video/adapters/aliyun-wan-27-video'
import { volcengineSeedanceV1Adapter } from '@/lib/modules/video/adapters/volcengine-seedance-v1'

const VIDEO_PROTOCOL_ADAPTERS: Record<VideoModelProviderProtocol, VideoGenerationAdapter> = {
  'aliyun-wan-27-video': aliyunWan27VideoAdapter,
  'volcengine-seedance-v1': volcengineSeedanceV1Adapter,
}

const VIDEO_ADAPTERS_BY_PROVIDER_ID: Record<VideoGenerationProviderId, VideoGenerationAdapter> = {
  aliyun: VIDEO_PROTOCOL_ADAPTERS['aliyun-wan-27-video'],
  volcengine: VIDEO_PROTOCOL_ADAPTERS['volcengine-seedance-v1'],
}

export const DEFAULT_VIDEO_PROTOCOL: VideoModelProviderProtocol = 'volcengine-seedance-v1'

export function getVideoGenerationAdapter(
  protocol: VideoModelProviderProtocol = DEFAULT_VIDEO_PROTOCOL
): VideoGenerationAdapter {
  return VIDEO_PROTOCOL_ADAPTERS[protocol]
}

export function getVideoGenerationAdapterByModel(model?: string | null): VideoGenerationAdapter {
  return getVideoGenerationAdapter(getVideoModelConfig(model).providerProtocol)
}

export function getVideoGenerationAdapterByProviderId(
  providerId: VideoGenerationProviderId = 'volcengine'
): VideoGenerationAdapter {
  return VIDEO_ADAPTERS_BY_PROVIDER_ID[providerId]
}

export function getDefaultVideoGenerationAdapter(): VideoGenerationAdapter {
  return getVideoGenerationAdapter(DEFAULT_VIDEO_PROTOCOL)
}
