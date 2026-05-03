import type { ImageGenerationAdapter } from '@/lib/modules/image/adapters/types'
import {
  buildAliyunWan27ImageBody,
  generateAliyunWan27Images,
} from '@/lib/modules/image/adapters/aliyun-wan-27-shared'

export const aliyunWan27ImageAdapter: ImageGenerationAdapter = {
  id: 'aliyun',
  label: 'Aliyun Wan Image',
  defaultApiUrl: 'https://dashscope.aliyuncs.com',
  protocol: 'aliyun-wan-27',
  providerId: 'aliyun',
  buildGenerateBody(input) {
    return buildAliyunWan27ImageBody(input)
  },
  async generateImages(params) {
    return generateAliyunWan27Images(params)
  },
}
