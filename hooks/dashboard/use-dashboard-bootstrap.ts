'use client'

import { useEffect, useRef } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { getStoredSeedanceConfig, getStoredToken, getStoredUser } from '@/lib/modules/auth/browser-session'

const RESUME_SYNC_COOLDOWN_MS = 15000

type BootstrapCallbacks = {
  fetchAssets: (...args: any[]) => void | Promise<void>
  fetchTasks: (...args: any[]) => any
  syncPendingTasks: (...args: any[]) => any
  fetchImageTasks?: (...args: any[]) => any
  syncPendingImageTasks?: (...args: any[]) => any
  fetchStats: (...args: any[]) => void | Promise<void>
  fetchTeamData: (...args: any[]) => void | Promise<void>
  fetchTeamConfig: (...args: any[]) => void | Promise<void>
}

export function useDashboardBootstrap<TUser>({
  router,
  setUser,
  setApiKey,
  setSeedanceUrl,
  shouldResumeSync,
  callbacks,
}: {
  router: AppRouterInstance
  setUser: (user: TUser) => void
  setApiKey: (value: string) => void
  setSeedanceUrl: (value: string) => void
  shouldResumeSync: boolean
  callbacks: BootstrapCallbacks
}) {
  const callbacksRef = useRef(callbacks)
  const shouldResumeSyncRef = useRef(shouldResumeSync)

  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  useEffect(() => {
    shouldResumeSyncRef.current = shouldResumeSync
  }, [shouldResumeSync])

  useEffect(() => {
    let disposed = false
    let isResumeSyncing = false
    let lastResumeSyncAt = 0

    const runBootstrapSync = async (reason: 'initial' | 'resume') => {
      if (reason === 'resume') {
        const now = Date.now()
        if (isResumeSyncing || now - lastResumeSyncAt < RESUME_SYNC_COOLDOWN_MS) {
          return
        }
        isResumeSyncing = true
        lastResumeSyncAt = now
      }

      try {
        const syncResult = await callbacksRef.current.syncPendingTasks({
          viewAll: false,
          memberId: null,
          limit: 50,
        })
        await callbacksRef.current.syncPendingImageTasks?.({
          limit: 50,
        })

        if (disposed) {
          return
        }

        await callbacksRef.current.fetchTasks()
        await callbacksRef.current.fetchImageTasks?.()

        if (!disposed) {
          const shouldRefreshStats =
            reason === 'initial'
            || (syncResult?.summary?.synced || 0) > 0
            || (syncResult?.summary?.changedToTerminal || 0) > 0

          if (shouldRefreshStats) {
            await callbacksRef.current.fetchStats()
          }
        }
      } catch (error) {
        console.error('Dashboard bootstrap sync error:', error)
      } finally {
        if (reason === 'resume') {
          isResumeSyncing = false
        }
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldResumeSyncRef.current) {
        void runBootstrapSync('resume')
      }
    }

    const token = getStoredToken()
    if (!token) {
      router.push('/login')
      return
    }

    const storedUser = getStoredUser<TUser>()
    if (storedUser) {
      setUser(storedUser)
    }

    const refreshAuthSession = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (data?.user) {
          localStorage.setItem('user', JSON.stringify(data.user))
          setUser(data.user)
        }
      } catch (error) {
        console.error('Failed to refresh auth session:', error)
      }
    }

    if (!storedUser || !(storedUser as any).teamId) {
      const { seedanceUrl } = getStoredSeedanceConfig()
      setApiKey('')
      setSeedanceUrl(seedanceUrl)
    }

    void refreshAuthSession()
    void callbacksRef.current.fetchAssets()
    void callbacksRef.current.fetchStats()
    void callbacksRef.current.fetchTeamData()
    void callbacksRef.current.fetchTeamConfig()
    void runBootstrapSync('initial')

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [router, setApiKey, setSeedanceUrl, setUser])
}
