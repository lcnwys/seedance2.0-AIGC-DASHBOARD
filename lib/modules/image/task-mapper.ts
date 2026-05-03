import type { DashboardAsset, DashboardTask } from '@/components/dashboard/types'
import { resolveImageActualCostYuan } from '@/lib/modules/billing/cost'
import { parseImageEditConfigJson } from '@/lib/modules/image/edit-config'
import { resolveImageTaskGenerationTimeSeconds } from '@/lib/modules/tasks/generation-time'
import { normalizePromptAstAssetLabels } from '@/lib/modules/tasks/reference-asset-order'
import { serializeToApiPayload } from '@/lib/slate'

type ImageTaskRecord = {
  id: string
  model: string
  modelKey: string | null
  providerId: string
  providerModelId: string | null
  mode: string
  prompt: string
  promptAst: string | null
  size: string
  outputFormat: string
  responseFormat: string
  watermark: boolean
  sequentialImageGeneration: string
  maxImages: number | null
  optimizePromptMode: string
  enableWebSearch: boolean
  editConfigJson: string | null
  status: string
  errorMessage: string | null
  generatedImages: number | null
  outputTokens: number | null
  totalTokens: number | null
  costYuan: number | null
  promptExtend: boolean | null
  createdAt: Date
  updatedAt: Date
  references: Array<{
    sortOrder: number
    asset: DashboardAsset
  }>
  outputs: Array<{
    sortOrder: number
    sourceUrl: string | null
    size: string | null
    errorCode: string | null
    errorMessage: string | null
    asset: DashboardAsset | null
  }>
}

export function mapImageTaskToDashboardTask(task: ImageTaskRecord): DashboardTask {
  let promptAst: any[] | null = null
  if (task.promptAst) {
    try {
      promptAst = JSON.parse(task.promptAst)
    } catch {
      promptAst = null
    }
  }

  const sortedReferenceAssets = task.references
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => item.asset)
  const normalizedPromptAstResult = normalizePromptAstAssetLabels(promptAst, sortedReferenceAssets)
  const normalizedPromptAst = normalizedPromptAstResult.promptAst
  const referenceAssets = sortedReferenceAssets

  const outputAssets = task.outputs
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => {
      if (item.asset) {
        return item.asset
      }

      if (!item.sourceUrl || item.errorCode) {
        return null
      }

      return {
        id: `image-output-${task.id}-${index + 1}`,
        name: `生成图片_${index + 1}`,
        type: 'image',
        url: item.sourceUrl,
        category: 'creation',
      } satisfies DashboardAsset
    })
    .filter(Boolean) as DashboardAsset[]

  const generatedImages = task.generatedImages || outputAssets.length
  const storedImageEditConfig = parseImageEditConfigJson(task.editConfigJson, sortedReferenceAssets.length)
  const bboxByAssetId = new Map(
    sortedReferenceAssets.map((asset, index) => [asset.id, storedImageEditConfig?.bboxList[index] || []]),
  )
  const imageEditConfig = storedImageEditConfig
    ? {
        bboxList: referenceAssets.map((asset) => bboxByAssetId.get(asset.id) || []),
      }
    : null
  const resolvedCostYuan = resolveImageActualCostYuan({
    costYuan: task.costYuan,
    generatedImages,
    model: task.model,
    promptExtend: task.promptExtend,
  })

  return {
    id: task.id,
    taskKind: 'image',
    mode: task.mode,
    prompt: Array.isArray(normalizedPromptAst)
      ? serializeToApiPayload(normalizedPromptAst as any).prompt
      : task.prompt,
    promptAst: Array.isArray(normalizedPromptAst) ? normalizedPromptAst : promptAst || undefined,
    status: task.status,
    errorMessage: task.errorMessage || undefined,
    estimatedTokens: 0,
    totalTokens: task.totalTokens || undefined,
    ratio: '1:1',
    resolution: task.size,
    duration: 0,
    generateAudio: false,
    model: task.model,
    modelKey: task.modelKey || undefined,
    providerId: task.providerId,
    providerModelId: task.providerModelId || undefined,
    createdAt: task.createdAt.toISOString(),
    referenceAssets,
    outputAssets,
    outputUrl: outputAssets[0]?.url,
    size: task.size,
    outputFormat: task.outputFormat,
    responseFormat: task.responseFormat,
    generatedImages,
    outputTokens: task.outputTokens || undefined,
    watermark: task.watermark,
    promptExtend: task.promptExtend !== false,
    generationTime: resolveImageTaskGenerationTimeSeconds({
      providerId: task.providerId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      status: task.status,
    }),
    imageEditConfig: imageEditConfig || undefined,
    recordedCostYuan: task.costYuan ?? null,
    costYuan: resolvedCostYuan || undefined,
    actualCostSource: generatedImages > 0 ? 'derived' : task.costYuan !== null && task.costYuan !== undefined ? 'recorded' : 'none',
  }
}
