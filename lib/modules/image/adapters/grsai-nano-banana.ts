import type { ImageGenerationAdapter } from '@/lib/modules/image/adapters/types'
import { buildGrsaiNanoBananaBody, generateGrsaiNanoBananaImages } from '@/lib/modules/image/adapters/grsai-shared'

export const grsaiNanoBananaAdapter: ImageGenerationAdapter = {
  id: 'grsai',
  label: 'GRSAI Image',
  defaultApiUrl: 'https://grsai.dakka.com.cn',
  protocol: 'grsai-nano-banana',
  providerId: 'grsai',
  buildGenerateBody(input) {
    return buildGrsaiNanoBananaBody(input)
  },
  async generateImages(params) {
    return generateGrsaiNanoBananaImages(params)
  },
}
