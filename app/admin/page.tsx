'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TaskDetailModal } from '@/components/dashboard/task-detail-modal'
import type { DashboardTask } from '@/components/dashboard/types'

interface TeamStats {
  taskCount: number
  totalTokens: number
  costYuan: number
}

interface MemberStats {
  id: string
  email: string
  name: string
  role: string
  localStats: TeamStats
}

interface Team {
  id: string
  name: string
  description: string | null
  defaultVideoProviderId: string
  seedanceApiKey: string | null
  seedanceApiUrl: string
  hasApiKey: boolean
  createdAt: string
  localStats: TeamStats
  members: MemberStats[]
  memberCount: number
}

interface Summary {
  teamCount: number
  totalTasks: number
  totalTokens: number
  totalCostYuan: number
}

interface ReconcileData {
  team: { id: string; name: string; providerId?: string | null; apiKeyName: string | null }
  localStats: TeamStats
  upstreamError: string | null
  comparison: {
    local: TeamStats
    upstream: { taskCount: number; totalTokens: number }
    diff: { taskCount: number; totalTokens: number }
    byUser: {
      local: Record<string, TeamStats>
      upstream: Record<string, { taskCount: number; totalTokens: number }>
    }
  } | null
  differences: {
    missingLocally: any[]
    submitUnknownLocally: any[]
    extraLocally: any[]
    tokenMismatch: any[]
    summary: {
      missingCount: number
      uncertainCount: number
      extraCount: number
      mismatchCount: number
      isConsistent: boolean
    }
  } | null
  rawUpstream?: {
    tasks: any[]
  }
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  
  // 时间范围筛选
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // 对账状态
  const [reconciling, setReconciling] = useState<string | null>(null)
  const [reconcileData, setReconcileData] = useState<Record<string, ReconcileData>>({})
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  
  // 同步状态
  const [syncing, setSyncing] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  
  // Tab 状态
  const [activeTab, setActiveTab] = useState<'reconcile' | 'tasks'>('reconcile')
  
  // 任务列表状态
  const [taskList, setTaskList] = useState<any[]>([])
  const [taskLoading, setTaskLoading] = useState(false)
  const [taskFilters, setTaskFilters] = useState<{ teams: any[]; users: any[] }>({ teams: [], users: [] })
  const [taskPagination, setTaskPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 })
  const [taskStats, setTaskStats] = useState({ total: 0, succeeded: 0, totalTokens: 0 })
  const [selectedTask, setSelectedTask] = useState<DashboardTask | null>(null)
  // 任务筛选
  const [taskTeamFilter, setTaskTeamFilter] = useState('all')
  const [taskUserFilter, setTaskUserFilter] = useState('all')
  const [taskStatusFilter, setTaskStatusFilter] = useState('all')
  const [taskStartDate, setTaskStartDate] = useState('')
  const [taskEndDate, setTaskEndDate] = useState('')

  // 加载团队数据
  const fetchTeams = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      
      const res = await fetch(`/api/admin/teams?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      if (res.status === 403) {
        setError('权限不足：仅系统管理员可访问此页面')
        return
      }
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '加载失败')
      }
      
      const data = await res.json()
      setTeams(data.teams)
      setSummary(data.summary)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // 执行对账
  const handleReconcile = async (teamId: string) => {
    setReconciling(teamId)
    setExpandedTeam(teamId)
    
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      
      const res = await fetch(`/api/admin/reconcile/${teamId}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '对账失败')
      }
      
      const data = await res.json()
      setReconcileData(prev => ({ ...prev, [teamId]: data }))
    } catch (e: any) {
      alert(`对账失败: ${e.message}`)
    } finally {
      setReconciling(null)
    }
  }

  // 同步漏记任务
  const syncMissingTasks = async (teamId: string) => {
    const data = reconcileData[teamId]
    if (!data?.differences?.missingLocally?.length) {
      alert('没有需要同步的任务')
      return
    }

    if (!confirm(`确定要同步 ${data.differences.missingLocally.length} 条上游任务吗？

这将：
1. 优先尝试回填本地 submit_unknown 任务
2. 若找不到匹配项，则创建本地任务记录
3. 同步补齐用户和团队的 Token / 预算消耗`)) {
      return
    }

    setSyncing(teamId)
    try {
      const token = localStorage.getItem('token')
      
      // 从 rawUpstream 中获取完整的任务数据（包含 input 字段）
      const missingTaskIds = new Set(data.differences.missingLocally.map((t: any) => t.taskId))
      const tasksToSync = data.rawUpstream?.tasks?.filter((t: any) => missingTaskIds.has(t.task_id)) || []

      if (tasksToSync.length === 0) {
        alert('无法获取完整任务数据，请重新对账后再试')
        return
      }

      const res = await fetch('/api/admin/sync-task', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId,
          tasks: tasksToSync,
        }),
      })

      const result = await res.json()
      
      if (!res.ok) {
        throw new Error(result.error || '同步失败')
      }

      // 显示结果
      const { summary } = result
      alert(
        `同步完成！\n\n` +
        `成功: ${summary.success} 条\n` +
        `其中回填待确认任务: ${summary.reconciled || 0} 条\n` +
        `跳过: ${summary.skipped} 条\n` +
        `失败: ${summary.failed} 条`
      )

      // 重新对账以刷新数据
      await handleReconcile(teamId)
      // 刷新团队列表
      await fetchTeams()

    } catch (e: any) {
      alert(`同步失败: ${e.message}`)
    } finally {
      setSyncing(null)
    }
  }

  const confirmUncertainTasks = async (teamId: string) => {
    const data = reconcileData[teamId]
    const count = data?.differences?.submitUnknownLocally?.length || 0
    if (!count) {
      alert('没有待自动确认的任务')
      return
    }

    if (!confirm(`确定要自动确认 ${count} 条待确认任务吗？\n\n系统会按用户、时间窗口、prompt、seed、模型和参数做唯一匹配；若无法唯一匹配，将保留给人工处理。`)) {
      return
    }

    setConfirming(teamId)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/confirm-uncertain/${teamId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || '自动确认失败')
      }

      const { summary } = result
      alert(
        `自动确认完成！\n\n` +
        `已认领: ${summary.confirmed} 条\n` +
        `其中成功: ${summary.succeeded} 条\n` +
        `其中失败/过期: ${summary.failed} 条\n` +
        `仍在处理中: ${summary.stillProcessing} 条\n` +
        `未匹配: ${summary.unmatched} 条\n` +
        `多候选待人工处理: ${summary.ambiguous} 条`
      )

      await handleReconcile(teamId)
      await fetchTeams()
    } catch (e: any) {
      alert(`自动确认失败: ${e.message}`)
    } finally {
      setConfirming(null)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    fetchTeams()
  }, [router])

  // 获取任务列表
  const fetchTasks = async (page = 1) => {
    setTaskLoading(true)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (taskTeamFilter !== 'all') params.set('teamId', taskTeamFilter)
      if (taskUserFilter !== 'all') params.set('userId', taskUserFilter)
      if (taskStatusFilter !== 'all') params.set('status', taskStatusFilter)
      if (taskStartDate) params.set('startDate', taskStartDate)
      if (taskEndDate) params.set('endDate', taskEndDate)
      params.set('page', page.toString())
      params.set('pageSize', '50')

      const res = await fetch(`/api/admin/tasks?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      if (!res.ok) {
        throw new Error('加载失败')
      }
      
      const data = await res.json()
      setTaskList(data.tasks || [])
      setTaskPagination(data.pagination || { page: 1, pageSize: 50, total: 0, totalPages: 0 })
      setTaskStats(data.stats || { total: 0, succeeded: 0, totalTokens: 0 })
      setTaskFilters(data.filters || { teams: [], users: [] })
    } catch (e: any) {
      console.error('Fetch tasks error:', e)
    } finally {
      setTaskLoading(false)
    }
  }

  // 切换到任务列表 Tab 时加载数据
  useEffect(() => {
    if (activeTab === 'tasks' && taskList.length === 0) {
      fetchTasks()
    }
  }, [activeTab])

  // 格式化数字
  const formatNumber = (n: number) => n.toLocaleString()
  const formatYuan = (n: number) => `¥${n.toFixed(2)}`
  const formatTokens = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
  }
  const isVolcengineTeam = (team: Team) => team.defaultVideoProviderId === 'volcengine'
  const getProviderLabel = (providerId: string) => {
    if (providerId === 'aliyun') return '阿里云 Wan'
    if (providerId === 'volcengine') return '火山 Seedance'
    if (providerId === 'grsai') return 'GRSAI'
    return providerId
  }

  const getTaskStatusView = (status: string) => {
    if (status === 'succeeded') {
      return {
        label: '✅ 成功',
        className: 'bg-green-500/20 text-green-400',
      }
    }
    if (status === 'failed') {
      return {
        label: '❌ 失败',
        className: 'bg-red-500/20 text-red-400',
      }
    }
    if (status === 'expired') {
      return {
        label: '⚠️ 已过期',
        className: 'bg-orange-500/20 text-orange-400',
      }
    }
    if (status === 'submit_unknown') {
      return {
        label: '🕒 提交确认中',
        className: 'bg-yellow-500/20 text-yellow-400',
      }
    }
    return {
      label: '⏳ 处理中',
      className: 'bg-blue-500/20 text-blue-400',
    }
  }

  const getTaskStatusLabel = (task: any) => {
    if (task.status === 'failed') return task.billingType === 'refunded' ? '❌ 失败(已退款)' : '❌ 失败'
    if (task.status === 'expired') return task.billingType === 'refunded' ? '⚠️ 过期(已退款)' : '⚠️ 已过期'
    return getTaskStatusView(task.status).label
  }

  const getTaskModeLabel = (mode: string) => {
    if (mode === 'video_edit' || mode === 'video_extend') {
      return 'reference'
    }
    if (mode === 'first_clip') {
      return '视频续写'
    }
    return mode
  }

  if (error === '权限不足：仅系统管理员可访问此页面') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-2">访问受限</h1>
          <p className="text-zinc-400 mb-6">仅系统管理员可访问此页面</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            返回工作台
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 顶部导航 */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">系统管理员</h1>
            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded">
              Super Admin
            </span>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-zinc-400 hover:text-white text-sm"
          >
            ← 返回工作台
          </button>
        </div>
        {/* Tab 导航 */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6 border-t border-zinc-800">
            <button
              onClick={() => setActiveTab('reconcile')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'reconcile'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              📊 火山对账
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tasks'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              📝 任务列表
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 对账管理 Tab */}
        {activeTab === 'reconcile' && (
          <>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
          <div className="text-amber-300 text-sm font-medium">当前对账模块仅用于火山 Seedance</div>
          <div className="text-zinc-400 text-sm mt-1">
            多厂商场景下，这里只负责火山任务的核对、待确认任务认领和漏单补录；其他供应商后续走独立审计链路。
          </div>
        </div>
        {/* 概览卡片 */}
        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <div className="text-zinc-400 text-sm mb-1">团队总数</div>
              <div className="text-3xl font-bold">{summary.teamCount}</div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <div className="text-zinc-400 text-sm mb-1">总任务数</div>
              <div className="text-3xl font-bold">{formatNumber(summary.totalTasks)}</div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <div className="text-zinc-400 text-sm mb-1">总 Token 消耗</div>
              <div className="text-3xl font-bold text-blue-400">{formatTokens(summary.totalTokens)}</div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <div className="text-zinc-400 text-sm mb-1">总费用</div>
              <div className="text-3xl font-bold text-green-400">{formatYuan(summary.totalCostYuan)}</div>
            </div>
          </div>
        )}

        {/* 时间范围筛选 */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-zinc-400 text-sm">时间范围：</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
            />
            <span className="text-zinc-500">至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
            />
            <button
              onClick={fetchTeams}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm"
            >
              查询
            </button>
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
            >
              清除
            </button>
          </div>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-zinc-400">加载中...</p>
          </div>
        )}

        {/* 错误提示 */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
            {error}
          </div>
        )}

        {/* 团队列表 */}
        {!loading && !error && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-4">团队列表</h2>
            
            {teams.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">暂无团队数据</div>
            ) : (
              teams.map((team) => (
                <div key={team.id} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                  {/* 团队基本信息 */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{team.name}</h3>
                        <span className="px-2 py-0.5 bg-sky-500/20 text-sky-300 text-xs rounded">
                          {getProviderLabel(team.defaultVideoProviderId)}
                        </span>
                        {team.hasApiKey ? (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                            已配置 API Key
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-zinc-700 text-zinc-400 text-xs rounded">
                            未配置 API Key
                          </span>
                        )}
                      </div>
                      {team.seedanceApiKey && (
                        <p className="text-zinc-500 text-sm mt-1">
                          API Key: {team.seedanceApiKey}
                        </p>
                      )}
                      {!isVolcengineTeam(team) && (
                        <p className="text-zinc-500 text-sm mt-1">
                          当前团队默认供应商不是火山，这里不参与对账。
                        </p>
                      )}
                    </div>
                    
                    {/* 本地统计 */}
                    <div className="flex items-center gap-8 mr-8">
                      <div className="text-center">
                        <div className="text-zinc-400 text-xs">任务数</div>
                        <div className="font-semibold">{team.localStats.taskCount}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-zinc-400 text-xs">Token</div>
                        <div className="font-semibold text-blue-400">{formatTokens(team.localStats.totalTokens)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-zinc-400 text-xs">费用</div>
                        <div className="font-semibold text-green-400">{formatYuan(team.localStats.costYuan)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-zinc-400 text-xs">成员</div>
                        <div className="font-semibold">{team.memberCount}</div>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReconcile(team.id)}
                        disabled={!team.hasApiKey || !isVolcengineTeam(team) || reconciling === team.id}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                          team.hasApiKey && isVolcengineTeam(team)
                            ? 'bg-amber-600 hover:bg-amber-500 text-white'
                            : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        {reconciling === team.id ? '对账中...' : '火山对账'}
                      </button>
                      <button
                        onClick={() => confirmUncertainTasks(team.id)}
                        disabled={!team.hasApiKey || !isVolcengineTeam(team) || confirming === team.id}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                          team.hasApiKey && isVolcengineTeam(team)
                            ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                            : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        {confirming === team.id ? '确认中...' : '火山自动确认'}
                      </button>
                      <button
                        onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
                      >
                        {expandedTeam === team.id ? '收起' : '展开'}
                      </button>
                    </div>
                  </div>

                  {/* 展开的详情 */}
                  {expandedTeam === team.id && (
                    <div className="border-t border-zinc-800 p-4 bg-zinc-900/50">
                      {!isVolcengineTeam(team) && (
                        <div className="mb-6 bg-zinc-800/80 border border-zinc-700 rounded-lg p-4">
                          <div className="text-zinc-200 font-medium">该团队已切换到 {getProviderLabel(team.defaultVideoProviderId)}</div>
                          <div className="text-zinc-400 text-sm mt-1">
                            当前管理页保留的对账能力只适用于火山 Seedance，非火山团队这里仅保留本地统计展示。
                          </div>
                        </div>
                      )}
                      {/* 对账结果 */}
                      {reconcileData[team.id] && (
                        <div className="mb-6">
                          <h4 className="font-semibold mb-4 flex items-center gap-2">
                            📊 对账结果
                            {reconcileData[team.id].differences?.summary.isConsistent ? (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                                ✓ 数据一致
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                                ✗ 存在差异
                              </span>
                            )}
                          </h4>
                          
                          {reconcileData[team.id].upstreamError ? (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                              上游接口错误: {reconcileData[team.id].upstreamError}
                            </div>
                          ) : reconcileData[team.id].comparison && (
                            <>
                              {/* 对比表格 */}
                              <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="bg-zinc-800 rounded-lg p-4">
                                  <div className="text-zinc-400 text-sm mb-2">本地数据</div>
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-zinc-400">任务数</span>
                                      <span>{reconcileData[team.id].comparison!.local.taskCount}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-400">Token</span>
                                      <span>{formatTokens(reconcileData[team.id].comparison!.local.totalTokens)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="bg-zinc-800 rounded-lg p-4">
                                  <div className="text-zinc-400 text-sm mb-2">上游数据</div>
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-zinc-400">任务数</span>
                                      <span>{reconcileData[team.id].comparison!.upstream.taskCount}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-400">Token</span>
                                      <span>{formatTokens(reconcileData[team.id].comparison!.upstream.totalTokens)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="bg-zinc-800 rounded-lg p-4">
                                  <div className="text-zinc-400 text-sm mb-2">差异</div>
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-zinc-400">任务数</span>
                                      <span className={reconcileData[team.id].comparison!.diff.taskCount !== 0 ? 'text-red-400' : 'text-green-400'}>
                                        {reconcileData[team.id].comparison!.diff.taskCount > 0 ? '+' : ''}{reconcileData[team.id].comparison!.diff.taskCount}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-400">Token</span>
                                      <span className={reconcileData[team.id].comparison!.diff.totalTokens !== 0 ? 'text-red-400' : 'text-green-400'}>
                                        {reconcileData[team.id].comparison!.diff.totalTokens > 0 ? '+' : ''}{formatTokens(reconcileData[team.id].comparison!.diff.totalTokens)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* 差异详情 */}
                              {reconcileData[team.id].differences && !reconcileData[team.id].differences!.summary.isConsistent && (
                                <div className="space-y-3">
                                  {reconcileData[team.id].differences!.missingLocally.length > 0 && (
                                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="text-amber-400 text-sm font-medium">
                                          🔸 本地漏记 ({reconcileData[team.id].differences!.missingLocally.length} 条)
                                        </div>
                                        <button
                                          onClick={() => syncMissingTasks(team.id)}
                                          disabled={syncing === team.id}
                                          className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-black font-medium rounded transition-colors"
                                        >
                                          {syncing === team.id ? '同步中...' : '同步到本地'}
                                        </button>
                                      </div>
                                      <div className="text-xs text-zinc-400 max-h-32 overflow-y-auto">
                                        {reconcileData[team.id].differences!.missingLocally.map((t: any, i: number) => (
                                          <div key={i} className="flex gap-4 py-1">
                                            <span className="font-mono">{t.taskId}</span>
                                            <span>{t.user}</span>
                                            <span>{formatTokens(t.totalTokens)} tokens</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {reconcileData[team.id].differences!.submitUnknownLocally.length > 0 && (
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                                      <div className="text-yellow-400 text-sm font-medium mb-2">
                                        🕒 本地待确认提交 ({reconcileData[team.id].differences!.submitUnknownLocally.length} 条)
                                      </div>
                                      <div className="text-xs text-zinc-400 max-h-32 overflow-y-auto space-y-2">
                                        {reconcileData[team.id].differences!.submitUnknownLocally.map((t: any, i: number) => (
                                          <div key={i} className="py-1 border-b border-yellow-500/10 last:border-b-0">
                                            <div className="flex gap-4">
                                              <span className="font-mono">{t.taskId}</span>
                                              <span>{t.user}</span>
                                              <span>{t.estimatedTokens ? `${formatTokens(t.estimatedTokens)} 预估` : '无预估'}</span>
                                            </div>
                                            {t.errorMessage && (
                                              <div className="mt-1 text-zinc-500 line-clamp-2">
                                                {t.errorMessage}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {reconcileData[team.id].differences!.extraLocally.length > 0 && (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                      <div className="text-red-400 text-sm font-medium mb-2">
                                        🔺 本地多记 ({reconcileData[team.id].differences!.extraLocally.length} 条)
                                      </div>
                                      <div className="text-xs text-zinc-400 max-h-32 overflow-y-auto">
                                        {reconcileData[team.id].differences!.extraLocally.map((t: any, i: number) => (
                                          <div key={i} className="flex gap-4 py-1">
                                            <span className="font-mono">{t.taskId}</span>
                                            <span>{t.user}</span>
                                            <span>{formatTokens(t.totalTokens)} tokens</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {reconcileData[team.id].differences!.tokenMismatch.length > 0 && (
                                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                                      <div className="text-purple-400 text-sm font-medium mb-2">
                                        ⚡ Token 数值不一致 ({reconcileData[team.id].differences!.tokenMismatch.length} 条)
                                      </div>
                                      <div className="text-xs text-zinc-400 max-h-32 overflow-y-auto">
                                        {reconcileData[team.id].differences!.tokenMismatch.map((t: any, i: number) => (
                                          <div key={i} className="flex gap-4 py-1">
                                            <span className="font-mono">{t.taskId}</span>
                                            <span>本地: {formatTokens(t.localTokens)}</span>
                                            <span>上游: {formatTokens(t.upstreamTokens)}</span>
                                            <span className="text-red-400">差: {t.diff > 0 ? '+' : ''}{formatTokens(t.diff)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 按用户统计 */}
                              <div className="mt-4">
                                <h5 className="text-sm font-medium text-zinc-400 mb-2">按用户统计</h5>
                                <div className="bg-zinc-800 rounded-lg overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-zinc-700">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-zinc-400">用户</th>
                                        <th className="px-4 py-2 text-right text-zinc-400">本地任务</th>
                                        <th className="px-4 py-2 text-right text-zinc-400">本地 Token</th>
                                        <th className="px-4 py-2 text-right text-zinc-400">上游任务</th>
                                        <th className="px-4 py-2 text-right text-zinc-400">上游 Token</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Object.keys({
                                        ...reconcileData[team.id].comparison!.byUser.local,
                                        ...reconcileData[team.id].comparison!.byUser.upstream,
                                      }).map((user) => (
                                        <tr key={user} className="border-t border-zinc-700">
                                          <td className="px-4 py-2">{user}</td>
                                          <td className="px-4 py-2 text-right">
                                            {reconcileData[team.id].comparison!.byUser.local[user]?.taskCount || 0}
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            {formatTokens(reconcileData[team.id].comparison!.byUser.local[user]?.totalTokens || 0)}
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            {reconcileData[team.id].comparison!.byUser.upstream[user]?.taskCount || 0}
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            {formatTokens(reconcileData[team.id].comparison!.byUser.upstream[user]?.totalTokens || 0)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* 成员列表 */}
                      <div>
                        <h4 className="font-semibold mb-3">👥 团队成员</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {team.members.map((member) => (
                            <div key={member.id} className="bg-zinc-800 rounded-lg p-3 flex justify-between items-center">
                              <div>
                                <div className="font-medium">{member.name}</div>
                                <div className="text-zinc-400 text-xs">{member.email}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-blue-400 text-sm">{formatTokens(member.localStats.totalTokens)}</div>
                                <div className="text-zinc-500 text-xs">{member.localStats.taskCount} 任务</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        </>
        )}

        {/* 任务列表 Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {/* 筛选栏 */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <div className="flex flex-wrap items-center gap-4">
                {/* 团队筛选 */}
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 text-sm">团队：</span>
                  <select
                    value={taskTeamFilter}
                    onChange={(e) => {
                      setTaskTeamFilter(e.target.value)
                      setTaskUserFilter('all')  // 重置用户筛选
                    }}
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm min-w-[150px]"
                  >
                    <option value="all">全部团队</option>
                    {taskFilters.teams.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* 用户筛选 */}
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 text-sm">用户：</span>
                  <select
                    value={taskUserFilter}
                    onChange={(e) => setTaskUserFilter(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm min-w-[150px]"
                  >
                    <option value="all">全部用户</option>
                    {taskFilters.users
                      .filter((u: any) => taskTeamFilter === 'all' || u.teamId === taskTeamFilter)
                      .map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                  </select>
                </div>

                {/* 状态筛选 */}
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 text-sm">状态：</span>
                  <select
                    value={taskStatusFilter}
                    onChange={(e) => setTaskStatusFilter(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                  >
                    <option value="all">全部状态</option>
                    <option value="succeeded">✅ 成功</option>
                    <option value="failed">❌ 失败</option>
                    <option value="refunded">♻️ 失败已退款</option>
                    <option value="expired">⚠️ 已过期</option>
                    <option value="submit_unknown">🕒 提交确认中</option>
                    <option value="processing">⏳ 处理中</option>
                  </select>
                </div>

                {/* 时间筛选 */}
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 text-sm">时间：</span>
                  <input
                    type="date"
                    value={taskStartDate}
                    onChange={(e) => setTaskStartDate(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                  />
                  <span className="text-zinc-500">至</span>
                  <input
                    type="date"
                    value={taskEndDate}
                    onChange={(e) => setTaskEndDate(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                  />
                </div>

                <button
                  onClick={() => fetchTasks(1)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm"
                >
                  查询
                </button>
                <button
                  onClick={() => {
                    setTaskTeamFilter('all')
                    setTaskUserFilter('all')
                    setTaskStatusFilter('all')
                    setTaskStartDate('')
                    setTaskEndDate('')
                  }}
                  className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
                >
                  清除
                </button>
              </div>
            </div>

            {/* 统计概览 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="text-zinc-400 text-sm mb-1">总任务数</div>
                <div className="text-2xl font-bold">{formatNumber(taskStats.total)}</div>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="text-zinc-400 text-sm mb-1">成功任务</div>
                <div className="text-2xl font-bold text-green-400">{formatNumber(taskStats.succeeded)}</div>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="text-zinc-400 text-sm mb-1">Token 消耗</div>
                <div className="text-2xl font-bold text-blue-400">{formatTokens(taskStats.totalTokens)}</div>
              </div>
            </div>

            {/* 任务表格 */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              {taskLoading ? (
                <div className="py-20 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-zinc-400">加载中...</p>
                </div>
              ) : taskList.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="text-4xl mb-4">📝</div>
                  <p className="text-zinc-400">暂无任务数据</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-800 text-left bg-zinc-800/50">
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400">ID</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400">团队</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400">用户</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400">类型</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400">状态</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400">Token</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400">费用</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400">时间</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taskList.map((task: any) => {
                          const statusView = getTaskStatusView(task.status)

                          return (
                          <tr key={task.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                            <td className="px-4 py-3">
                              <div className="font-mono text-xs text-zinc-400">
                                {task.externalId || task.id.slice(0, 8)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm">{task.team?.name || '-'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <div className="text-sm">{task.user?.name}</div>
                                <div className="text-xs text-zinc-500">{task.user?.email}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-zinc-800 text-xs rounded">
                                {getTaskModeLabel(task.mode)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${statusView.className}`}>
                                {getTaskStatusLabel(task)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-blue-400">
                                {task.totalTokens ? formatTokens(task.totalTokens) : '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-green-400">
                                {task.costYuan ? formatYuan(task.costYuan) : '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-zinc-400">
                                {new Date(task.createdAt).toLocaleString('zh-CN')}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setSelectedTask(task)}
                                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm rounded-lg transition-colors"
                              >
                                详情
                              </button>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>

                  {/* 分页 */}
                  {taskPagination.totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
                      <div className="text-sm text-zinc-400">
                        共 {taskPagination.total} 条，第 {taskPagination.page}/{taskPagination.totalPages} 页
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fetchTasks(taskPagination.page - 1)}
                          disabled={taskPagination.page <= 1}
                          className="px-3 py-1 bg-zinc-800 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700"
                        >
                          上一页
                        </button>
                        <button
                          onClick={() => fetchTasks(taskPagination.page + 1)}
                          disabled={taskPagination.page >= taskPagination.totalPages}
                          className="px-3 py-1 bg-zinc-800 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700"
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        formatTokens={(tokens) => formatTokens(Number(tokens) || 0)}
      />
    </div>
  )
}
