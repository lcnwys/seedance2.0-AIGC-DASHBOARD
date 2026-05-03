import { aliyunWan27ImageAdapter } from '@/lib/modules/image/adapters/aliyun-wan-27'
import { grsaiGptImageAdapter } from '@/lib/modules/image/adapters/grsai-gpt-image'
import { volcengineImagesV1Adapter } from '@/lib/modules/image/adapters/volcengine-images-v1'
import type { ImageGenerationProvider, ImageGenerationProviderId } from '@/lib/modules/image/types'

export const DEFAULT_IMAGE_PROVIDER_ID: ImageGenerationProviderId = 'volcengine'

const IMAGE_PROVIDERS: Record<ImageGenerationProviderId, ImageGenerationProvider> = {
  aliyun: aliyunWan27ImageAdapter,
  grsai: grsaiGptImageAdapter,
  volcengine: volcengineImagesV1Adapter,
}

export function getImageGenerationProvider(
  providerId: ImageGenerationProviderId = DEFAULT_IMAGE_PROVIDER_ID,
): ImageGenerationProvider {
  return IMAGE_PROVIDERS[providerId]
}

export function getAllImageGenerationProviders(): ImageGenerationProvider[] {
  return Object.values(IMAGE_PROVIDERS)
}
