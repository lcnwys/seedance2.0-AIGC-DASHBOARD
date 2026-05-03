import type { ImageGenerationAdapter } from '@/lib/modules/image/adapters/types'
import {
  buildVolcengineImagesV1Body,
  generateVolcengineImagesV1,
} from '@/lib/modules/image/adapters/volcengine-images-v1-shared'

export const volcengineImagesV1Adapter: ImageGenerationAdapter = {
  id: 'volcengine',
  label: 'Volcengine Seedream',
  defaultApiUrl: 'https://ark.cn-beijing.volces.com',
  protocol: 'volcengine-images-v1',
  providerId: 'volcengine',
  buildGenerateBody(input) {
    return buildVolcengineImagesV1Body(input)
  },
  async generateImages(params) {
    return generateVolcengineImagesV1(params)
  },
}
