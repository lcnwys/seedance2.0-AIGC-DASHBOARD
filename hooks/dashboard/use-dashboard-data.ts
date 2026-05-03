'use client'

import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { getStoredSeedanceConfig, getStoredToken, getStoredUser } from '@/lib/modules/auth/browser-session'
import type { DashboardAsset as Asset, DashboardTask as Task } from '@/components/dashboard/types'
import type { DashboardStatsData } from '@/components/dashboard/stats-panel'

type TaskStatusFilter = 'all' | 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'submit_unknown'

const DEFAULT_STORAGE_PROVIDERS: Array<{ id: 'tos' | 'oss'; label: string; configured: boolean }> = [
  { id: 'tos', label: '火山 TOS', configured: true },
  { id: 'oss', label: '阿里云 OSS', configured: false },
]

export function useDashboardData({
  setAssets,
  setTasks,
  setIsTaskAdmin,
  setTaskTeamMembers,
  setStats,
  setApiKey,
  setVideoProviderId,
  setSeedanceUrl,
  setStorageProviderId,
  setStorageProviders,
  setMaxConcurrentTasks,
  setMaxRequestsPerMinute,
  setMemberCooldownSeconds,
  setIsConfigAdmin,
  setApiKeyConfigured,
  setIsSuperAdmin,
  setTeamInfo,
  setTeamMembers,
  onInvalidSession,
}: {
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  setIsTaskAdmin: (value: boolean) => void
  setTaskTeamMembers: (value: { id: string; name: string }[]) => void
  setStats: React.Dispatch<React.SetStateAction<DashboardStatsData | null>>
  setApiKey: (value: string) => void
  setVideoProviderId: (value: any) => void
  setSeedanceUrl: (value: string) => void
  setStorageProviderId: (value: 'tos' | 'oss') => void
  setStorageProviders: (value: Array<{ id: 'tos' | 'oss'; label: string; configured: boolean }>) => void
  setMaxConcurrentTasks: (value: number) => void
  setMaxRequestsPerMinute: (value: number) => void
  setMemberCooldownSeconds: (value: number) => void
  setIsConfigAdmin: (value: boolean) => void
  setApiKeyConfigured: (value: boolean) => void
  setIsSuperAdmin: (value: boolean) => void
  setTeamInfo: (value: any) => void
  setTeamMembers: (value: any[]) => void
  onInvalidSession: () => void
}) {
  const fetchAssets = useCallback(async () => {
    const token = getStoredToken()
    const response = await fetch('/api/assets', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (response.ok) {
      const data = await response.json()
      setAssets(data.assets)
    }
  }, [setAssets])

  const fetchTasks = useCallback(async (viewAll = false, status: TaskStatusFilter | 'all' = 'all', member = 'all', page = 1, append = false) => {
    const token = getStoredToken()

    const params = new URLSearchParams()
    if (viewAll) params.set('viewAll', 'true')
    if (status !== 'all') params.set('status', status)
    if (member !== 'all') params.set('member', member)
    params.set('page', page.toString())
    params.set('limit', '20')

    const response = await fetch(`/api/tasks?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) {
      const data = await response.json()
      flushSync(() => {
        if (append) {
          // Append mode: load more
          setTasks((prev) => [...prev, ...data.tasks])
        } else {
          // Overwrite mode: reload
          setTasks([...data.tasks])
        }
      })
      setIsTaskAdmin(data.isAdmin || false)
      if (data.teamMembers) {
        setTaskTeamMembers(data.teamMembers)
      }
      return {
        hasMore: data.pagination?.hasMore ?? true,
        page,
      }
    } else if (response.status === 401 || response.status === 404) {
      onInvalidSession()
    } else {
      console.error('Failed to fetch tasks:', response.status)
    }
    return { hasMore: false, page }
  }, [onInvalidSession, setIsTaskAdmin, setTaskTeamMembers, setTasks])

  const syncPendingTasks = useCallback(async (options?: {
    viewAll?: boolean
    memberId?: string | null
    taskIds?: string[]
    limit?: number
  }) => {
    const token = getStoredToken()

    const response = await fetch('/api/tasks/sync-pending', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        viewAll: options?.viewAll || false,
        memberId: options?.memberId || null,
        taskIds: options?.taskIds || [],
        limit: options?.limit,
      }),
    })

    if (response.ok) {
      return response.json()
    }

    if (response.status === 401 || response.status === 404) {
      onInvalidSession()
    }

    return null
  }, [onInvalidSession])

  const fetchStats = useCallback(async (viewTeam = false) => {
    const token = getStoredToken()

    const [statsResponse, consumptionResponse] = await Promise.all([
      fetch(`/api/stats${viewTeam ? '?viewTeam=true' : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`/api/stats/consumption${viewTeam ? '?viewTeam=true' : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])

    if (
      statsResponse.status === 401 ||
      statsResponse.status === 404 ||
      consumptionResponse.status === 401 ||
      consumptionResponse.status === 404
    ) {
      onInvalidSession()
      return
    }

    if (statsResponse.ok) {
      const statsData = await statsResponse.json()
      setStats(statsData)
    }

    if (consumptionResponse.ok) {
      const consumptionData = await consumptionResponse.json()
      setStats((prev: any) => ({
        ...prev,
        consumption: consumptionData,
      }))
    }
  }, [onInvalidSession, setStats])

  const fetchTeamConfig = useCallback(async () => {
    const token = getStoredToken()
    const userObj = getStoredUser<any>()

    if (!userObj) return

    if (!userObj.teamId) {
      const { seedanceUrl } = getStoredSeedanceConfig()
      setApiKey('')
      setVideoProviderId('volcengine')
      setSeedanceUrl(seedanceUrl)
      setStorageProviderId('tos')
      setStorageProviders(DEFAULT_STORAGE_PROVIDERS)
      setMaxConcurrentTasks(5)
      setMaxRequestsPerMinute(20)
      setMemberCooldownSeconds(10)
      setIsConfigAdmin(false)
      setApiKeyConfigured(false)
      setIsSuperAdmin(false)
      return
    }

    try {
      const response = await fetch('/api/team/config', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setIsConfigAdmin(data.isAdmin)
        setApiKeyConfigured(data.apiKeyConfigured)
        setIsSuperAdmin(data.isSuperAdmin || false)
        setVideoProviderId(data.providerId || 'volcengine')
        setStorageProviderId(data.storageProviderId || 'tos')
        setStorageProviders(Array.isArray(data.storageProviders) ? data.storageProviders : [])
        setSeedanceUrl(data.apiUrl || 'https://ark.cn-beijing.volces.com')
        setMaxConcurrentTasks(data.submissionGuard?.maxConcurrentTasks || 5)
        setMaxRequestsPerMinute(data.submissionGuard?.maxRequestsPerMinute || 20)
        setMemberCooldownSeconds(data.submissionGuard?.memberCooldownSeconds || 10)
      } else if (response.status === 401 || response.status === 404) {
        onInvalidSession()
      } else if (response.status === 400 || response.status === 403) {
        setIsConfigAdmin(false)
        setApiKeyConfigured(false)
        setStorageProviderId('tos')
        setStorageProviders(DEFAULT_STORAGE_PROVIDERS)
      }
    } catch (error) {
      console.error('Failed to fetch team config:', error)
      setIsConfigAdmin(false)
      setApiKeyConfigured(false)
      setStorageProviderId('tos')
      setStorageProviders(DEFAULT_STORAGE_PROVIDERS)
    }
  }, [
    onInvalidSession,
    setApiKey,
    setApiKeyConfigured,
    setIsConfigAdmin,
    setIsSuperAdmin,
    setMaxConcurrentTasks,
    setMaxRequestsPerMinute,
    setMemberCooldownSeconds,
    setStorageProviderId,
    setStorageProviders,
    setVideoProviderId,
    setSeedanceUrl,
  ])

  const fetchTeamData = useCallback(async () => {
    const token = getStoredToken()
    const userObj = getStoredUser<any>()
    if (!userObj) return

    if (userObj.role !== 'admin' || !userObj.teamId) {
      setTeamInfo(null)
      setTeamMembers([])
      return
    }

    try {
      const response = await fetch('/api/team/members', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setTeamInfo(data.team)
        setTeamMembers(data.members || [])
      } else if (response.status === 401 || response.status === 404) {
        onInvalidSession()
      } else if (response.status === 400 || response.status === 403) {
        setTeamInfo(null)
        setTeamMembers([])
      }
    } catch (error) {
      console.error('Failed to fetch team data:', error)
    }
  }, [onInvalidSession, setTeamInfo, setTeamMembers])

  return {
    fetchAssets,
    fetchTasks,
    syncPendingTasks,
    fetchStats,
    fetchTeamConfig,
    fetchTeamData,
  }
}
