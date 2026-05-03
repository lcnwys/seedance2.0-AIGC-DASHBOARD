'use client'

import { useState } from 'react'
import type { DashboardTask } from '@/components/dashboard/types'
import { ImagePreviewModal } from '@/components/dashboard/image-preview-modal'
import { resolveActualCostYuan, resolveImageActualCostYuan } from '@/lib/modules/billing/cost'
import { getImageModelConfig, getImageModelPricingSummary } from '@/lib/modules/image/models'
import {
  getDurationModelRateYuan,
  getVideoModelConfig,
  getVideoModelPricingSummary,
} from '@/lib/modules/video/models'

type TaskDetailModalProps = {
  task: DashboardTask | null
  onClose: () => void
  formatTokens: (tokens: number | string) => string
}

export function TaskDetailModal({ task, onClose, formatTokens }: TaskDetailModalProps) {
  const [previewAsset, setPreviewAsset] = useState<{ url: string; name: string } | null>(null)

  if (!task) {
    return null
  }

  const isFailed = ['failed', 'expired'].includes(task.status)
  const isSubmitUnknown = task.status === 'submit_unknown'
  const isImageTask = task.taskKind === 'image'
  const statusLabel = task.status === 'succeeded'
    ? '✅ 成功'
    : task.status === 'failed'
      ? '❌ 失败'
      : task.status === 'expired'
        ? '⚠️ 已过期'
        : isSubmitUnknown
          ? '🕒 提交确认中'
          : '⏳ 处理中'

  const statusClassName = task.status === 'succeeded'
    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
    : task.status === 'failed'
      ? 'bg-red-500/10 text-red-400 border border-red-500/30'
      : task.status === 'expired'
        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
        : isSubmitUnknown
          ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
          : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
  const hasVideoInput =
    task.billingType === 'with_video' || task.referenceAssets?.some((asset) => asset.type === 'video')
  const effectiveBillingType = hasVideoInput ? 'with_video' : 'without_video'
  const videoModelConfig = getVideoModelConfig(task.model)
  const imageModelConfig = getImageModelConfig(task.model)
  const isDurationPricing = !isImageTask && videoModelConfig.pricing.strategy === 'duration'
  const billingRate = isImageTask ? null : getDurationModelRateYuan(task.model, task.resolution)
  const actualTokens = task.totalTokens || 0
  const estimatedTokens = task.estimatedTokens || 0
  const durationLabel = !isImageTask && task.mode === 'video_edit' && task.duration === 0
    ? '原时长'
    : !isImageTask && task.duration === -1
      ? '智能时长'
      : `${task.duration}s`
  const resolvedCostYuan = isImageTask
    ? resolveImageActualCostYuan({
        costYuan: task.costYuan,
        generatedImages: task.generatedImages || task.outputAssets?.length || 0,
        model: task.model,
        promptExtend: task.promptExtend,
      })
    : resolveActualCostYuan({
        costYuan: task.costYuan,
        totalTokens: task.totalTokens,
        billingType: task.billingType,
        duration: task.duration,
        resolution: task.resolution,
        referenceAssets: task.referenceAssets,
        model: task.model,
      })
  const isSucceeded = task.status === 'succeeded'
  const actualTokenDisplay = isFailed
    ? '0'
    : isImageTask
      ? `${task.generatedImages || task.outputAssets?.length || 0} 张`
      : isDurationPricing
      ? durationLabel
      : actualTokens > 0
        ? formatTokens(actualTokens)
        : '待返回'
  const actualCostLabel = isFailed
    ? '¥0.00'
    : task.actualCostSource === 'none'
      ? '待结算'
      : `¥${resolvedCostYuan.toFixed(2)}`
  const actualCostHint = isFailed
    ? null
    : task.actualCostSource === 'recorded'
      ? '按任务结算结果记录'
      : task.actualCostSource === 'derived'
        ? '按上游返回结果和计费规则回推'
        : '任务完成后更新'

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="glass rounded-2xl border border-zinc-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900/95">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-zinc-100">任务详情</h3>
              <span
                className={`text-xs px-2 py-1 rounded ${statusClassName}`}
              >
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800/50 border border-zinc-700 rounded text-xs font-mono">
                <span className="text-zinc-500">ID:</span>
                <span className="text-zinc-300 select-all">{task.externalId || task.id}</span>
              </div>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {task.outputUrl && !isImageTask && (
              <div className="aspect-video bg-black rounded-xl overflow-hidden">
                <video src={task.outputUrl} controls preload="metadata" playsInline className="w-full h-full" />
              </div>
            )}

            {isImageTask && task.outputAssets && task.outputAssets.length > 0 && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {task.outputAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setPreviewAsset({ url: asset.url, name: asset.name })}
                    className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70 text-left transition-colors hover:border-emerald-500/40"
                  >
                    <img src={asset.url} alt={asset.name} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                  </button>
                ))}
              </div>
            )}

          {task.errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className={`text-sm ${isSubmitUnknown ? 'text-yellow-400' : 'text-red-400'}`}>
                {isSubmitUnknown ? '🕒 状态说明' : '❌ 错误'}: {task.errorMessage}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-zinc-500 mb-1">提示词</p>
            <p className="text-zinc-300 text-sm bg-zinc-800/50 p-3 rounded-lg">{task.prompt}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-800/30 p-3 rounded-lg">
              <p className="text-xs text-zinc-500">生成模式</p>
              <p className="text-sm text-zinc-200 mt-1">{task.mode}</p>
            </div>
            <div className="bg-zinc-800/30 p-3 rounded-lg">
              <p className="text-xs text-zinc-500">
                {isImageTask ? '实际出图' : isDurationPricing ? '实际计费时长' : '实际 Token'}
              </p>
              <p className={`text-sm mt-1 font-mono ${isFailed ? 'text-zinc-500' : isSubmitUnknown ? 'text-yellow-400' : 'text-blue-400'}`}>
                {actualTokenDisplay}
              </p>
              {!isImageTask && !isDurationPricing && estimatedTokens > 0 && (
                <p className="text-[11px] text-zinc-500 mt-1">预估 {formatTokens(estimatedTokens)}</p>
              )}
            </div>
            <div className="bg-zinc-800/30 p-3 rounded-lg">
              <p className="text-xs text-zinc-500">实际费用</p>
              <p className={`text-sm mt-1 ${isFailed ? 'text-zinc-500' : isSubmitUnknown ? 'text-yellow-400' : 'text-green-400'}`}>
                {actualCostLabel}
              </p>
              {actualCostHint && (
                <p className="text-[11px] text-zinc-500 mt-1">{actualCostHint}</p>
              )}
            </div>
            <div className="bg-zinc-800/30 p-3 rounded-lg">
              <p className="text-xs text-zinc-500">计费类型</p>
              <p className="text-sm text-zinc-200 mt-1">
                {isImageTask
                  ? `🖼️ 按张计费${getImageModelPricingSummary(task.model, task.promptExtend) ? ` (${getImageModelPricingSummary(task.model, task.promptExtend)})` : ''}`
                  : task.billingType === 'refunded'
                  ? '♻️ 已退款'
                  : isDurationPricing
                    ? `⏱️ 秒级计费${billingRate ? ` (${task.resolution.toUpperCase()} ¥${billingRate.toFixed(2)}/秒)` : ''}`
                    : effectiveBillingType === 'with_video'
                      ? `📹 含视频 (${getVideoModelPricingSummary(task.model, task.resolution).split('，')[0]})`
                      : `📝 不含视频 (${getVideoModelPricingSummary(task.model, task.resolution).split('，')[1] || getVideoModelPricingSummary(task.model, task.resolution)})`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-800/30 p-3 rounded-lg">
              <p className="text-xs text-zinc-500">模型</p>
              <p className="text-sm text-zinc-200 mt-1">{isImageTask ? imageModelConfig.label : videoModelConfig.label}</p>
            </div>
            {isImageTask && imageModelConfig.supportsPromptExtend ? (
              <div className="bg-zinc-800/30 p-3 rounded-lg">
                <p className="text-xs text-zinc-500">Prompt 扩写</p>
                <p className="text-sm text-zinc-200 mt-1">
                  {task.promptExtend === false ? '关闭' : '开启'}
                </p>
              </div>
            ) : null}
            <div className="bg-zinc-800/30 p-3 rounded-lg">
              <p className="text-xs text-zinc-500">{isImageTask ? '尺寸' : '分辨率'}</p>
              <p className="text-sm text-zinc-200 mt-1">{isImageTask ? task.size || '-' : task.resolution}</p>
            </div>
            <div className="bg-zinc-800/30 p-3 rounded-lg">
              <p className="text-xs text-zinc-500">{isImageTask ? '输出格式' : '时长'}</p>
              <p className="text-sm text-zinc-200 mt-1">{isImageTask ? task.outputFormat || '-' : durationLabel}</p>
            </div>
            <div className="bg-zinc-800/30 p-3 rounded-lg">
              <p className="text-xs text-zinc-500">{isImageTask ? '生成模式' : '画面比例'}</p>
              <p className="text-sm text-zinc-200 mt-1">{isImageTask ? task.mode : task.ratio}</p>
            </div>
            {!isImageTask && (
              <div className="bg-zinc-800/30 p-3 rounded-lg">
              <p className="text-xs text-zinc-500">生成耗时</p>
              <p className="text-sm text-zinc-200 mt-1">{task.generationTime ? `${task.generationTime}s` : '-'}</p>
              </div>
            )}
          </div>

          <div className="bg-zinc-800/30 p-3 rounded-lg">
            <p className="text-xs text-zinc-500">费用来源</p>
            <p className="text-sm text-zinc-200 mt-1">
              {isImageTask
                ? '优先使用任务已记录的实际费用；若缺失，则按模型单张价格和成功出图张数回推。'
                : isDurationPricing
                ? '优先使用任务已记录的实际费用；若缺失，则按分辨率秒价与视频时长回推。'
                : '优先使用任务已记录的实际费用；若缺失，则按实际上游返回的 totalTokens 和模型单价回推。'}
            </p>
          </div>

          {task.submitter && (
            <div className="bg-zinc-800/30 p-3 rounded-lg">
              <p className="text-xs text-zinc-500">提交人</p>
              <p className="text-sm text-zinc-200 mt-1">
                {task.submitter.name} ({task.submitter.email})
              </p>
            </div>
          )}

          {task.referenceAssets && task.referenceAssets.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-2">参考素材 ({task.referenceAssets.length})</p>
              <div className="flex flex-wrap gap-2">
                {task.referenceAssets.map((asset, idx) => (
                  <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-700">
                    {asset.type === 'image' && <img src={asset.url} alt="" className="w-full h-full object-cover" />}
                    {asset.type === 'video' && <video src={asset.url} preload="metadata" playsInline className="w-full h-full object-cover" />}
                    {asset.type === 'audio' && <div className="w-full h-full flex items-center justify-center text-2xl">🎵</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

            <p className="text-xs text-zinc-500">创建时间: {new Date(task.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </div>
      <ImagePreviewModal
        open={Boolean(previewAsset)}
        imageUrl={previewAsset?.url || null}
        imageName={previewAsset?.name || null}
        onClose={() => setPreviewAsset(null)}
      />
    </>
  )
}
