import type { ImageEditBBox, ImageEditConfig } from '@/lib/modules/image/types'

function normalizeCoordinate(value: unknown) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    throw new Error('框选坐标必须是数字')
  }

  return Math.max(0, Math.round(numericValue))
}

function normalizeBox(input: unknown): ImageEditBBox {
  if (!Array.isArray(input) || input.length !== 4) {
    throw new Error('框选参数格式不正确')
  }

  const [x1, y1, x2, y2] = input.map(normalizeCoordinate)
  if (x2 <= x1 || y2 <= y1) {
    throw new Error('框选区域无效，请重新绘制')
  }

  return [x1, y1, x2, y2]
}

export function sanitizeImageBboxList(
  input: unknown,
  expectedLength: number,
  options?: {
    enabled?: boolean
    maxBoxesPerImage?: number
  },
): ImageEditBBox[][] {
  const enabled = options?.enabled ?? true
  const maxBoxesPerImage = options?.maxBoxesPerImage ?? 2
  const emptySelections = Array.from({ length: expectedLength }, () => [] as ImageEditBBox[])

  if (!Array.isArray(input)) {
    if (input === undefined || input === null) {
      return emptySelections
    }
    throw new Error('框选参数格式不正确')
  }

  if (input.length === 0) {
    return emptySelections
  }

  if (input.length !== expectedLength) {
    throw new Error('框选参数与参考图片数量不匹配')
  }

  const result = input.map((item) => {
    if (!Array.isArray(item)) {
      throw new Error('框选参数格式不正确')
    }

    if (item.length > maxBoxesPerImage) {
      throw new Error(`每张参考图最多支持 ${maxBoxesPerImage} 个框选区域`)
    }

    return item.map((box) => normalizeBox(box))
  })

  if (!enabled && result.some((boxes) => boxes.length > 0)) {
    throw new Error('当前模型暂不支持框选改图')
  }

  return result
}

export function hasImageBboxSelections(bboxList: ImageEditBBox[][] | null | undefined) {
  return Array.isArray(bboxList) && bboxList.some((boxes) => boxes.length > 0)
}

export function parseImageEditConfigJson(
  value: string | null | undefined,
  expectedLength?: number,
): ImageEditConfig | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as { bboxList?: unknown }
    const bboxInput = parsed?.bboxList
    if (!Array.isArray(bboxInput)) {
      return null
    }

    const normalizedExpectedLength = typeof expectedLength === 'number'
      ? expectedLength
      : bboxInput.length

    return {
      bboxList: sanitizeImageBboxList(bboxInput, normalizedExpectedLength),
    }
  } catch {
    return null
  }
}
