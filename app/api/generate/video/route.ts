import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateTokens, type BillingType } from '@/lib/token-calculator'
import { getUserProviderConfig } from '@/lib/seedance-config'
import { normalizeSeed } from '@/lib/modules/provider/seedance/seed'
import { settleTaskFailure } from '@/lib/modules/billing/task-settlement'
import { requireSessionUser } from '@/lib/modules/auth/session'
import { enforceTeamSubmissionGuard, SubmissionGuardError } from '@/lib/modules/team/submission-guard'
import { normalizePromptForProvider } from '@/lib/modules/tasks/provider-prompt'
import { getVideoGenerationAdapterByModel } from '@/lib/modules/video/adapters/registry'
import {
  getVideoModelConfig,
  getVideoModelKey,
  normalizeVideoDuration,
  normalizeVideoModel,
  normalizeVideoRatio,
  normalizeVideoResolution,
  isHappyHorseVideoModel,
  supportsVideoModelMode,
} from '@/lib/modules/video/models'
import { buildVideoTaskCallbackUrl } from '@/lib/modules/provider/seedance/callback'
import { shouldUseObjectStorage } from '@/lib/object-storage'
import {
  INLINE_IMAGE_MAX_BYTES,
  estimateInlineBase64Bytes,
  isInlineBase64ImageUrl,
  modelRequiresObjectStorageForVideoMedia,
  videoModeAllowsNoStorageImageInputs,
} from '@/lib/modules/storage/media-input-policy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const GENERATION_TASK_MODEL = Prisma.dmmf.datamodel.models.find((model) => model.name === 'GenerationTask')
const SUPPORTS_REFERENCE_ASSET_ORDER = Boolean(
  GENERATION_TASK_MODEL?.fields.some((field) => field.name === 'referenceAssetOrder'),
)
const SUPPORTS_PROMPT_EXTEND = Boolean(
  GENERATION_TASK_MODEL?.fields.some((field) => field.name === 'promptExtend'),
)

// Helper function for logging
const log = (level: 'INFO' | 'ERROR' | 'DEBUG', message: string, data?: any) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [VIDEO-GEN] [${level}]`
  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2))
  } else {
    console.log(`${prefix} ${message}`)
  }
}

function buildDetailedApiError(apiError: any, requestId: string) {
  let detailedError = ''
  const responseData = apiError.response?.data

  if (responseData) {
    if (responseData.error?.code && responseData.error?.message) {
      detailedError = `错误类型: ${responseData.error.code}\n错误信息: ${responseData.error.message}`
    } else if (responseData.message) {
      detailedError = responseData.message
    } else if (typeof responseData === 'string') {
      detailedError = responseData
    } else {
      detailedError = JSON.stringify(responseData)
    }
  } else {
    detailedError = apiError.message || '生成失败'
  }

  return `${detailedError}\n\n请求ID: ${requestId}`
}

function isDefinitiveSubmissionFailure(apiError: any) {
  const status = apiError.response?.status

  if (typeof status === 'number') {
    if (status === 408 || status === 409 || status === 429) {
      return false
    }
    if (status >= 400 && status < 500) {
      return true
    }
    if (status >= 500) {
      return false
    }
  }

  return false
}

function buildSubmitUnknownMessage(apiError: any, requestId: string) {
  const status = apiError.response?.status
  const base = status
    ? `上游响应异常（HTTP ${status}），系统暂时无法确认任务是否已创建。`
    : '上游响应超时或网络中断，系统暂时无法确认任务是否已创建。'

  return `${base}\n系统已保留本次预扣，请勿立即重复提交；可稍后刷新或由管理员对账确认。\n\n请求ID: ${requestId}`
}

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    const session = await requireSessionUser(request, {
      select: { email: true, name: true },
    })
    if ('response' in session) {
      log('ERROR', `[${requestId}] Session validation failed`)
      return session.response
    }
    const userId = session.payload.userId

    const body = await request.json()
    
    // Log incoming request
    log('INFO', `[${requestId}] Received video generation request`, {
      userId,
      mode: body.mode,
      model: body.model,
      prompt: body.prompt?.substring(0, 100) + (body.prompt?.length > 100 ? '...' : ''),
      ratio: body.ratio,
      duration: body.duration,
      resolution: body.resolution,
      first_frame_url: body.first_frame_url ? '✓' : '✗',
      last_frame_url: body.last_frame_url ? '✓' : '✗',
      first_clip_url: body.first_clip_url ? '✓' : '✗',
      reference_image_urls: body.reference_image_urls?.length || 0,
      reference_video_urls: body.reference_video_urls?.length || 0,
      reference_audio_urls: body.reference_audio_urls?.length || 0,
    })

    const {
      batch_id,
      model,
      mode,
      prompt,
      prompt_ast,  // 👈 新增：Slate.js AST
      ratio,
      duration,
      resolution,
      watermark,
      generate_audio,
      prompt_extend,
      seed,
      first_frame_url,
      last_frame_url,
      first_clip_url,
      reference_image_urls,
      reference_video_urls,
      reference_audio_urls,
      reference_video_durations,
    } = body
    const modelConfig = getVideoModelConfig(model)
    const normalizedBatchId = typeof batch_id === 'string' && batch_id.trim()
      ? batch_id.trim().slice(0, 64)
      : null
    const providerPrompt = normalizePromptForProvider(prompt)
    const normalizedModel = normalizeVideoModel(model)
    const normalizedResolution = normalizeVideoResolution(normalizedModel, resolution)
    const normalizedRatio = normalizeVideoRatio(normalizedModel, ratio)
    const hasReferenceVideo =
      (Array.isArray(reference_video_urls) && reference_video_urls.length > 0)
      || (typeof first_clip_url === 'string' && first_clip_url.trim().length > 0)
    const normalizedDuration = normalizeVideoDuration(normalizedModel, duration, {
      hasReferenceVideo,
    })
    const provider = getVideoGenerationAdapterByModel(normalizedModel)
    const defaultApiUrl = provider.defaultApiUrl
    const normalizedSeed = normalizeSeed(seed)

    const seedanceConfig = await getUserProviderConfig(userId, provider.id)
    const hasObjectStorage = shouldUseObjectStorage()

    if (normalizedSeed === null) {
      return NextResponse.json(
        { error: 'Invalid seed. Expected an integer between -1 and 4294967295.' },
        { status: 400 }
      )
    }

    if (!supportsVideoModelMode(normalizedModel, mode)) {
      return NextResponse.json(
        { error: `模型 ${modelConfig.label} 不支持当前生成模式` },
        { status: 400 }
      )
    }

    if (!hasObjectStorage) {
      const normalizedReferenceImageUrls = Array.isArray(reference_image_urls)
        ? reference_image_urls.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
        : []
      const normalizedReferenceVideoUrls = Array.isArray(reference_video_urls)
        ? reference_video_urls.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
        : []
      const normalizedReferenceAudioUrls = Array.isArray(reference_audio_urls)
        ? reference_audio_urls.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
        : []

      if (
        normalizedReferenceVideoUrls.length > 0
        || normalizedReferenceAudioUrls.length > 0
        || (typeof first_clip_url === 'string' && first_clip_url.trim().length > 0)
        || mode === 'first_clip'
        || mode === 'video_edit'
      ) {
        return NextResponse.json({
          error: '当前团队未配置对象存储，不能上传或引用视频、音频素材。请改用文生视频，或使用只包含图片的图生/参考生模式。',
        }, { status: 400 })
      }

      if (modelRequiresObjectStorageForVideoMedia(normalizedModel) || !videoModeAllowsNoStorageImageInputs(normalizedModel, mode)) {
        const needsObjectStorage = modelRequiresObjectStorageForVideoMedia(normalizedModel)
        return NextResponse.json({
          error: needsObjectStorage
            ? `${modelConfig.label} 当前媒体输入仍需要对象存储。未配置对象存储时，请改用文生视频，或选择仅支持本地图片参考的模型。`
            : `${modelConfig.label} 当前模式不支持未配置对象存储时的本地图片输入。`,
        }, { status: 400 })
      }

      const inlineImageUrls = [
        first_frame_url,
        last_frame_url,
        ...normalizedReferenceImageUrls,
      ].filter(isInlineBase64ImageUrl)
      if (inlineImageUrls.some((url) => estimateInlineBase64Bytes(url) > INLINE_IMAGE_MAX_BYTES)) {
        return NextResponse.json({
          error: '未配置对象存储时，本地参考图单张不能超过 20MB',
        }, { status: 400 })
      }
    }

    // 仅允许使用团队配置的官方 Ark API Key
    const effectiveApiKey = seedanceConfig?.apiKey
    const effectiveApiUrl = seedanceConfig?.apiUrl || defaultApiUrl

    // Validate API Key
    if (!effectiveApiKey) {
      log('ERROR', `[${requestId}] Missing provider API Key`, {
        providerId: provider.id,
      })
      return NextResponse.json({ error: `请联系团队管理员配置 ${provider.label} API Key` }, { status: 400 })
    }

    let providerRequestBody: Record<string, unknown>
    try {
      providerRequestBody = provider.buildCreateTaskBody({
        model: modelConfig.providerModelId,
        mode,
        prompt: providerPrompt,
        ratio: normalizedRatio,
        duration: normalizedDuration,
        resolution: normalizedResolution,
        watermark: watermark || false,
        generateAudio: generate_audio !== false,
        promptExtend: prompt_extend !== false,
        seed: normalizedSeed,
        firstFrameUrl: first_frame_url,
        lastFrameUrl: last_frame_url,
        firstClipUrl: first_clip_url,
        referenceImageUrls: reference_image_urls,
        referenceVideoUrls: reference_video_urls,
        referenceAudioUrls: reference_audio_urls,
        safetyIdentifier: provider.buildSafetyIdentifier(userId),
        returnLastFrame: false,
        callbackUrl: provider.id === 'volcengine' ? buildVideoTaskCallbackUrl(request) : null,
      })
    } catch (validationError: any) {
      return NextResponse.json(
        { error: validationError?.message || '生成参数不合法' },
        { status: 400 }
      )
    }

    if (!hasObjectStorage) {
      const imageUrls = [
        ...(Array.isArray(reference_image_urls) ? reference_image_urls : []),
        first_frame_url,
        last_frame_url,
      ].filter((item): item is string => typeof item === 'string' && item.trim().length > 0)

      if (imageUrls.length > 0) {
        const existingAssets = await prisma.asset.findMany({
          where: { userId, url: { in: imageUrls } },
          select: { url: true },
        })
        const existingUrls = new Set(existingAssets.map((asset) => asset.url))
        const missingUrls = [...new Set(imageUrls.filter((url) => !existingUrls.has(url)))]

        if (missingUrls.length > 0) {
          await Promise.all(missingUrls.map((url, index) =>
            prisma.asset.create({
              data: {
                name: `临时参考图_${Date.now()}_${index + 1}`,
                type: 'image',
                url,
                size: isInlineBase64ImageUrl(url) ? estimateInlineBase64Bytes(url) : 0,
                contentType: isInlineBase64ImageUrl(url) ? url.slice(5, url.indexOf(';')) : 'image/*',
                category: 'creation',
                userId,
              },
            })
          ))
        }
      }
    }

    // 计算输入视频总时长
    let inputVideoDuration = 0
    if (reference_video_urls && reference_video_urls.length > 0) {
      const uploadedVideoDurations = Array.isArray(reference_video_durations)
        ? reference_video_durations
          .map((value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0))
        : []

      if (uploadedVideoDurations.length > 0) {
        inputVideoDuration = uploadedVideoDurations.reduce((sum, value) => sum + value, 0)
      } else {
        const videoAssets = await prisma.asset.findMany({
          where: {
            url: { in: reference_video_urls },
            userId,
          },
          select: { duration: true },
        })
        inputVideoDuration = videoAssets.reduce((sum, a) => sum + (a.duration || 0), 0)
      }
    }

    // Calculate estimated tokens and cost (新公式：支持输入视频时长)
    const tokenResult = calculateTokens(
      normalizedModel,
      normalizedResolution,
      normalizedRatio,
      normalizedDuration,
      inputVideoDuration,
      1
    )
    const estimatedTokens = tokenResult.tokens
    const billingType: BillingType = tokenResult.billingType
    const estimatedCostYuan = tokenResult.costYuan
    const estimatedCostCents = Math.round(estimatedCostYuan * 100)  // 转换为分
    
    // 使用事务保证预扣款和任务创建的原子性
    const task = await prisma.$transaction(async (tx) => {
      // 1. 团队级并发/频率/冷却保护
      const userWithQuota = await (tx.user.findUnique as any)({
        where: { id: userId },
        select: {
          teamId: true,
          allocatedBudget: true,
          usedBudget: true,
          reservedBudget: true,
          team: {
            select: {
              maxConcurrentTasks: true,
              maxRequestsPerMinute: true,
              memberCooldownSeconds: true,
            },
          },
        },
      }) as any

      if (userWithQuota?.teamId) {
        await enforceTeamSubmissionGuard(tx as any, {
          userId,
          teamId: userWithQuota.teamId,
          teamGuard: userWithQuota.team,
        })
      }
          
      // 2. 预算校验与预扣（使用原子操作避免并发问题）
      if (userWithQuota) {
        // 可用预算 = 分配预算 - 已使用 - 已预扣（单位：分）
        const availableCents = Number(userWithQuota.allocatedBudget || 0) - 
                               Number(userWithQuota.usedBudget || 0) - 
                               Number(userWithQuota.reservedBudget || 0)
            
        if (availableCents < estimatedCostCents) {
          const availableYuan = (availableCents / 100).toFixed(2)
          const requiredYuan = estimatedCostYuan.toFixed(2)
          log('ERROR', `[${requestId}] Insufficient budget`, {
            allocated: Number(userWithQuota.allocatedBudget || 0) / 100,
            used: Number(userWithQuota.usedBudget || 0) / 100,
            reserved: Number(userWithQuota.reservedBudget || 0) / 100,
            available: availableYuan,
            required: requiredYuan,
          })
              
          // 抛出错误，事务会自动回滚
          const error: any = new Error(`预算不足：可用 ¥${availableYuan}，需要 ¥${requiredYuan}`)
          error.code = 'INSUFFICIENT_BUDGET'
          error.details = {
            availableYuan: parseFloat(availableYuan),
            requiredYuan: parseFloat(requiredYuan),
          }
          throw error
        }
            
        // 预扣：锁定预估费用（分）- 原子操作
        await tx.user.update({
          where: { id: userId },
          data: { reservedBudget: { increment: estimatedCostCents } },
        })
        log('INFO', `[${requestId}] Reserved ¥${estimatedCostYuan.toFixed(2)} for user ${userId}`)
      }
    
      // 3. 收集资源 ID（在事务内部）
      const findAssetsByUrls = async (urls: string[] | undefined) => {
        if (!urls || urls.length === 0) return []
        const assets = await tx.asset.findMany({
          where: {
            url: { in: urls },
            userId,
          },
          select: { id: true, url: true },
        })

        const assetIdByUrl = new Map(assets.map((asset) => [asset.url, asset.id]))
        const orderedAssetIds: string[] = []
        const seenAssetIds = new Set<string>()

        for (const url of urls) {
          const assetId = assetIdByUrl.get(url)
          if (!assetId || seenAssetIds.has(assetId)) {
            continue
          }

          seenAssetIds.add(assetId)
          orderedAssetIds.push(assetId)
        }

        return orderedAssetIds
      }
      
      // Collect all reference asset IDs
      const imageAssetIds = await findAssetsByUrls(reference_image_urls)
      const videoAssetIds = await findAssetsByUrls(reference_video_urls)
      const audioAssetIds = await findAssetsByUrls(reference_audio_urls)
      
      // Also check first_frame and last_frame URLs
      const referenceAssetIds: string[] = []
      if (first_frame_url) {
        const firstFrameAssets = await findAssetsByUrls([first_frame_url])
        referenceAssetIds.push(...firstFrameAssets)
      }
      if (first_clip_url) {
        const firstClipAssets = await findAssetsByUrls([first_clip_url])
        referenceAssetIds.push(...firstClipAssets)
      }
      if (last_frame_url) {
        const lastFrameAssets = await findAssetsByUrls([last_frame_url])
        referenceAssetIds.push(...lastFrameAssets)
      }
      
      referenceAssetIds.push(...imageAssetIds, ...videoAssetIds, ...audioAssetIds)
      const orderedReferenceAssetIds = [...new Set(referenceAssetIds)]

      // 4. 创建任务记录
      const newTask = await tx.generationTask.create({
        data: {
          batchId: normalizedBatchId,
          mode,
          model: normalizedModel,
          modelKey: getVideoModelKey(normalizedModel),
          providerId: provider.id,
          providerModelId: modelConfig.providerModelId,
          prompt,
          promptAst: prompt_ast ? JSON.stringify(prompt_ast) : null,
          ratio: normalizedRatio,
          duration: normalizedDuration,
          resolution: normalizedResolution,
          watermark: watermark || false,
          generateAudio: generate_audio !== false,
          ...(SUPPORTS_PROMPT_EXTEND
            ? {
                promptExtend: prompt_extend !== false,
              }
            : {}),
          seed: normalizedSeed as any,
          estimatedTokens,
          estimatedCostCents,  // 保存预估费用（分）
          billingType,  // 保存计费类型
          userId,
          ...(SUPPORTS_REFERENCE_ASSET_ORDER
            ? {
                referenceAssetOrder: orderedReferenceAssetIds.length > 0
                  ? JSON.stringify(orderedReferenceAssetIds)
                  : null,
              }
            : {}),
          // Connect reference assets
          referenceAssets: orderedReferenceAssetIds.length > 0 ? {
            connect: orderedReferenceAssetIds.map(id => ({ id }))
          } : undefined,
        } as any,  // Type assertion for Prisma client sync issue
      })
          
      log('DEBUG', `[${requestId}] Task created`, {
        taskId: newTask.id,
        referenceAssetCount: orderedReferenceAssetIds.length,
        persistedReferenceOrder: SUPPORTS_REFERENCE_ASSET_ORDER,
      })
          
      return newTask
    })

    log('DEBUG', `[${requestId}] Sending request to upstream provider`, {
      providerId: provider.id,
      providerLabel: provider.label,
      apiUrl: effectiveApiUrl,
      model: providerRequestBody.model,
      contentCount: Array.isArray((providerRequestBody as any).content) ? (providerRequestBody as any).content.length : 0,
      duration: (providerRequestBody as any).duration,
      ratio: (providerRequestBody as any).ratio,
      resolution: (providerRequestBody as any).resolution,
      callback_url: (providerRequestBody as any).callback_url || null,
    })

    try {
      const response = await provider.createTask({
        apiUrl: effectiveApiUrl,
        apiKey: effectiveApiKey,
        body: providerRequestBody,
      })

      log('INFO', `[${requestId}] Provider response SUCCESS`, {
        providerId: provider.id,
        data: response,
      })

      // Update task with external ID
      await prisma.generationTask.update({
        where: { id: task.id },
        data: {
          externalId: response.id,
          status: 'queued',
        },
      })

      log('INFO', `[${requestId}] Task created successfully`, {
        taskId: task.id,
        externalId: response.id,
      })

      return NextResponse.json({
        task: {
          id: task.id,
          batchId: task.batchId,
          status: 'queued',
          estimatedTokens,
        },
        external_id: response.id,
      })
    } catch (apiError: any) {
      // Log detailed error information
      log('ERROR', `[${requestId}] Provider request FAILED`, {
        providerId: provider.id,
        error_message: apiError.message,
        error_code: apiError.code,
        response_status: apiError.response?.status,
        response_data: apiError.response?.data,
        request_url: effectiveApiUrl,
        request_body: providerRequestBody,
      })

      if (isDefinitiveSubmissionFailure(apiError)) {
        const detailedError = buildDetailedApiError(apiError, requestId)

        await settleTaskFailure(task.id, {
          status: 'failed',
          errorMessage: detailedError,
        })

        return NextResponse.json(
          {
            error: 'Generation failed',
            task: {
              id: task.id,
              batchId: task.batchId,
              status: 'failed',
              errorMessage: detailedError,
            },
            details: apiError.response?.data || apiError.message,
            requestId,
          },
          { status: 500 }
        )
      }

      const submitUnknownMessage = buildSubmitUnknownMessage(apiError, requestId)

      await prisma.generationTask.update({
        where: { id: task.id },
        data: {
          status: 'submit_unknown',
          errorMessage: submitUnknownMessage,
        },
      })

      return NextResponse.json(
        {
          warning: 'Generation submission status is uncertain',
          task: {
            id: task.id,
            batchId: task.batchId,
            status: 'submit_unknown',
            estimatedTokens,
            errorMessage: submitUnknownMessage,
          },
          details: apiError.response?.data || apiError.message,
          requestId,
        },
        { status: 202 }
      )
    }
  } catch (error: any) {
    log('ERROR', `[${requestId}] Unexpected error`, {
      error_message: error.message,
      error_stack: error.stack,
    })

    if (error instanceof SubmissionGuardError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'SUBMISSION_GUARD_TRIGGERED',
          retryAfterSeconds: error.retryAfterSeconds ?? null,
          requestId,
        },
        { status: error.statusCode }
      )
    }

    if (error.code === 'INSUFFICIENT_BUDGET') {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
          requestId,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    )
  }
}
