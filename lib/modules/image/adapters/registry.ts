import type { ImageGenerationProviderId } from '@/lib/modules/image/types'
import {
  getImageModelConfig,
  type ImageModelProviderProtocol,
} from '@/lib/modules/image/models'
import type { ImageGenerationAdapter } from '@/lib/modules/image/adapters/types'
import { aliyunDashscopeImageAdapter } from '@/lib/modules/image/adapters/aliyun-dashscope-image'
import { aliyunWan27ImageAdapter } from '@/lib/modules/image/adapters/aliyun-wan-27'
import { grsaiGptImageAdapter } from '@/lib/modules/image/adapters/grsai-gpt-image'
import { grsaiNanoBananaAdapter } from '@/lib/modules/image/adapters/grsai-nano-banana'
import { volcengineImagesV1Adapter } from '@/lib/modules/image/adapters/volcengine-images-v1'

const IMAGE_PROTOCOL_ADAPTERS: Record<ImageModelProviderProtocol, ImageGenerationAdapter> = {
  'aliyun-wan-27': aliyunWan27ImageAdapter,
  'aliyun-dashscope-image': aliyunDashscopeImageAdapter,
  'grsai-gpt-image': grsaiGptImageAdapter,
  'grsai-nano-banana': grsaiNanoBananaAdapter,
  'volcengine-images-v1': volcengineImagesV1Adapter,
}

const IMAGE_ADAPTERS_BY_PROVIDER_ID: Record<ImageGenerationProviderId, ImageGenerationAdapter> = {
  aliyun: IMAGE_PROTOCOL_ADAPTERS['aliyun-wan-27'],
  grsai: IMAGE_PROTOCOL_ADAPTERS['grsai-gpt-image'],
  volcengine: IMAGE_PROTOCOL_ADAPTERS['volcengine-images-v1'],
}

export const DEFAULT_IMAGE_PROTOCOL: ImageModelProviderProtocol = 'volcengine-images-v1'

export function getImageGenerationAdapter(
  protocol: ImageModelProviderProtocol = DEFAULT_IMAGE_PROTOCOL,
): ImageGenerationAdapter {
  return IMAGE_PROTOCOL_ADAPTERS[protocol]
}

export function getImageGenerationAdapterByModel(model?: string | null): ImageGenerationAdapter {
  return getImageGenerationAdapter(getImageModelConfig(model).providerProtocol)
}

export function getImageGenerationAdapterByProviderId(
  providerId: ImageGenerationProviderId = 'volcengine',
): ImageGenerationAdapter {
  return IMAGE_ADAPTERS_BY_PROVIDER_ID[providerId]
}
