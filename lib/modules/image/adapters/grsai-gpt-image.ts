import type { ImageGenerationAdapter } from '@/lib/modules/image/adapters/types'
import { buildGrsaiGptImageBody, generateGrsaiGptImages } from '@/lib/modules/image/adapters/grsai-shared'

export const grsaiGptImageAdapter: ImageGenerationAdapter = {
  id: 'grsai',
  label: 'GRSAI Image',
  defaultApiUrl: 'https://grsai.dakka.com.cn',
  protocol: 'grsai-gpt-image',
  providerId: 'grsai',
  buildGenerateBody(input) {
    return buildGrsaiGptImageBody(input)
  },
  async generateImages(params) {
    return generateGrsaiGptImages(params)
  },
}
