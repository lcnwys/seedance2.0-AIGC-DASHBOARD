import type { ImageGenerationAdapter } from '@/lib/modules/image/adapters/types'
import {
  buildAliyunDashscopeImageBody,
  generateAliyunDashscopeImages,
} from '@/lib/modules/image/adapters/aliyun-dashscope-image-shared'

export const aliyunDashscopeImageAdapter: ImageGenerationAdapter = {
  id: 'aliyun',
  label: 'Aliyun Image',
  defaultApiUrl: 'https://dashscope.aliyuncs.com',
  protocol: 'aliyun-dashscope-image',
  providerId: 'aliyun',
  buildGenerateBody(input) {
    return buildAliyunDashscopeImageBody(input)
  },
  async generateImages(params) {
    return generateAliyunDashscopeImages(params)
  },
}
