'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { DashboardTask as Task } from '@/components/dashboard/types'
import { ImagePreviewModal } from '@/components/dashboard/image-preview-modal'
import { resolveActualCostYuan } from '@/lib/modules/billing/cost'
import { getImageModelConfig } from '@/lib/modules/image/models'
import { getVideoModelConfig } from '@/lib/modules/video/models'

const PROMPT_COLLAPSE_THRESHOLD = 220
const PROCESSING_STATUSES = ['processing', 'queued', 'running', 'pending', 'submit_unknown']
const FAILED_STATUSES = ['failed', 'expired']

interface GenerationDisplayPanelProps {
  activeTab: 'ai-video' | 'ai-image'
  displayFilter: 'all' | 'video' | 'image'
  statusFilter: 'all' | 'succeeded' | 'failed' | 'processing'
  tasks: Task[]
  rightPanelTasks: Task[]
  filteredRightPanelTasks: Task[]
  isGenerating: boolean
  onDisplayFilterChange: (filter: 'all' | 'video' | 'image') => void
  onStatusFilterChange: (filter: 'all' | 'succeeded' | 'failed' | 'processing') => void
  onRefresh: () => void
  onReEdit: (task: Task, batchSize?: number) => void
  onReGenerate: (task: Task, batchSize?: number) => void
  onUseImageTaskAsReference: (task: Task) => Promise<void> | void
  onDeleteImageTask: (task: Task) => Promise<{ success: boolean; error?: string }>
  onUseVideoTasksAsReference: (tasks: Task[]) => Promise<void> | void
  onDeleteVideoTasks: (tasks: Task[]) => Promise<{ success: boolean; error?: string }>
  onVideoEdit: (task: Task) => void
  renderPromptWithRefs: (task: Task) => ReactNode
  getModeLabel: (mode: string) => string
  formatGenerationTime: (seconds: number) => string | null
}

type TaskDisplayGroup =
  | {
      id: string
      taskKind: 'image'
      primaryTask: Task
      tasks: [Task]
    }
  | {
      id: string
      taskKind: 'video'
      primaryTask: Task
      tasks: Task[]
    }

function isProcessingStatus(status: string) {
  return PROCESSING_STATUSES.includes(status)
}

function isFailedStatus(status: string) {
  return FAILED_STATUSES.includes(status)
}

function getProviderLabel(providerId?: string) {
  if (providerId === 'aliyun') return '阿里云'
  if (providerId === 'volcengine') return '火山引擎'
  if (providerId === 'grsai') return 'GRSAI'
  return providerId || '未标记厂商'
}

function getTaskModelLabel(task: Task) {
  return task.taskKind === 'image'
    ? getImageModelConfig(task.model).label
    : getVideoModelConfig(task.model).label
}

function getTaskDurationLabel(task: Task) {
  if (task.mode === 'video_edit' && task.duration === 0) {
    return '原时长'
  }

  return `${task.duration || 5}s`
}

function getTaskStatusChip(task: Task) {
  if (task.status === 'succeeded') {
    return { className: 'bg-green-500/20 text-green-400', label: '✅ 成功' }
  }
  if (task.status === 'failed') {
    return {
      className: 'bg-red-500/20 text-red-400',
      label: task.billingType === 'refunded' ? '❌ 失败(已退款)' : '❌ 失败',
    }
  }
  if (task.status === 'expired') {
    return {
      className: 'bg-orange-500/20 text-orange-400',
      label: task.billingType === 'refunded' ? '⚠️ 过期(已退款)' : '⚠️ 已过期',
    }
  }
  if (task.status === 'submit_unknown') {
    return { className: 'bg-yellow-500/20 text-yellow-400', label: '🕒 提交确认中' }
  }
  if (task.status === 'queued') {
    return { className: 'bg-blue-500/20 text-blue-400', label: '⌛ 排队中' }
  }
  if (['processing', 'running'].includes(task.status)) {
    return { className: 'bg-blue-500/20 text-blue-400', label: '✨ 生成中' }
  }
  return { className: 'bg-yellow-500/20 text-yellow-400', label: '⏳ 处理中' }
}

function getBatchStatusChip(tasks: Task[]) {
  const total = tasks.length
  const succeeded = tasks.filter((task) => task.status === 'succeeded').length
  const failed = tasks.filter((task) => isFailedStatus(task.status)).length
  const processing = tasks.filter((task) => isProcessingStatus(task.status)).length
  const submitUnknown = tasks.filter((task) => task.status === 'submit_unknown').length

  if (processing > 0) {
    return {
      className: submitUnknown > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400',
      label: submitUnknown > 0 ? `🕒 确认中 ${processing}/${total}` : `✨ 生成中 ${processing}/${total}`,
    }
  }
  if (succeeded === total) {
    return {
      className: 'bg-green-500/20 text-green-400',
      label: total > 1 ? `✅ 成功 ${succeeded}/${total}` : '✅ 成功',
    }
  }
  if (failed === total) {
    return {
      className: 'bg-red-500/20 text-red-400',
      label: total > 1 ? `❌ 失败 ${failed}/${total}` : '❌ 失败',
    }
  }
  return {
    className: 'bg-amber-500/20 text-amber-400',
    label: `⚠️ 部分完成 ${succeeded}/${total}`,
  }
}

function getImageGridClassName(count: number) {
  if (count <= 1) {
    return 'grid-cols-1'
  }

  if (count === 2) {
    return 'grid-cols-2'
  }

  if (count === 3) {
    return 'grid-cols-2 md:grid-cols-3'
  }

  if (count <= 6) {
    return 'grid-cols-2 md:grid-cols-3'
  }

  if (count <= 9) {
    return 'grid-cols-3 md:grid-cols-4'
  }

  return 'grid-cols-3 md:grid-cols-4 2xl:grid-cols-5'
}

function getImageFrameClassName(count: number) {
  if (count <= 1) {
    return 'h-[220px] sm:h-[260px] xl:h-[320px]'
  }

  if (count === 2) {
    return 'h-[170px] sm:h-[200px] xl:h-[220px]'
  }

  if (count <= 4) {
    return 'h-[148px] sm:h-[170px] xl:h-[190px]'
  }

  if (count <= 8) {
    return 'h-[124px] sm:h-[140px] xl:h-[156px]'
  }

  return 'h-[108px] sm:h-[124px] xl:h-[136px]'
}

function getVideoGridStyle(count: number): CSSProperties {
  const minWidth = count >= 4 ? 220 : count === 3 ? 240 : 280
  return { gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))` }
}

function buildDownloadName(task: Task, fallbackExtension: string) {
  const modelLabel = task.model || 'video'
  const suffix = task.externalId || task.id
  return `${modelLabel}-${suffix}.${fallbackExtension}`
}

function downloadMediaFile(url: string, filename: string) {
  if (typeof document === 'undefined') {
    return
  }

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.target = '_blank'
  anchor.rel = 'noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

function useDeferredMediaLoad(rootMargin = '320px') {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    if (shouldLoad) return

    const element = elementRef.current
    if (!element) return

    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [rootMargin, shouldLoad])

  return { elementRef, shouldLoad }
}

function DeferredImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className: string
}) {
  const { elementRef, shouldLoad } = useDeferredMediaLoad()

  return (
    <div ref={elementRef} className={className}>
      {shouldLoad ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={className}
        />
      ) : (
        <div className={`${className} animate-pulse bg-zinc-900/80`} />
      )}
    </div>
  )
}

function DeferredVideo({
  src,
  className,
  controls = false,
}: {
  src: string
  className: string
  controls?: boolean
}) {
  const { elementRef, shouldLoad } = useDeferredMediaLoad()

  return (
    <div ref={elementRef} className={className}>
      {shouldLoad ? (
        <video
          src={src}
          controls={controls}
          preload="metadata"
          playsInline
          className={className}
        />
      ) : (
        <div className={`${className} flex flex-col items-center justify-center gap-2 bg-zinc-900/80 text-zinc-500`}>
          <span className="text-lg">{controls ? '🎬' : '▶'}</span>
          <span className="text-[11px] text-zinc-600">正在加载视频首帧</span>
        </div>
      )}
    </div>
  )
}

function groupTasksForDisplay(tasks: Task[]): TaskDisplayGroup[] {
  const groups: TaskDisplayGroup[] = []
  const videoGroupMap = new Map<string, Extract<TaskDisplayGroup, { taskKind: 'video' }>>()

  for (const task of tasks) {
    if (task.taskKind === 'image') {
      groups.push({
        id: task.id,
        taskKind: 'image',
        primaryTask: task,
        tasks: [task],
      })
      continue
    }

    const groupKey = task.batchId ? `video:${task.batchId}` : `video:${task.id}`
    const existing = videoGroupMap.get(groupKey)

    if (existing) {
      existing.tasks.push(task)
      continue
    }

    const group: Extract<TaskDisplayGroup, { taskKind: 'video' }> = {
      id: groupKey,
      taskKind: 'video',
      primaryTask: task,
      tasks: [task],
    }

    videoGroupMap.set(groupKey, group)
    groups.push(group)
  }

  return groups.map((group) => {
    if (group.taskKind === 'image') {
      return group
    }

    const sortedTasks = [...group.tasks].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    )

    return {
      ...group,
      primaryTask: sortedTasks[0] || group.primaryTask,
      tasks: sortedTasks,
    }
  })
}

function CollapsiblePrompt({
  task,
  renderPromptWithRefs,
}: {
  task: Task
  renderPromptWithRefs: (task: Task) => ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const shouldCollapse = task.prompt.trim().length > PROMPT_COLLAPSE_THRESHOLD || task.prompt.includes('\n')

  return (
    <div className="mb-3">
      <div
        className={`relative text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap break-words ${
          shouldCollapse && !expanded ? 'max-h-40 overflow-hidden' : ''
        }`}
      >
        {renderPromptWithRefs(task)}
        {shouldCollapse && !expanded ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-transparent" />
        ) : null}
      </div>

      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <span>{expanded ? '收起提示词' : '展开提示词'}</span>
          <svg
            className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

function VideoPreviewModal({
  open,
  task,
  onClose,
}: {
  open: boolean
  task: Task | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open || !task?.outputUrl) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-zinc-100">
              {task.externalId || task.id}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              移动端可直接使用下方按钮下载视频
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <a
              href={task.outputUrl}
              download={buildDownloadName(task, 'mp4')}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              下载视频
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
            >
              关闭
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_55%)]">
          <div className="flex min-h-full min-w-full items-center justify-center p-4 md:p-6">
            <video
              src={task.outputUrl}
              controls
              preload="metadata"
              playsInline
              className="max-h-[calc(92vh-170px)] w-full rounded-2xl bg-black object-contain shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>

        <div className="border-t border-zinc-800 bg-zinc-950/95 p-4 md:hidden">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => downloadMediaFile(task.outputUrl!, buildDownloadName(task, 'mp4'))}
              className="rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              下载视频
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ImageTaskCard({
  task,
  isGenerating,
  onReEdit,
  onReGenerate,
  onUseImageTaskAsReference,
  onDeleteImageTask,
  renderPromptWithRefs,
  getModeLabel,
}: {
  task: Task
  isGenerating: boolean
  onReEdit: (task: Task, batchSize?: number) => void
  onReGenerate: (task: Task, batchSize?: number) => void
  onUseImageTaskAsReference: (task: Task) => Promise<void> | void
  onDeleteImageTask: (task: Task) => Promise<{ success: boolean; error?: string }>
  renderPromptWithRefs: (task: Task) => ReactNode
  getModeLabel: (mode: string) => string
}) {
  const isProcessing = isProcessingStatus(task.status)
  const outputAssets = task.outputAssets || []
  const statusChip = getTaskStatusChip(task)
  const providerLabel = getProviderLabel(task.providerId)
  const modelLabel = getTaskModelLabel(task)
  const [previewAsset, setPreviewAsset] = useState<{ url: string; name: string } | null>(null)
  const [isUsingAsReference, setIsUsingAsReference] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleUseAsReference = async () => {
    if (outputAssets.length === 0 || isUsingAsReference) {
      return
    }

    try {
      setIsUsingAsReference(true)
      await onUseImageTaskAsReference(task)
    } finally {
      setIsUsingAsReference(false)
    }
  }

  const handleDelete = async () => {
    if (isDeleting) {
      return
    }

    const confirmed = window.confirm('删除这条图片任务记录？已生成素材会保留在资产库中。')
    if (!confirmed) {
      return
    }

    try {
      setIsDeleting(true)
      const result = await onDeleteImageTask(task)
      if (!result.success && result.error) {
        window.alert(result.error)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="glass overflow-hidden rounded-2xl border border-zinc-800">
        <div className="border-b border-zinc-800 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">{new Date(task.createdAt).toLocaleString()}</span>
            <span className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400">
              {task.size || task.resolution || '2K'}
            </span>
            {isProcessing ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 animate-pulse">
                <svg className="h-3 w-3 animate-spin text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-blue-400">生成中...</span>
              </span>
            ) : null}
            {task.generatedImages ? (
              <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                输出 {task.generatedImages} 张
              </span>
            ) : null}
          </div>
          <span className={`rounded-full px-2 py-1 text-xs ${statusChip.className}`}>
            {statusChip.label}
          </span>
        </div>

        <CollapsiblePrompt task={task} renderPromptWithRefs={renderPromptWithRefs} />

        <div className="flex flex-wrap gap-2">
          <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
            {providerLabel}
          </span>
          <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
            {modelLabel}
          </span>
          <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
            {getModeLabel(task.mode)}
          </span>
          <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
            {task.outputFormat?.toUpperCase() || 'JPEG'}
          </span>
          {task.outputTokens ? (
            <span className="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
              实际 {task.outputTokens.toLocaleString()} output tokens
            </span>
          ) : null}
          {task.costYuan ? (
            <span className="rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-400">
              实际计费 ¥{task.costYuan.toFixed(2)}
            </span>
          ) : null}
        </div>
        </div>

        <div className="p-4">
          {outputAssets.length > 0 ? (
            <div className={`grid gap-3 ${getImageGridClassName(outputAssets.length)}`}>
              {outputAssets.map((asset, index) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setPreviewAsset({ url: asset.url, name: asset.name })}
                  className="group relative block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-left transition-all hover:border-emerald-500/40"
                >
                  <span className="absolute left-2 top-2 z-10 rounded bg-black/65 px-2 py-0.5 text-[11px] text-zinc-200">
                    #{index + 1}
                  </span>
                  <span className="absolute right-2 top-2 z-10 rounded bg-black/65 px-2 py-0.5 text-[11px] text-zinc-200 opacity-0 transition-opacity group-hover:opacity-100">
                    预览
                  </span>
                  <div className={`flex items-center justify-center overflow-hidden bg-zinc-900 ${getImageFrameClassName(outputAssets.length)}`}>
                    <DeferredImage
                      src={asset.url}
                      alt={asset.name}
                      className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : isProcessing ? (
            <div className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-xl bg-zinc-900/50 md:min-h-[260px]">
              <div className="relative">
                <div className="h-20 w-20 animate-spin rounded-full border-4 border-zinc-700 border-t-emerald-500" />
                <div className="absolute inset-3 animate-pulse rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🖼️</span>
                </div>
              </div>
              <div className="mt-4 text-zinc-300">AI 正在生成图片...</div>
              <div className="mt-3 flex gap-1.5">
                <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl bg-red-950/20 p-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                <span className="text-3xl">❌</span>
              </div>
              <h4 className="mb-2 font-medium text-red-400">图片生成失败</h4>
              <div className="max-w-lg whitespace-pre-line px-4 text-center text-sm text-red-300/70">
                {task.errorMessage || '图片生成过程中发生错误，请检查参数后重试'}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 pt-0 xl:grid-cols-4">
          <button
            onClick={() => onReEdit(task)}
            className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            重新编辑
          </button>
          <button
            onClick={() => onReGenerate(task)}
            disabled={isGenerating}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:from-emerald-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            重新生成
          </button>
          <button
            onClick={handleUseAsReference}
            disabled={outputAssets.length === 0 || isUsingAsReference}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-emerald-500/40 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUsingAsReference ? '处理中...' : '作为参考'}
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? '删除中...' : '删除'}
          </button>
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

function VideoOutputTile({
  task,
  index,
  formatGenerationTime,
  onPreview,
}: {
  task: Task
  index: number
  formatGenerationTime: (seconds: number) => string | null
  onPreview: (task: Task) => void
}) {
  const statusChip = getTaskStatusChip(task)
  const isDurationPricing = getVideoModelConfig(task.model).pricing.strategy === 'duration'
  const actualTokens = task.totalTokens || 0
  const actualCostYuan = resolveActualCostYuan({
    costYuan: task.costYuan,
    totalTokens: task.totalTokens,
    billingType: task.billingType,
    duration: task.duration,
    resolution: task.resolution,
    referenceAssets: task.referenceAssets,
    model: task.model,
  })
  const showActualUsage =
    task.status === 'succeeded'
    || (actualTokens > 0 && !FAILED_STATUSES.includes(task.status))

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="relative">
        <span className="absolute left-3 top-3 z-10 rounded bg-black/70 px-2 py-0.5 text-[11px] text-zinc-100">
          #{index + 1}
        </span>
        <span className={`absolute right-3 top-3 z-10 rounded-full px-2 py-0.5 text-[11px] ${statusChip.className}`}>
          {statusChip.label}
        </span>

        {task.outputUrl ? (
          <div className="relative">
            <DeferredVideo
              src={task.outputUrl}
              controls
              className="aspect-video w-full bg-black object-contain"
            />
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onPreview(task)}
                className="rounded-lg bg-black/70 px-3 py-2 text-xs font-medium text-zinc-100 backdrop-blur transition-colors hover:bg-black/80"
              >
                预览
              </button>
              <button
                type="button"
                onClick={() => downloadMediaFile(task.outputUrl!, buildDownloadName(task, 'mp4'))}
                className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 transition-colors hover:bg-white"
              >
                下载视频
              </button>
            </div>
          </div>
        ) : isFailedStatus(task.status) ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center bg-red-950/20 p-5">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
              <span className="text-2xl">❌</span>
            </div>
            <div className="text-sm font-medium text-red-400">生成失败</div>
            <div className="mt-2 max-h-16 overflow-hidden text-center text-xs leading-5 text-red-300/70">
              {task.errorMessage || '视频生成过程中发生错误'}
            </div>
          </div>
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center bg-zinc-900/60">
            {isProcessingStatus(task.status) ? (
              <>
                <div className="relative">
                  <div className={`h-16 w-16 rounded-full border-4 border-zinc-700 ${
                    task.status === 'submit_unknown' ? 'border-t-yellow-500' : 'animate-spin border-t-blue-500'
                  }`} />
                  <div className={`absolute inset-2 animate-pulse rounded-full ${
                    task.status === 'submit_unknown'
                      ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/20'
                      : 'bg-gradient-to-br from-blue-500/20 to-purple-500/20'
                  }`} />
                  <div className="absolute inset-0 flex items-center justify-center text-xl">
                    {task.status === 'submit_unknown' ? '🕒' : '✨'}
                  </div>
                </div>
                <div className={`mt-3 text-sm ${task.status === 'submit_unknown' ? 'text-yellow-400' : 'text-zinc-300'}`}>
                  {task.status === 'submit_unknown'
                    ? '确认任务中...'
                    : task.status === 'queued'
                      ? '排队中...'
                      : '生成中...'}
                </div>
              </>
            ) : (
              <span className="text-zinc-500">等待处理...</span>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 p-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {task.externalId ? (
            <span className="rounded bg-zinc-800 px-2 py-1 font-mono text-zinc-400">
              {task.externalId}
            </span>
          ) : null}
          {task.generationTime ? (
            <span className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-400">
              耗时 {formatGenerationTime(task.generationTime)}
            </span>
          ) : null}
          {showActualUsage && !isDurationPricing ? (
            <span className="rounded bg-blue-500/10 px-2 py-1 text-blue-400">
              {actualTokens.toLocaleString()} tokens
            </span>
          ) : null}
          {showActualUsage ? (
            <span className="rounded bg-amber-500/10 px-2 py-1 text-amber-400">
              ¥{actualCostYuan.toFixed(2)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function VideoTaskBatchCard({
  tasks,
  isGenerating,
  onReEdit,
  onReGenerate,
  onUseVideoTasksAsReference,
  onDeleteVideoTasks,
  renderPromptWithRefs,
  getModeLabel,
  formatGenerationTime,
}: {
  tasks: Task[]
  isGenerating: boolean
  onReEdit: (task: Task, batchSize?: number) => void
  onReGenerate: (task: Task, batchSize?: number) => void
  onUseVideoTasksAsReference: (tasks: Task[]) => Promise<void> | void
  onDeleteVideoTasks: (tasks: Task[]) => Promise<{ success: boolean; error?: string }>
  renderPromptWithRefs: (task: Task) => ReactNode
  getModeLabel: (mode: string) => string
  formatGenerationTime: (seconds: number) => string | null
}) {
  const primaryTask = tasks[0]
  const batchSize = tasks.length
  const isDurationPricing = getVideoModelConfig(primaryTask.model).pricing.strategy === 'duration'
  const estimatedTokensTotal = tasks.reduce((sum, task) => sum + (task.estimatedTokens || 0), 0)
  const actualTokensTotal = tasks.reduce((sum, task) => sum + (task.totalTokens || 0), 0)
  const actualCostTotal = tasks.reduce(
    (sum, task) =>
      sum + resolveActualCostYuan({
        costYuan: task.costYuan,
        totalTokens: task.totalTokens,
        billingType: task.billingType,
        duration: task.duration,
        resolution: task.resolution,
        referenceAssets: task.referenceAssets,
        model: task.model,
      }),
    0,
  )
  const succeededCount = tasks.filter((task) => task.status === 'succeeded').length
  const processingCount = tasks.filter((task) => isProcessingStatus(task.status)).length
  const completedCount = tasks.filter((task) => !isProcessingStatus(task.status)).length
  const batchStatusChip = getBatchStatusChip(tasks)
  const showActualUsage =
    succeededCount > 0 || actualTokensTotal > 0 || actualCostTotal > 0
  const [isUsingAsReference, setIsUsingAsReference] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewTask, setPreviewTask] = useState<Task | null>(null)

  const referenceableTaskCount = tasks.filter((task) => task.outputUrl).length
  const canVideoEdit = batchSize === 1 && Boolean(primaryTask.outputUrl)

  const handleUseAsReference = async () => {
    if (referenceableTaskCount === 0 || isUsingAsReference) {
      return
    }

    try {
      setIsUsingAsReference(true)
      await onUseVideoTasksAsReference(tasks)
    } finally {
      setIsUsingAsReference(false)
    }
  }

  const handleDelete = async () => {
    if (isDeleting) {
      return
    }

    const confirmed = window.confirm(batchSize > 1
      ? `删除这组 ${batchSize} 条视频任务记录？`
      : '删除这条视频任务记录？')

    if (!confirmed) {
      return
    }

    try {
      setIsDeleting(true)
      const result = await onDeleteVideoTasks(tasks)
      if (!result.success && result.error) {
        window.alert(result.error)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="glass overflow-hidden rounded-2xl border border-zinc-800">
        <div className="border-b border-zinc-800 p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-zinc-500">
                {new Date(primaryTask.createdAt).toLocaleString()}
              </span>
              {batchSize === 1 && primaryTask.externalId ? (
                <span className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-xs font-mono text-zinc-400" title="上游任务 ID">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  ID: {primaryTask.externalId}
                </span>
              ) : null}
              {batchSize > 1 ? (
                <span className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-300">
                  输出 {batchSize} 条
                </span>
              ) : null}
              {primaryTask.generationTime && batchSize === 1 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-2 py-0.5">
                  <svg className="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-medium text-emerald-400">
                    耗时 {formatGenerationTime(primaryTask.generationTime)}
                  </span>
                </span>
              ) : null}
              {batchSize > 1 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-xs text-zinc-300">
                  已完成 {completedCount}/{batchSize}
                </span>
              ) : null}
            </div>
            <span className={`rounded-full px-2 py-1 text-xs ${batchStatusChip.className}`}>
              {batchStatusChip.label}
            </span>
          </div>

          <CollapsiblePrompt task={primaryTask} renderPromptWithRefs={renderPromptWithRefs} />

          <div className="flex flex-wrap gap-2">
            <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
              {getModeLabel(primaryTask.mode)}
            </span>
            <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
              {primaryTask.resolution || getVideoModelConfig(primaryTask.model).defaultResolution}
            </span>
            <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
              {primaryTask.ratio || getVideoModelConfig(primaryTask.model).defaultRatio}
            </span>
            <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
              {getTaskDurationLabel(primaryTask)}
            </span>
            {primaryTask.generateAudio ? (
              <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
                🔊 生成音频
              </span>
            ) : null}
            <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
              {batchSize} 条输出
            </span>
            {estimatedTokensTotal > 0 && !isDurationPricing ? (
              <span className="rounded bg-blue-500/10 px-2 py-1 text-xs text-blue-400">
                预估 {estimatedTokensTotal.toLocaleString()} tokens
              </span>
            ) : null}
            {isDurationPricing ? (
              <span className="rounded bg-blue-500/10 px-2 py-1 text-xs text-blue-400">
                预估 {primaryTask.mode === 'video_edit' && primaryTask.duration === 0 ? '原时长' : primaryTask.duration === -1 ? '智能时长' : `${primaryTask.duration || 0}s`} x {batchSize}
              </span>
            ) : null}
            {showActualUsage && !isDurationPricing ? (
              <span className="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
                实际 {actualTokensTotal.toLocaleString()} tokens
              </span>
            ) : null}
            {showActualUsage ? (
              <span className="rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-400">
                实际计费 ¥{actualCostTotal.toFixed(2)}
              </span>
            ) : null}
            {processingCount > 0 ? (
              <span className="rounded bg-violet-500/10 px-2 py-1 text-xs text-violet-300">
                进行中 {processingCount} 条
              </span>
            ) : null}
          </div>
        </div>

        <div className="p-4">
          <div className="grid gap-4" style={getVideoGridStyle(batchSize)}>
            {tasks.map((task, index) => (
              <VideoOutputTile
                key={task.id}
                task={task}
                index={index}
                formatGenerationTime={formatGenerationTime}
                onPreview={setPreviewTask}
              />
            ))}
          </div>
        </div>

        <div className={`grid grid-cols-2 gap-3 p-4 pt-0 ${canVideoEdit ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
          <button
            onClick={() => onReEdit(primaryTask, batchSize)}
            className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            {batchSize > 1 ? '整组回填' : '重新编辑'}
          </button>
          <button
            onClick={() => onReGenerate(primaryTask, batchSize)}
            disabled={isGenerating}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:from-blue-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {batchSize > 1 ? `重新生成 ${batchSize} 条` : '重新生成'}
          </button>
          <button
            onClick={handleUseAsReference}
            disabled={referenceableTaskCount === 0 || isUsingAsReference}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-blue-500/40 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUsingAsReference ? '处理中...' : '作为参考'}
          </button>
          {canVideoEdit ? (
            <button
              onClick={() => onVideoEdit(primaryTask)}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/15"
            >
              视频编辑
            </button>
          ) : null}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? '删除中...' : '删除'}
          </button>
        </div>
      </div>

      <VideoPreviewModal
        open={Boolean(previewTask)}
        task={previewTask}
        onClose={() => setPreviewTask(null)}
      />
    </>
  )
}

export function GenerationDisplayPanel({
  activeTab,
  displayFilter,
  statusFilter,
  tasks,
  rightPanelTasks,
  filteredRightPanelTasks,
  isGenerating,
  onDisplayFilterChange,
  onStatusFilterChange,
  onRefresh,
  onReEdit,
  onReGenerate,
  onUseImageTaskAsReference,
  onDeleteImageTask,
  onUseVideoTasksAsReference,
  onDeleteVideoTasks,
  onVideoEdit,
  renderPromptWithRefs,
  getModeLabel,
  formatGenerationTime,
}: GenerationDisplayPanelProps) {
  const displayScopedTasks = rightPanelTasks.filter((task) => {
    const isImageTask = task.taskKind === 'image'
    if (displayFilter === 'video') return !isImageTask
    if (displayFilter === 'image') return isImageTask
    return true
  })

  const statusCounts = {
    all: displayScopedTasks.length,
    succeeded: displayScopedTasks.filter((task) => task.status === 'succeeded').length,
    failed: displayScopedTasks.filter((task) => task.status === 'failed' || task.status === 'expired').length,
    processing: displayScopedTasks.filter((task) => PROCESSING_STATUSES.includes(task.status)).length,
  }

  const displayGroups = useMemo(
    () => groupTasksForDisplay(filteredRightPanelTasks),
    [filteredRightPanelTasks],
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-4 md:px-6 md:pt-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onDisplayFilterChange('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                displayFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => onDisplayFilterChange('video')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                displayFilter === 'video'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              视频
            </button>
            <button
              onClick={() => onDisplayFilterChange('image')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                displayFilter === 'image'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              图片
            </button>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
            title="刷新列表"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-zinc-500">状态：</span>
          <button
            onClick={() => onStatusFilterChange('all')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            全部 ({statusCounts.all})
          </button>
          <button
            onClick={() => onStatusFilterChange('succeeded')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              statusFilter === 'succeeded'
                ? 'bg-green-600/30 text-green-400 border border-green-500/40'
                : 'text-zinc-500 hover:text-green-400 hover:bg-green-500/10'
            }`}
          >
            ✅ 成功 ({statusCounts.succeeded})
          </button>
          <button
            onClick={() => onStatusFilterChange('failed')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              statusFilter === 'failed'
                ? 'bg-red-600/30 text-red-400 border border-red-500/40'
                : 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10'
            }`}
          >
            ❌ 失败 ({statusCounts.failed})
          </button>
          <button
            onClick={() => onStatusFilterChange('processing')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              statusFilter === 'processing'
                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                : 'text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10'
            }`}
          >
            ⏳ 进行中 ({statusCounts.processing})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 md:px-6">
        <div className="space-y-4 md:space-y-6">
          {displayGroups.map((group) => (
            group.taskKind === 'image' ? (
              <ImageTaskCard
                key={group.id}
                task={group.primaryTask}
                isGenerating={isGenerating}
                onReEdit={onReEdit}
                onReGenerate={onReGenerate}
                onUseImageTaskAsReference={onUseImageTaskAsReference}
                onDeleteImageTask={onDeleteImageTask}
                renderPromptWithRefs={renderPromptWithRefs}
                getModeLabel={getModeLabel}
              />
            ) : (
              <VideoTaskBatchCard
                key={group.id}
                tasks={group.tasks}
                isGenerating={isGenerating}
                onReEdit={onReEdit}
                onReGenerate={onReGenerate}
                onUseVideoTasksAsReference={onUseVideoTasksAsReference}
                onDeleteVideoTasks={onDeleteVideoTasks}
                renderPromptWithRefs={renderPromptWithRefs}
                getModeLabel={getModeLabel}
                formatGenerationTime={formatGenerationTime}
              />
            )
          ))}
        </div>

        {rightPanelTasks.length > 0 && filteredRightPanelTasks.length === 0 && (
          <div className="py-16 text-center md:py-20">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900">
              <span className="text-3xl">
                {statusFilter === 'succeeded' ? '✅' : statusFilter === 'failed' ? '❌' : '⏳'}
              </span>
            </div>
            <h3 className="text-zinc-400 font-medium mb-2">
              当前筛选条件下暂无记录
            </h3>
            <p className="text-zinc-500 text-sm">
              可以切换顶部“全部 / 视频 / 图片”或状态筛选查看其他记录。
            </p>
          </div>
        )}

        {rightPanelTasks.length === 0 && (
          <div className="py-16 text-center md:py-20">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-900">
              <span className="text-4xl">{displayFilter === 'image' ? '🖼️' : displayFilter === 'video' ? '🎬' : '✨'}</span>
            </div>
            <h3 className="text-zinc-400 font-medium mb-2">暂无生成记录</h3>
            <p className="text-zinc-500 text-sm">
              在左侧配置参数后点击生成，右侧会统一展示图片和视频记录
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
