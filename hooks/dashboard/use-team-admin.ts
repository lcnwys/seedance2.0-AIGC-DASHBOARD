'use client'

import { useCallback } from 'react'
import { getStoredToken } from '@/lib/modules/auth/browser-session'

type ActionResult = {
  success: boolean
  error?: string
}

export function useTeamAdmin({
  apiKey,
  videoProviderId,
  seedanceUrl,
  storageProviderId,
  maxConcurrentTasks,
  maxRequestsPerMinute,
  memberCooldownSeconds,
  isConfigAdmin,
  setApiKey,
  setVideoProviderId,
  setSeedanceUrl,
  setStorageProviderId,
  setMaxConcurrentTasks,
  setMaxRequestsPerMinute,
  setMemberCooldownSeconds,
  setSavingConfig,
  setApiKeyConfigured,
  setShowSettings,
  fetchTeamData,
  setShowAddMemberModal,
  setShowEditMemberModal,
  setEditingMember,
  setShowRechargeModal,
  setShowAllocateModal,
  setAllocatingMember,
}: {
  apiKey: string
  videoProviderId: string
  seedanceUrl: string
  storageProviderId: 'tos' | 'oss'
  maxConcurrentTasks: number
  maxRequestsPerMinute: number
  memberCooldownSeconds: number
  isConfigAdmin: boolean
  setApiKey: (value: string) => void
  setVideoProviderId: (value: any) => void
  setSeedanceUrl: (value: string) => void
  setStorageProviderId: (value: 'tos' | 'oss') => void
  setMaxConcurrentTasks: (value: number) => void
  setMaxRequestsPerMinute: (value: number) => void
  setMemberCooldownSeconds: (value: number) => void
  setSavingConfig: (value: boolean) => void
  setApiKeyConfigured: (value: boolean) => void
  setShowSettings: (value: boolean) => void
  fetchTeamData: () => Promise<void> | void
  setShowAddMemberModal: (value: boolean) => void
  setShowEditMemberModal: (value: boolean) => void
  setEditingMember: (value: any) => void
  setShowRechargeModal: (value: boolean) => void
  setShowAllocateModal: (value: boolean) => void
  setAllocatingMember: (value: any) => void
}) {
  const fetchProviderConfigDetail = useCallback(async (providerId?: string) => {
    const token = getStoredToken()
    const params = new URLSearchParams({ detail: 'true' })
    if (providerId) {
      params.set('providerId', providerId)
    }

    const response = await fetch(`/api/team/config?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: '加载配置失败' }))
      throw new Error(data.error || '加载配置失败')
    }

    return response.json()
  }, [])

  const openTeamSettings = useCallback(async () => {
    if (!isConfigAdmin) {
      setShowSettings(true)
      return
    }

    try {
      const data = await fetchProviderConfigDetail()
      setVideoProviderId(data.providerId || 'volcengine')
      setApiKey(data.apiKey || '')
      setSeedanceUrl(data.apiUrl || 'https://ark.cn-beijing.volces.com')
      setStorageProviderId(data.storageProviderId || 'tos')
      setApiKeyConfigured(data.apiKeyConfigured)
      setMaxConcurrentTasks(data.submissionGuard?.maxConcurrentTasks || 5)
      setMaxRequestsPerMinute(data.submissionGuard?.maxRequestsPerMinute || 20)
      setMemberCooldownSeconds(data.submissionGuard?.memberCooldownSeconds || 10)
    } catch (error) {
      console.error('Failed to load team config detail:', error)
      alert('加载配置失败')
      return
    }

    setShowSettings(true)
  }, [
    fetchProviderConfigDetail,
    isConfigAdmin,
    setApiKey,
    setApiKeyConfigured,
    setMaxConcurrentTasks,
    setMaxRequestsPerMinute,
    setMemberCooldownSeconds,
    setStorageProviderId,
    setVideoProviderId,
    setSeedanceUrl,
    setShowSettings,
  ])

  const handleVideoProviderChange = useCallback(async (nextProviderId: string) => {
    setVideoProviderId(nextProviderId)
    setApiKey('')
    setApiKeyConfigured(false)

    if (!isConfigAdmin) {
      return
    }

    try {
      const data = await fetchProviderConfigDetail(nextProviderId)
      setVideoProviderId(data.providerId || nextProviderId)
      setApiKey(data.apiKey || '')
      setSeedanceUrl(data.apiUrl || '')
      setStorageProviderId(data.storageProviderId || 'tos')
      setApiKeyConfigured(data.apiKeyConfigured)
      setMaxConcurrentTasks(data.submissionGuard?.maxConcurrentTasks || 5)
      setMaxRequestsPerMinute(data.submissionGuard?.maxRequestsPerMinute || 20)
      setMemberCooldownSeconds(data.submissionGuard?.memberCooldownSeconds || 10)
    } catch (error) {
      console.error('Failed to load provider config detail:', error)
      alert('切换 Provider 时加载配置失败')
    }
  }, [
    fetchProviderConfigDetail,
    isConfigAdmin,
    setApiKey,
    setApiKeyConfigured,
    setMaxConcurrentTasks,
    setMaxRequestsPerMinute,
    setMemberCooldownSeconds,
    setStorageProviderId,
    setSeedanceUrl,
    setVideoProviderId,
  ])

  const saveTeamConfig = useCallback(async () => {
    if (!isConfigAdmin) {
      alert('只有管理员可以修改配置')
      return
    }

    setSavingConfig(true)
    const token = getStoredToken()
    try {
      const response = await fetch('/api/team/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          providerId: videoProviderId,
          apiKey,
          apiUrl: seedanceUrl,
          storageProviderId,
          maxConcurrentTasks,
          maxRequestsPerMinute,
          memberCooldownSeconds,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setApiKeyConfigured(data.apiKeyConfigured)
        setSeedanceUrl(data.apiUrl || seedanceUrl)
        setStorageProviderId(data.storageProviderId || storageProviderId)
        setVideoProviderId(data.providerId || videoProviderId)
        setMaxConcurrentTasks(data.submissionGuard?.maxConcurrentTasks || maxConcurrentTasks)
        setMaxRequestsPerMinute(data.submissionGuard?.maxRequestsPerMinute || maxRequestsPerMinute)
        setMemberCooldownSeconds(data.submissionGuard?.memberCooldownSeconds || memberCooldownSeconds)
        setShowSettings(false)
        alert('团队配置已保存')
      } else {
        const data = await response.json()
        alert(`保存失败: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to save team config:', error)
      alert('保存失败')
    } finally {
      setSavingConfig(false)
    }
  }, [
    apiKey,
    isConfigAdmin,
    maxConcurrentTasks,
    maxRequestsPerMinute,
    memberCooldownSeconds,
    seedanceUrl,
    storageProviderId,
    videoProviderId,
    setVideoProviderId,
    setApiKeyConfigured,
    setMaxConcurrentTasks,
    setMaxRequestsPerMinute,
    setMemberCooldownSeconds,
    setSavingConfig,
    setStorageProviderId,
    setShowSettings,
  ])

  const addTeamMember = useCallback(async (
    email: string,
    name: string,
    password: string,
  ): Promise<ActionResult> => {
    const token = getStoredToken()
    try {
      const response = await fetch('/api/team/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, name, password }),
      })
      if (response.ok) {
        await fetchTeamData()
        setShowAddMemberModal(false)
        return { success: true }
      }
      const data = await response.json()
      return { success: false, error: data.error }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }, [fetchTeamData, setShowAddMemberModal])

  const updateTeamMember = useCallback(async (memberId: string, updates: any): Promise<ActionResult> => {
    const token = getStoredToken()
    try {
      const response = await fetch('/api/team/members', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberId, ...updates }),
      })
      if (response.ok) {
        await fetchTeamData()
        setShowEditMemberModal(false)
        setEditingMember(null)
        return { success: true }
      }
      const data = await response.json()
      return { success: false, error: data.error }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }, [fetchTeamData, setEditingMember, setShowEditMemberModal])

  const deleteTeamMember = useCallback(async (memberId: string): Promise<ActionResult> => {
    const token = getStoredToken()
    try {
      const response = await fetch(`/api/team/members?id=${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        await fetchTeamData()
        return { success: true }
      }
      const data = await response.json()
      return { success: false, error: data.error }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }, [fetchTeamData])

  const rechargeTeamBudget = useCallback(async (amountYuan: number): Promise<ActionResult> => {
    const token = getStoredToken()
    try {
      const response = await fetch('/api/team/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amountYuan }),
      })
      if (response.ok) {
        await fetchTeamData()
        setShowRechargeModal(false)
        return { success: true }
      }
      const data = await response.json()
      return { success: false, error: data.error }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }, [fetchTeamData, setShowRechargeModal])

  const allocateBudget = useCallback(async (memberId: string, allocatedBudgetYuan: number): Promise<ActionResult> => {
    const token = getStoredToken()
    try {
      const response = await fetch('/api/team/tokens', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberId, allocatedBudgetYuan }),
      })
      if (response.ok) {
        await fetchTeamData()
        setShowAllocateModal(false)
        setAllocatingMember(null)
        return { success: true }
      }
      const data = await response.json()
      return { success: false, error: data.error }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }, [fetchTeamData, setAllocatingMember, setShowAllocateModal])

  return {
    openTeamSettings,
    handleVideoProviderChange,
    saveTeamConfig,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    rechargeTeamBudget,
    allocateBudget,
  }
}
