import axios from 'axios'
import { prisma } from '@/lib/prisma'
import {
  calculateActualCostCents,
  resolveImageActualCostYuan,
  resolveImageEstimatedCostYuan,
} from '@/lib/modules/billing/cost'
import { getUserProviderConfig } from '@/lib/seedance-config'
import { importRemoteImageToAsset } from '@/lib/modules/assets/import-remote-asset'
import { resolveImageGenerationAdapterForTask } from '@/lib/modules/image/adapters/resolve'
import { parseImageEditConfigJson } from '@/lib/modules/image/edit-config'
import { getImageModelKey } from '@/lib/modules/image/models'
import { normalizePromptForProvider } from '@/lib/modules/tasks/provider-prompt'
import { shouldUseObjectStorage } from '@/lib/object-storage'

const IMAGE_PROCESSING_STALE_MS = 5 * 60 * 1000

function buildDebugPayload(task: {
  id: string
  model: string
  providerId?: string | null
  mode: string
  size: string
  outputFormat: string
  sequentialImageGeneration: string
  maxImages: number | null
  enableWebSearch: boolean
  promptExtend?: boolean | null
}, referenceImageUrls: string[], providerBody: Record<string, unknown>, apiUrl: string) {
  const normalizedApiUrl = apiUrl.replace(/\/+$/, '')
  const endpoint = task.providerId === 'aliyun'
    ? `${normalizedApiUrl}/api/v1/services/aigc/multimodal-generation/generation`
    : task.providerId === 'grsai'
      ? task.model === 'nano-banana-pro' || task.model === 'nano-banana-2'
        ? `${normalizedApiUrl}/v1/draw/nano-banana`
        : `${normalizedApiUrl}/v1/draw/completions`
      : `${normalizedApiUrl}/api/v3/images/generations`

  return {
    taskId: task.id,
    model: task.model,
    mode: task.mode,
    size: task.size,
    outputFormat: task.outputFormat,
    referenceImageCount: referenceImageUrls.length,
    bboxList: (providerBody as { parameters?: { bbox_list?: unknown } })?.parameters?.bbox_list || [],
    sequentialImageGeneration: task.sequentialImageGeneration,
    maxImages: task.maxImages,
    enableWebSearch: task.enableWebSearch,
    promptExtend: task.promptExtend,
    apiUrl,
    endpoint,
    requestBody: providerBody,
  }
}

function log(level: 'INFO' | 'ERROR' | 'DEBUG', message: string, data?: unknown) {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [IMAGE-GEN] [${level}]`
  if (data !== undefined) {
    console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2))
    return
  }
  console.log(`${prefix} ${message}`)
}

function getExecutionErrorDetails(error: unknown) {
  const providerCode =
    typeof (error as any)?.providerCode === 'string'
      ? (error as any).providerCode
      : null
  const providerStatus =
    typeof (error as any)?.providerStatus === 'number'
      ? (error as any).providerStatus
      : axios.isAxiosError(error)
        ? error.response?.status || null
        : null
  const providerResponse =
    (error as any)?.providerResponse
    || (axios.isAxiosError(error) ? error.response?.data || null : null)
  const providerMessage =
    axios.isAxiosError(error)
      ? (error.response?.data as any)?.error?.message
        || (error.response?.data as any)?.message
        || (typeof (error as any)?.message === 'string' ? (error as any).message.trim() : '')
      : typeof (error as any)?.message === 'string'
        ? (error as any).message.trim()
        : ''
  const message = providerMessage || 'Internal server error'
  const isHandledProviderError = Boolean((error as any)?.isHandledProviderError)

  return {
    message,
    providerCode,
    providerStatus,
    providerResponse,
    isHandledProviderError,
  }
}

function resolveEstimatedImageCostCents(task: {
  model: string
  promptExtend: boolean
  sequentialImageGeneration: string
  maxImages: number | null
}) {
  return calculateActualCostCents(resolveImageEstimatedCostYuan({
    model: task.model,
    promptExtend: task.promptExtend,
    sequentialImageGeneration: task.sequentialImageGeneration,
    maxImages: task.maxImages,
  }))
}

export async function executeImageGenerationTask(taskId: string) {
  const staleBefore = new Date(Date.now() - IMAGE_PROCESSING_STALE_MS)
  const claimResult = await prisma.imageGenerationTask.updateMany({
    where: {
      id: taskId,
      OR: [
        { status: 'pending' },
        {
          status: 'processing',
          updatedAt: { lt: staleBefore },
        },
      ],
    },
    data: {
      status: 'processing',
      errorMessage: null,
    },
  })

  if (claimResult.count === 0) {
    return { skipped: true, reason: 'task_not_claimed' as const }
  }

  await prisma.imageGenerationTaskOutput.deleteMany({
    where: { taskId },
  })

  const task = await prisma.imageGenerationTask.findUnique({
    where: { id: taskId },
    include: {
      references: {
        include: {
          asset: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
      outputs: {
        include: {
          asset: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!task) {
    return { skipped: true, reason: 'task_not_found' as const }
  }

  const provider = resolveImageGenerationAdapterForTask({
    model: task.model,
    providerId: task.providerId,
  })
  const providerConfig = await getUserProviderConfig(task.userId, provider.id)

  if (!providerConfig?.apiKeyConfigured || !providerConfig.apiKey) {
    const message = `${provider.label} API Key not configured`
    const estimatedCostCents = resolveEstimatedImageCostCents(task)
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: task.userId },
        select: {
          reservedBudget: true,
        },
      })
      const refundableReservedCents = Math.min(
        Number(user?.reservedBudget || 0),
        estimatedCostCents,
      )

      await tx.imageGenerationTask.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          errorMessage: message,
        },
      })

      if (refundableReservedCents > 0) {
        await tx.user.update({
          where: { id: task.userId },
          data: {
            reservedBudget: { decrement: refundableReservedCents },
          },
        })
      }
    })
    return { skipped: false, failed: true, reason: 'missing_api_key' as const }
  }

  const referenceImageUrls = task.references
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => item.asset.url)
  const editConfig = parseImageEditConfigJson(task.editConfigJson, referenceImageUrls.length)
  const providerPrompt = normalizePromptForProvider(task.prompt)

  const providerBody = provider.buildGenerateBody({
    model: task.model,
    prompt: providerPrompt,
    images: referenceImageUrls,
    bboxList: editConfig?.bboxList,
    size: task.size,
    outputFormat: task.outputFormat === 'png' ? 'png' : 'jpeg',
    responseFormat: 'url',
    watermark: task.watermark,
    promptExtend: task.promptExtend,
    sequentialImageGeneration: task.sequentialImageGeneration === 'auto' ? 'auto' : 'disabled',
    maxImages: task.maxImages,
    optimizePromptMode: 'standard',
    enableWebSearch: task.enableWebSearch,
  })

  log('INFO', `Executing image task ${task.id}`, {
    taskId: task.id,
    userId: task.userId,
    providerId: provider.id,
      model: task.model,
      mode: task.mode,
    })
  log('DEBUG', `Image task request payload ${task.id}`, buildDebugPayload(
    task,
    referenceImageUrls,
    providerBody,
    providerConfig.apiUrl,
  ))

  try {
    const result = await provider.generateImages({
      apiUrl: providerConfig.apiUrl,
      apiKey: providerConfig.apiKey,
      body: providerBody,
    })
    log('DEBUG', `Image task provider response ${task.id}`, {
      taskId: task.id,
      model: result.model,
      createdAt: result.createdAt,
      usage: result.usage,
      itemCount: result.items.length,
      raw: result.raw,
    })

    const hasObjectStorage = shouldUseObjectStorage()
    const outputRecords: Array<{
      sortOrder: number
      sourceUrl: string | null
      size: string | null
      errorCode: string | null
      errorMessage: string | null
      assetId: string | null
    }> = []

    for (let index = 0; index < result.items.length; index += 1) {
      const item = result.items[index]

      if (item.url && !item.errorCode) {
        if (!hasObjectStorage) {
          outputRecords.push({
            sortOrder: index,
            sourceUrl: item.url,
            size: item.size,
            errorCode: null,
            errorMessage: null,
            assetId: null,
          })
          continue
        }

        try {
          const asset = await importRemoteImageToAsset({
            userId: task.userId,
            sourceUrl: item.url,
            fileBaseName: `${getImageModelKey(task.model)}-${task.id}-${index + 1}`,
            outputFormat: task.outputFormat === 'png' ? 'png' : 'jpeg',
          })

          outputRecords.push({
            sortOrder: index,
            sourceUrl: item.url,
            size: item.size,
            errorCode: null,
            errorMessage: null,
            assetId: asset.id,
          })
        } catch (importError: any) {
          log('ERROR', `Import generated image failed for task ${task.id}`, {
            taskId: task.id,
            index,
            sourceUrl: item.url,
            error: importError?.message || 'Unknown import error',
          })
          outputRecords.push({
            sortOrder: index,
            sourceUrl: item.url,
            size: item.size,
            errorCode: 'IMPORT_FAILED',
            errorMessage: importError?.message || 'Import failed',
            assetId: null,
          })
        }
      } else {
        outputRecords.push({
          sortOrder: index,
          sourceUrl: item.url,
          size: item.size,
          errorCode: item.errorCode,
          errorMessage: item.errorMessage,
          assetId: null,
        })
      }
    }

    const successfulProviderItemCount = result.items.filter((item) => item.url && !item.errorCode).length
    const generatedImages = result.usage.generatedImages > 0
      ? result.usage.generatedImages
      : successfulProviderItemCount
    const importedOutputCount = outputRecords.filter((item) => item.assetId).length
    const sourceOutputCount = outputRecords.filter((item) => item.sourceUrl && !item.errorCode).length
    const hasSuccessfulOutputs = hasObjectStorage ? importedOutputCount > 0 : sourceOutputCount > 0
    const resolvedCostYuan = resolveImageActualCostYuan({
      generatedImages,
      model: task.model,
      promptExtend: task.promptExtend,
    })
    const estimatedCostCents = resolveEstimatedImageCostCents(task)
    const actualCostCents = calculateActualCostCents(resolvedCostYuan)

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: task.userId },
        select: {
          teamId: true,
          reservedBudget: true,
        },
      })
      const refundableReservedCents = Math.min(
        Number(user?.reservedBudget || 0),
        estimatedCostCents,
      )

      await tx.imageGenerationTask.update({
        where: { id: task.id },
        data: {
          status: hasSuccessfulOutputs ? 'succeeded' : 'failed',
          errorMessage: hasSuccessfulOutputs
            ? null
            : outputRecords.map((item) => item.errorMessage).filter(Boolean).join('\n') || '图片转存失败',
          generatedImages,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
          costYuan: resolvedCostYuan > 0 ? resolvedCostYuan : null,
          outputs: {
            create: outputRecords.map((item) => ({
              sortOrder: item.sortOrder,
              sourceUrl: item.sourceUrl,
              size: item.size,
              errorCode: item.errorCode,
              errorMessage: item.errorMessage,
              assetId: item.assetId,
            })),
          },
        },
      })

      if (refundableReservedCents > 0) {
        await tx.user.update({
          where: { id: task.userId },
          data: {
            reservedBudget: { decrement: refundableReservedCents },
          },
        })
      }

      if (hasSuccessfulOutputs) {
        await tx.user.update({
          where: { id: task.userId },
          data: {
            usedBudget: { increment: BigInt(actualCostCents) },
            usedTokens: { increment: BigInt(result.usage.totalTokens || 0) },
          },
        })

        if (user?.teamId) {
          await (tx as any).team.update({
            where: { id: user.teamId },
            data: {
              usedBudget: { increment: BigInt(actualCostCents) },
              usedTokens: { increment: BigInt(result.usage.totalTokens || 0) },
            },
          })
        }
      }
    })

    return {
      skipped: false,
      failed: false,
      generatedImages,
    }
  } catch (error: any) {
    const {
      message,
      providerCode,
      providerStatus,
      providerResponse,
      isHandledProviderError,
    } = getExecutionErrorDetails(error)

    const estimatedCostCents = resolveEstimatedImageCostCents(task)

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: task.userId },
        select: {
          reservedBudget: true,
        },
      })
      const refundableReservedCents = Math.min(
        Number(user?.reservedBudget || 0),
        estimatedCostCents,
      )

      await tx.imageGenerationTask.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          errorMessage: message,
        },
      }).catch(() => null)

      if (refundableReservedCents > 0) {
        await tx.user.update({
          where: { id: task.userId },
          data: {
            reservedBudget: { decrement: refundableReservedCents },
          },
        })
      }
    }).catch(() => null)

    log('ERROR', `Image task execution failed for task ${task.id}`, {
      taskId: task.id,
      error: message,
      request: buildDebugPayload(
        task,
        referenceImageUrls,
        providerBody,
        providerConfig.apiUrl,
      ),
      providerCode,
      responseStatus: providerStatus,
      responseData: providerResponse,
    })

    if (isHandledProviderError || axios.isAxiosError(error)) {
      return {
        skipped: false,
        failed: true,
        reason: 'provider_error' as const,
        errorCode: providerCode,
        errorMessage: message,
      }
    }

    throw error
  }
}
