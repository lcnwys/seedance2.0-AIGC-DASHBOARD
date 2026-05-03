'use client'

import { useEffect, useRef } from 'react'
import type { DashboardTask as Task } from '@/components/dashboard/types'

const VIDEO_POLL_INTERVAL = 30000
const VIDEO_INITIAL_POLL_DELAY = 10000
const IMAGE_POLL_INTERVAL = 15000
const IMAGE_INITIAL_POLL_DELAY = 5000

type PollingCallbacks = {
  fetchTasks: (...args: any[]) => any
  fetchStats: (...args: any[]) => any
  syncPendingTasks: (...args: any[]) => any
  fetchImageTasks?: (...args: any[]) => any
  syncPendingImageTasks?: (...args: any[]) => any
  fetchAssets?: (...args: any[]) => any
}

export function useTaskPolling({
  tasks,
  imageTasks,
  pendingTaskCount,
  callbacks,
}: {
  tasks: Task[]
  imageTasks?: Task[]
  pendingTaskCount: number
  callbacks: PollingCallbacks
}) {
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const initialPollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSyncingRef = useRef(false)
  const callbacksRef = useRef(callbacks)

  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  useEffect(() => {
    const processingTasks = tasks.filter((task) =>
      ['processing', 'pending', 'queued', 'running'].includes(task.status)
    )
    const processingTaskIds = processingTasks.map((task) => task.id)
    const processingImageTasks = (imageTasks || []).filter((task) =>
      ['processing', 'pending', 'queued', 'running', 'submit_unknown'].includes(task.status)
    )
    const processingImageTaskIds = processingImageTasks.map((task) => task.id)
    const hasImagePolling = processingImageTasks.length > 0
    const pollInterval = hasImagePolling ? IMAGE_POLL_INTERVAL : VIDEO_POLL_INTERVAL
    const initialPollDelay = hasImagePolling ? IMAGE_INITIAL_POLL_DELAY : VIDEO_INITIAL_POLL_DELAY

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    if (initialPollTimeoutRef.current) {
      clearTimeout(initialPollTimeoutRef.current)
      initialPollTimeoutRef.current = null
    }

    if (processingTasks.length > 0 || processingImageTasks.length > 0) {
      console.log('[POLLING] Starting polling for', processingTasks.length, 'video tasks and', processingImageTasks.length, 'image tasks')

      const syncOnce = async () => {
        if (isSyncingRef.current) {
          return
        }

        isSyncingRef.current = true
        try {
          if (processingTaskIds.length > 0) {
            const result = await callbacksRef.current.syncPendingTasks({
              taskIds: processingTaskIds,
              limit: processingTaskIds.length,
            })

            if (result?.summary?.checked > 0) {
              await callbacksRef.current.fetchTasks()
              await callbacksRef.current.fetchStats()
            }
          }

          if (processingImageTaskIds.length > 0) {
            await callbacksRef.current.syncPendingImageTasks?.({
              taskIds: processingImageTaskIds,
              limit: processingImageTaskIds.length,
            })
            await callbacksRef.current.fetchImageTasks?.()
            await callbacksRef.current.fetchAssets?.()
          }
        } catch (error) {
          console.error('[POLLING] Error syncing pending tasks', error)
        } finally {
          isSyncingRef.current = false
        }
      }

      initialPollTimeoutRef.current = setTimeout(() => {
        void syncOnce()
      }, initialPollDelay)

      pollingIntervalRef.current = setInterval(() => {
        void syncOnce()
      }, pollInterval)
    }

    return () => {
      if (initialPollTimeoutRef.current) {
        clearTimeout(initialPollTimeoutRef.current)
        initialPollTimeoutRef.current = null
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [
    pendingTaskCount,
    tasks
      .filter((task) => ['processing', 'pending', 'queued', 'running'].includes(task.status))
      .map((task) => task.id)
      .join(','),
    (imageTasks || [])
      .filter((task) => ['processing', 'pending', 'queued', 'running', 'submit_unknown'].includes(task.status))
      .map((task) => task.id)
      .join(','),
  ])
}
