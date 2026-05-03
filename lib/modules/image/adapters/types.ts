import type { ImageModelProviderProtocol } from '@/lib/modules/image/models'
import type {
  ImageGenerationProvider,
  ImageGenerationProviderId,
} from '@/lib/modules/image/types'

export type ImageGenerationAdapter = ImageGenerationProvider & {
  protocol: ImageModelProviderProtocol
  providerId: ImageGenerationProviderId
}
