import type {
  VideoGenerationProvider,
  VideoGenerationProviderId,
} from '@/lib/modules/provider/types'
import type { VideoModelProviderProtocol } from '@/lib/modules/video/models'

export type VideoGenerationAdapter = VideoGenerationProvider & {
  protocol: VideoModelProviderProtocol
  providerId: VideoGenerationProviderId
}
