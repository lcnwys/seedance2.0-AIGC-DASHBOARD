'use client'

import type { DashboardTask } from '@/components/dashboard/types'
import { DashboardSelect } from '@/components/dashboard/dashboard-select'
import { getImageModelConfig } from '@/lib/modules/image/models'
import { resolveActualCostYuan, resolveImageActualCostYuan } from '@/lib/modules/billing/cost'
import { getVideoModelConfig } from '@/lib/modules/video/models'

type TaskStatusFilter = 'all' | 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'submit_unknown'

type TaskMemberOption = {
  id: string
  name: string
}

type RefreshTaskResult = {
  success: boolean
  error?: string
}

type TaskListPanelProps = {
  tasks: DashboardTask[]
  isTaskAdmin: boolean
  taskViewAll: boolean
  taskStatusFilter: TaskStatusFilter
  taskMemberFilter: string
  taskTeamMembers: TaskMemberOption[]
  hasMoreTasks: boolean
  onLoadMore: () => void
  onTaskViewAllChange: (checked: boolean) => void
  onTaskStatusFilterChange: (status: TaskStatusFilter) => void
  onTaskMemberFilterChange: (memberId: string) => void
  onRefresh: () => void
  onOpenDetail: (task: DashboardTask) => void
  onRefreshTask: (taskId: string) => Promise<RefreshTaskResult>
  formatTokens: (tokens: number | string) => string
}

export function TaskListPanel({
  tasks,
  isTaskAdmin,
  taskViewAll,
  taskStatusFilter,
  taskMemberFilter,
  taskTeamMembers,
  hasMoreTasks,
  onLoadMore,
  onTaskViewAllChange,
  onTaskStatusFilterChange,
  onTaskMemberFilterChange,
  onRefresh,
  onOpenDetail,
  onRefreshTask,
  formatTokens,
}: TaskListPanelProps) {
  const isProcessingLike = (status: string) =>
    ['processing', 'queued', 'running', 'pending'].includes(status)

  const getProviderLabel = (providerId?: string) => {
    if (providerId === 'aliyun') return '阿里云'
    if (providerId === 'volcengine') return '火山引擎'
    if (providerId === 'grsai') return 'GRSAI'
    return providerId || '未标记厂商'
  }

  const getTaskModelLabel = (task: DashboardTask) =>
    task.taskKind === 'image'
      ? getImageModelConfig(task.model).label
      : getVideoModelConfig(task.model).label

  const getTaskModelId = (task: DashboardTask) =>
    task.providerModelId || task.modelKey || task.model

  const getTaskTypeLabel = (task: DashboardTask) =>
    task.taskKind === 'image' ? '🖼️ 图片' : '🎬 视频'

  const isDurationPricingTask = (task: DashboardTask) =>
    task.taskKind === 'video' && getVideoModelConfig(task.model).pricing.strategy === 'duration'

  const getTaskDurationLabel = (task: DashboardTask) => {
    if (task.mode === 'video_edit' && task.duration === 0) {
      return '原时长'
    }

    if (task.duration === -1) {
      return '智能时长'
    }

    return `${task.duration || 0}s`
  }

  const resolveTaskCost = (task: DashboardTask) => {
    if (task.taskKind === 'image') {
      return resolveImageActualCostYuan({
        costYuan: task.costYuan,
        generatedImages: task.generatedImages || task.outputAssets?.length || 0,
        model: task.model,
        promptExtend: task.promptExtend,
      })
    }

    return resolveActualCostYuan({
      costYuan: task.costYuan,
      totalTokens: task.totalTokens || task.estimatedTokens || 0,
      billingType: task.billingType,
      referenceAssets: task.referenceAssets,
      duration: task.duration,
      resolution: task.resolution,
      model: task.model,
    })
  }

  const getTaskUsageLabel = (task: DashboardTask) => {
    if (['failed', 'expired'].includes(task.status)) {
      return '0'
    }

    if (task.taskKind === 'image') {
      const generatedCount = task.generatedImages || task.outputAssets?.length || 0
      if (generatedCount > 0) {
        return `${generatedCount} 张`
      }
      return formatTokens(task.totalTokens || task.estimatedTokens || 0)
    }

    if (isDurationPricingTask(task)) {
      return getTaskDurationLabel(task)
    }

    return formatTokens(task.totalTokens || task.estimatedTokens || 0)
  }

  const getStatusLabel = (task: DashboardTask) => {
    if (task.status === 'succeeded') return '✅ 成功'
    if (task.status === 'failed') return task.billingType === 'refunded' ? '❌ 失败(已退款)' : '❌ 失败'
    if (task.status === 'expired') return task.billingType === 'refunded' ? '⚠️ 过期(已退款)' : '⚠️ 已过期'
    if (task.status === 'submit_unknown') return '🕒 提交确认中'
    if (task.status === 'queued') return '排队'
    return '处理中'
  }

  const getStatusClassName = (status: string) => {
    if (status === 'succeeded') return 'bg-green-500/10 text-green-400 border border-green-500/30'
    if (status === 'failed') return 'bg-red-500/10 text-red-400 border border-red-500/30'
    if (status === 'expired') return 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
    if (status === 'submit_unknown') return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
    return 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
  }

  const formatGenerationTime = (generationTime?: number) => {
    if (typeof generationTime !== 'number' || generationTime <= 0) {
      return '-'
    }

    if (generationTime < 60) {
      return `${generationTime}s`
    }

    const minutes = Math.floor(generationTime / 60)
    const seconds = generationTime % 60
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }

  return (
    <div className="p-4 md:p-6">
      <div className="glass rounded-2xl border border-zinc-800 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-zinc-100">任务列表</h2>
            {isTaskAdmin && (
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={taskViewAll}
                  onChange={(e) => onTaskViewAllChange(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500/20"
                />
                <span>查看团队所有任务</span>
              </label>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <DashboardSelect
              value={taskStatusFilter}
              onChange={(value) => onTaskStatusFilterChange(value as TaskStatusFilter)}
              className="w-40"
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'succeeded', label: '成功' },
                { value: 'failed', label: '失败' },
                { value: 'refunded', label: '失败已退款' },
                { value: 'submit_unknown', label: '提交确认中' },
                { value: 'processing', label: '处理中' },
                { value: 'pending', label: '排队' },
              ]}
            />

            {isTaskAdmin && taskViewAll && taskTeamMembers.length > 0 && (
              <DashboardSelect
                value={taskMemberFilter}
                onChange={onTaskMemberFilterChange}
                className="w-40"
                options={[
                  { value: 'all', label: '全部成员' },
                  ...taskTeamMembers.map((member) => ({ value: member.id, label: member.name })),
                ]}
              />
            )}

            <button
              onClick={onRefresh}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
            >
              🔄 刷新
            </button>
          </div>
        </div>

        <div className="space-y-4 lg:hidden">
          {tasks.map((task) => {
            const cost = resolveTaskCost(task)

            return (
              <div key={task.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-zinc-100">
                      {getTaskTypeLabel(task)} · {getProviderLabel(task.providerId)}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      模型：{getTaskModelLabel(task)}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      ID：{getTaskModelId(task)}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">模式 · {task.mode}</div>
                    <div className="mt-1 text-xs text-zinc-500">{new Date(task.createdAt).toLocaleString()}</div>
                  </div>
                  {isProcessingLike(task.status) ? (
                    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                      task.status === 'submit_unknown'
                        ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                        : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                    }`}>
                      <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                        task.status === 'submit_unknown' ? 'bg-yellow-400' : 'bg-blue-400'
                      }`} />
                      {getStatusLabel(task)}
                    </span>
                  ) : (
                    <span className={`rounded px-2 py-1 text-xs ${getStatusClassName(task.status)}`}>
                      {getStatusLabel(task)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
                  <div>
                    <div className="text-xs text-zinc-500">消耗</div>
                    <div className={`mt-1 font-mono ${
                      ['failed', 'expired'].includes(task.status)
                        ? 'text-zinc-500'
                        : task.status === 'submit_unknown'
                          ? 'text-yellow-400'
                          : 'text-blue-400'
                    }`}>
                      {getTaskUsageLabel(task)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">费用</div>
                    <div className={`mt-1 ${
                      ['failed', 'expired'].includes(task.status)
                        ? 'text-zinc-500'
                        : task.status === 'submit_unknown'
                          ? 'text-yellow-400'
                          : 'text-green-400'
                    }`}>
                      ¥{['failed', 'expired'].includes(task.status) ? '0.00' : cost.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">生成耗时</div>
                    <div className="mt-1 text-zinc-300">
                      {formatGenerationTime(task.generationTime)}
                    </div>
                  </div>
                  {taskViewAll ? (
                    <div className="col-span-2">
                      <div className="text-xs text-zinc-500">提交人</div>
                      <div className="mt-1 text-sm text-zinc-300">{task.submitter?.name || '-'}</div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => onOpenDetail(task)}
                    className="rounded-lg bg-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-600"
                  >
                    查看详情
                  </button>
                  {['processing', 'queued', 'running', 'pending', 'failed', 'submit_unknown'].includes(task.status) ? (
                    <button
                      onClick={async () => {
                        const result = await onRefreshTask(task.id)
                        if (!result.success) {
                          alert(result.error)
                        }
                      }}
                      disabled={task.isRefreshing}
                      className={`rounded-lg px-3 py-2 text-xs ${
                        task.isRefreshing
                          ? 'cursor-not-allowed bg-zinc-600 text-zinc-400'
                          : 'bg-blue-700 text-blue-300 hover:bg-blue-600'
                      }`}
                    >
                      {task.isRefreshing ? '刷新中' : '刷新状态'}
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="px-3 py-3 text-sm font-medium text-zinc-400">类型</th>
                <th className="px-3 py-3 text-sm font-medium text-zinc-400">状态</th>
                {taskViewAll && <th className="px-3 py-3 text-sm font-medium text-zinc-400">提交人</th>}
                <th className="px-3 py-3 text-sm font-medium text-zinc-400">消耗</th>
                <th className="px-3 py-3 text-sm font-medium text-zinc-400">费用</th>
                <th className="px-3 py-3 text-sm font-medium text-zinc-400">时间</th>
                <th className="px-3 py-3 text-sm font-medium text-zinc-400">耗时</th>
                <th className="px-3 py-3 text-sm font-medium text-zinc-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const cost = resolveTaskCost(task)

                return (
                  <tr key={task.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-3">
                      <div className="text-sm text-zinc-300">
                        {getTaskTypeLabel(task)} · {getProviderLabel(task.providerId)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">模型：{getTaskModelLabel(task)}</div>
                      <div className="mt-1 text-[11px] text-zinc-600">ID：{getTaskModelId(task)}</div>
                      <div className="mt-1 text-xs text-zinc-500">模式 · {task.mode}</div>
                      {(task.billingType === 'with_video' || task.referenceAssets?.some((asset) => asset.type === 'video')) && (
                        <span className="ml-1 text-xs text-blue-400">📹</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {isProcessingLike(task.status) ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${
                          task.status === 'submit_unknown'
                            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                            task.status === 'submit_unknown' ? 'bg-yellow-400' : 'bg-blue-400'
                          }`} />
                          {getStatusLabel(task)}
                        </span>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded ${getStatusClassName(task.status)}`}>
                          {getStatusLabel(task)}
                        </span>
                      )}
                    </td>
                    {taskViewAll && (
                      <td className="px-3 py-3 text-sm text-zinc-400">{task.submitter?.name || '-'}</td>
                    )}
                    <td className="px-3 py-3">
                      <span className={`text-sm font-mono ${
                        ['failed', 'expired'].includes(task.status) ? 'text-zinc-500' : task.status === 'submit_unknown' ? 'text-yellow-400' : 'text-blue-400'
                      }`}>
                        {getTaskUsageLabel(task)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-sm ${
                        ['failed', 'expired'].includes(task.status) ? 'text-zinc-500' : task.status === 'submit_unknown' ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        ¥{['failed', 'expired'].includes(task.status) ? '0.00' : cost.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-500">{new Date(task.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs text-zinc-400">
                      {formatGenerationTime(task.generationTime)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onOpenDetail(task)}
                          className="px-2 py-1 text-xs rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                        >
                          详情 ▶
                        </button>
                        {['processing', 'queued', 'running', 'pending', 'failed', 'submit_unknown'].includes(task.status) && (
                          <button
                            onClick={async () => {
                              const result = await onRefreshTask(task.id)
                              if (!result.success) {
                                alert(result.error)
                              }
                            }}
                            disabled={task.isRefreshing}
                            className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                              task.isRefreshing
                                ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed'
                                : 'bg-blue-700 text-blue-300 hover:bg-blue-600'
                            }`}
                            title={task.status === 'submit_unknown' ? '手动确认上游是否已创建任务' : '手动刷新任务状态，解除预扣预算'}
                          >
                            {task.isRefreshing ? (
                              <>
                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  />
                                </svg>
                                刷新中
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                </svg>
                                刷新
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {tasks.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-zinc-900 flex items-center justify-center">
              <svg className="w-10 h-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <p className="text-zinc-500">暂无任务</p>
          </div>
        )}
        
        {/* Load More Button */}
        {hasMoreTasks && tasks.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={onLoadMore}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 transition-all"
            >
              加载更多
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
