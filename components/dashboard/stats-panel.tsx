'use client'

import { useEffect, useMemo, useState } from 'react'

type OverviewStats = {
  totalTasks: number
  succeededTasks: number
  processingTasks: number
  totalCost: number
}

type SeedanceBillingBucket = {
  tokens: number
  cost: number
  rateLabel: string
}

type SeedanceBillingStats = {
  withVideo: SeedanceBillingBucket
  withoutVideo: SeedanceBillingBucket
}

type BreakdownStats = {
  key: string
  label: string
  taskKind: 'video' | 'image'
  providerId: string
  providerLabel: string
  taskCount: number
  succeededTaskCount: number
  processingTaskCount: number
  generatedImages: number
  tokens: number
  cost: number
  pricingLabel?: string | null
}

type PersonalQuotaStats = {
  allocatedYuan: string
  usedYuan: string
  reservedYuan: string
  availableYuan: string
}

type TeamMemberStats = {
  id: string
  name: string
  allocatedYuan: string
  usedYuan: string
  reservedYuan: string
  availableYuan: string
  taskCount: number
  videoTaskCount: number
  imageTaskCount: number
  totalCost: string
  videoCost: string
  imageCost: string
}

type TeamStats = {
  name: string
  totalBudgetYuan: string
  allocatedBudgetYuan: string
  unallocatedBudgetYuan: string
  members: TeamMemberStats[]
}

export type DashboardStatsData = {
  isAdmin: boolean
  overview: OverviewStats
  seedanceBilling?: SeedanceBillingStats | null
  providerStats?: BreakdownStats[]
  modelStats?: BreakdownStats[]
  byMode: Record<string, { count: number; tokens: number; cost: number; images?: number }>
  personalQuota?: PersonalQuotaStats
  teamStats?: TeamStats | null
}

type DashboardStatsPanelProps = {
  stats: DashboardStatsData
  statsViewTeam: boolean
  onToggleViewTeam: () => void
  formatTokenCount: (count: number) => string
}

type ProviderFilterOption = {
  id: string
  label: string
}

export function DashboardStatsPanel({
  stats,
  statsViewTeam,
  onToggleViewTeam,
  formatTokenCount,
}: DashboardStatsPanelProps) {
  const [selectedProviderId, setSelectedProviderId] = useState<string>('all')

  const providerOptions = useMemo<ProviderFilterOption[]>(() => {
    const providerMap = new Map<string, string>()

    stats.providerStats?.forEach((item) => {
      providerMap.set(item.providerId, item.providerLabel)
    })

    stats.modelStats?.forEach((item) => {
      providerMap.set(item.providerId, item.providerLabel)
    })

    return [
      { id: 'all', label: '全部厂商' },
      ...Array.from(providerMap.entries()).map(([id, label]) => ({ id, label })),
    ]
  }, [stats.modelStats, stats.providerStats])

  useEffect(() => {
    if (!providerOptions.some((option) => option.id === selectedProviderId)) {
      setSelectedProviderId('all')
    }
  }, [providerOptions, selectedProviderId])

  const filteredProviderStats = useMemo(() => {
    if (selectedProviderId === 'all') {
      return stats.providerStats || []
    }
    return (stats.providerStats || []).filter((item) => item.providerId === selectedProviderId)
  }, [selectedProviderId, stats.providerStats])

  const filteredModelStats = useMemo(() => {
    if (selectedProviderId === 'all') {
      return stats.modelStats || []
    }
    return (stats.modelStats || []).filter((item) => item.providerId === selectedProviderId)
  }, [selectedProviderId, stats.modelStats])

  const selectedProviderLabel = providerOptions.find((option) => option.id === selectedProviderId)?.label || '全部厂商'

  const selectedProviderSummary = useMemo(() => {
    const base = {
      totalTasks: 0,
      succeededTasks: 0,
      processingTasks: 0,
      totalCost: 0,
      totalTokens: 0,
      totalImages: 0,
      videoTasks: 0,
      imageTasks: 0,
      videoCost: 0,
      imageCost: 0,
    }

    filteredProviderStats.forEach((item) => {
      base.totalTasks += item.taskCount
      base.succeededTasks += item.succeededTaskCount
      base.processingTasks += item.processingTaskCount
      base.totalCost += item.cost
      base.totalTokens += item.tokens
      base.totalImages += item.generatedImages

      if (item.taskKind === 'video') {
        base.videoTasks += item.taskCount
        base.videoCost += item.cost
      } else {
        base.imageTasks += item.taskCount
        base.imageCost += item.cost
      }
    })

    return base
  }, [filteredProviderStats])

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 px-4 py-4 pb-8 md:px-6 md:py-6">
        {stats.isAdmin && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">
              {statsViewTeam ? '团队统计' : '个人统计'}
            </h2>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${!statsViewTeam ? 'text-zinc-100' : 'text-zinc-500'}`}>个人</span>
              <button
                onClick={onToggleViewTeam}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  statsViewTeam ? 'bg-indigo-600' : 'bg-zinc-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    statsViewTeam ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm ${statsViewTeam ? 'text-zinc-100' : 'text-zinc-500'}`}>团队</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-400">总任务数</p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{stats.overview.totalTasks}</p>
          </div>
          <div className="glass rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-400">成功任务</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{stats.overview.succeededTasks}</p>
          </div>
          <div className="glass rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-400">处理中</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.overview.processingTasks}</p>
          </div>
          <div className="glass rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-400">总费用</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              ¥{stats.overview.totalCost?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>

        {stats.personalQuota && (
          <div className="glass rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full" />
              <h3 className="font-semibold text-zinc-100">我的预算</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-400">已分配</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">¥{stats.personalQuota.allocatedYuan || '0.00'}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-400">已使用</p>
                <p className="text-2xl font-bold text-orange-400 mt-1">¥{stats.personalQuota.usedYuan || '0.00'}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-400">预扣中</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">¥{stats.personalQuota.reservedYuan || '0.00'}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-400">可用</p>
                <p className="text-2xl font-bold text-green-400 mt-1">¥{stats.personalQuota.availableYuan || '0.00'}</p>
              </div>
            </div>
            {parseFloat(stats.personalQuota.allocatedYuan || '0') > 0 && (
              <div className="mt-4">
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (parseFloat(stats.personalQuota.usedYuan || '0') /
                          parseFloat(stats.personalQuota.allocatedYuan || '1')) *
                          100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1 text-right">
                  {(
                    (parseFloat(stats.personalQuota.usedYuan || '0') /
                      parseFloat(stats.personalQuota.allocatedYuan || '1')) *
                    100
                  ).toFixed(1)}% 已使用
                </p>
              </div>
            )}
          </div>
        )}

        {providerOptions.length > 1 && (
          <div className="glass rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full" />
              <h3 className="font-semibold text-zinc-100">厂商专属统计</h3>
            </div>

            <div className="flex flex-wrap gap-2">
              {providerOptions.map((option) => {
                const isActive = option.id === selectedProviderId
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedProviderId(option.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      isActive
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                        : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="text-xs text-zinc-500">{selectedProviderLabel}任务数</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-100">{selectedProviderSummary.totalTasks}</div>
                <div className="mt-1 text-xs text-zinc-600">
                  成功 {selectedProviderSummary.succeededTasks} · 处理中 {selectedProviderSummary.processingTasks}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="text-xs text-zinc-500">{selectedProviderLabel}总费用</div>
                <div className="mt-1 text-2xl font-semibold text-amber-400">¥{selectedProviderSummary.totalCost.toFixed(2)}</div>
                <div className="mt-1 text-xs text-zinc-600">汇总到该厂商下的全部模型</div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="text-xs text-zinc-500">{selectedProviderLabel}视频</div>
                <div className="mt-1 text-2xl font-semibold text-cyan-400">{selectedProviderSummary.videoTasks}</div>
                <div className="mt-1 text-xs text-zinc-600">费用 ¥{selectedProviderSummary.videoCost.toFixed(2)}</div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="text-xs text-zinc-500">{selectedProviderLabel}图片</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-400">
                  {selectedProviderId === 'all' ? selectedProviderSummary.imageTasks : selectedProviderSummary.totalImages || selectedProviderSummary.imageTasks}
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  费用 ¥{selectedProviderSummary.imageCost.toFixed(2)}
                  {selectedProviderSummary.totalImages > 0 ? ` · 出图 ${selectedProviderSummary.totalImages} 张` : ''}
                </div>
              </div>
            </div>

            {selectedProviderId === 'all' && filteredProviderStats.length > 0 && (
              <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredProviderStats.map((item) => (
                  <div key={item.key} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{item.label}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {item.taskCount} 个任务 · 成功 {item.succeededTaskCount} · 处理中 {item.processingTaskCount}
                        </p>
                      </div>
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                        {item.taskKind === 'video' ? '视频' : '图片'}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-blue-400">Token {formatTokenCount(item.tokens)}</span>
                      {item.generatedImages > 0 && <span className="text-emerald-400">出图 {item.generatedImages} 张</span>}
                      <span className="text-amber-400">¥{item.cost.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {filteredModelStats.length > 0 && (
          <div className="glass rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full" />
              <h3 className="font-semibold text-zinc-100">
                {selectedProviderId === 'all' ? '厂商模型明细' : `${selectedProviderLabel}模型明细`}
              </h3>
            </div>
            <div className="space-y-3">
              {filteredModelStats.map((item) => (
                <div key={item.key} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-zinc-100">{item.label}</span>
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                          {item.providerLabel}
                        </span>
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                          {item.taskKind === 'video' ? '视频' : '图片'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {item.taskCount} 个任务 · 成功 {item.succeededTaskCount} · 处理中 {item.processingTaskCount}
                        {item.pricingLabel ? ` · ${item.pricingLabel}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-zinc-500">
                        {item.taskKind === 'image' ? `出图 ${item.generatedImages} 张` : `Token ${formatTokenCount(item.tokens)}`}
                      </span>
                      <span className="font-medium text-amber-400">¥{item.cost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.seedanceBilling && (selectedProviderId === 'all' || selectedProviderId === 'volcengine') && (
          <div className="glass rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full" />
              <h3 className="font-semibold text-zinc-100">火山视频专属计费</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-300 font-medium">含视频输入</span>
                  <span className="text-xs text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded">
                    {stats.seedanceBilling.withVideo.rateLabel}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-zinc-500">消耗</p>
                    <p className="text-lg font-semibold text-blue-400">
                      {formatTokenCount(stats.seedanceBilling.withVideo.tokens)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">费用</p>
                    <p className="text-lg font-semibold text-amber-400">
                      ¥{stats.seedanceBilling.withVideo.cost.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-300 font-medium">不含视频输入</span>
                  <span className="text-xs text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded">
                    {stats.seedanceBilling.withoutVideo.rateLabel}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-zinc-500">消耗</p>
                    <p className="text-lg font-semibold text-blue-400">
                      {formatTokenCount(stats.seedanceBilling.withoutVideo.tokens)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">费用</p>
                    <p className="text-lg font-semibold text-amber-400">
                      ¥{stats.seedanceBilling.withoutVideo.cost.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="glass rounded-2xl border border-zinc-800 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
            <h3 className="font-semibold text-zinc-100">按模式统计</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(stats.byMode).map(([mode, data]) => (
              <div key={mode} className="flex flex-col gap-2 border-b border-zinc-800 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-zinc-300 capitalize">{mode}</span>
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  <span className="text-sm text-zinc-500">{data.count} 次</span>
                  <span className="text-sm font-medium text-blue-400">
                    {formatTokenCount(data.tokens)} tokens
                  </span>
                  {typeof data.images === 'number' && data.images > 0 && (
                    <span className="text-sm font-medium text-emerald-400">
                      {data.images} 张
                    </span>
                  )}
                  <span className="text-sm font-medium text-amber-400">¥{data.cost?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {stats.isAdmin && stats.teamStats && (
          <div className="glass rounded-2xl border border-zinc-800 p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
              <h3 className="font-semibold text-zinc-100">团队统计 - {stats.teamStats.name}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-400">团队预算池</p>
                <p className="text-2xl font-bold text-indigo-400 mt-1">¥{stats.teamStats.totalBudgetYuan || '0.00'}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-400">已分配</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">¥{stats.teamStats.allocatedBudgetYuan || '0.00'}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-400">未分配</p>
                <p className="text-2xl font-bold text-green-400 mt-1">¥{stats.teamStats.unallocatedBudgetYuan || '0.00'}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-400">团队成员</p>
                <p className="text-2xl font-bold text-zinc-100 mt-1">{stats.teamStats.members?.length || 0}</p>
              </div>
            </div>

            <div className="space-y-3 lg:hidden">
              {stats.teamStats.members?.map((member) => (
                <div key={member.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm text-zinc-100">{member.name}</div>
                    <div className="text-xs text-zinc-500">{member.taskCount} 个任务</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-zinc-800/50 p-3">
                      <div className="text-xs text-zinc-500">已分配</div>
                      <div className="mt-1 text-blue-400">¥{member.allocatedYuan}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-800/50 p-3">
                      <div className="text-xs text-zinc-500">已使用</div>
                      <div className="mt-1 text-orange-400">¥{member.usedYuan}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-800/50 p-3">
                      <div className="text-xs text-zinc-500">预扣中</div>
                      <div className="mt-1 text-yellow-400">¥{member.reservedYuan}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-800/50 p-3">
                      <div className="text-xs text-zinc-500">可用</div>
                      <div className="mt-1 text-green-400">¥{member.availableYuan}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-800/50 p-3">
                      <div className="text-xs text-zinc-500">视频任务</div>
                      <div className="mt-1 text-cyan-400">{member.videoTaskCount}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-800/50 p-3">
                      <div className="text-xs text-zinc-500">图片任务</div>
                      <div className="mt-1 text-emerald-400">{member.imageTaskCount}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-800/50 p-3">
                      <div className="text-xs text-zinc-500">视频费用</div>
                      <div className="mt-1 text-amber-400">¥{member.videoCost}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-800/50 p-3">
                      <div className="text-xs text-zinc-500">图片费用</div>
                      <div className="mt-1 text-purple-400">¥{member.imageCost}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-700 text-left">
                    <th className="px-3 py-2 text-sm font-medium text-zinc-400">成员</th>
                    <th className="px-3 py-2 text-sm font-medium text-zinc-400">已分配</th>
                    <th className="px-3 py-2 text-sm font-medium text-zinc-400">已使用</th>
                    <th className="px-3 py-2 text-sm font-medium text-zinc-400">预扣中</th>
                    <th className="px-3 py-2 text-sm font-medium text-zinc-400">可用</th>
                    <th className="px-3 py-2 text-sm font-medium text-zinc-400">任务数</th>
                    <th className="px-3 py-2 text-sm font-medium text-zinc-400">视频任务</th>
                    <th className="px-3 py-2 text-sm font-medium text-zinc-400">图片任务</th>
                    <th className="px-3 py-2 text-sm font-medium text-zinc-400">视频费用</th>
                    <th className="px-3 py-2 text-sm font-medium text-zinc-400">图片费用</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.teamStats.members?.map((member) => (
                    <tr key={member.id} className="border-b border-zinc-800 hover:bg-zinc-800/30">
                      <td className="px-3 py-3 text-sm text-zinc-300">{member.name}</td>
                      <td className="px-3 py-3 text-sm text-blue-400">¥{member.allocatedYuan}</td>
                      <td className="px-3 py-3 text-sm text-orange-400">¥{member.usedYuan}</td>
                      <td className="px-3 py-3 text-sm text-yellow-400">¥{member.reservedYuan}</td>
                      <td className="px-3 py-3 text-sm text-green-400">¥{member.availableYuan}</td>
                      <td className="px-3 py-3 text-sm text-zinc-400">{member.taskCount}</td>
                      <td className="px-3 py-3 text-sm text-cyan-400">{member.videoTaskCount}</td>
                      <td className="px-3 py-3 text-sm text-emerald-400">{member.imageTaskCount}</td>
                      <td className="px-3 py-3 text-sm text-amber-400">¥{member.videoCost}</td>
                      <td className="px-3 py-3 text-sm text-purple-400">¥{member.imageCost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
