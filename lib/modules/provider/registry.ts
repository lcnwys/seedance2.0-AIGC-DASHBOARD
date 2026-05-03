import type { VideoGenerationProvider, VideoGenerationProviderId } from '@/lib/modules/provider/types'
import { aliyunWan27VideoAdapter } from '@/lib/modules/video/adapters/aliyun-wan-27-video'
import { volcengineSeedanceV1Adapter } from '@/lib/modules/video/adapters/volcengine-seedance-v1'

export const DEFAULT_VIDEO_PROVIDER_ID: VideoGenerationProviderId = 'volcengine'

const VIDEO_PROVIDERS: Record<VideoGenerationProviderId, VideoGenerationProvider> = {
  aliyun: aliyunWan27VideoAdapter,
  volcengine: volcengineSeedanceV1Adapter,
}

export function getVideoGenerationProvider(
  providerId: VideoGenerationProviderId = DEFAULT_VIDEO_PROVIDER_ID
): VideoGenerationProvider {
  return VIDEO_PROVIDERS[providerId]
}

export function getDefaultVideoProvider(): VideoGenerationProvider {
  return getVideoGenerationProvider(DEFAULT_VIDEO_PROVIDER_ID)
}

export function getAllVideoGenerationProviders(): VideoGenerationProvider[] {
  return Object.values(VIDEO_PROVIDERS)
}
