'use client'

import { useMemo } from 'react'
import type { DashboardTask as Task } from '@/components/dashboard/types'

type StatusFilter = 'all' | 'succeeded' | 'failed' | 'processing'

export function sortTasksByCreatedAtDesc(taskList: Task[]) {
  return [...taskList].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export function useTaskDisplay(
  pendingTasks: Task[],
  tasks: Task[],
  statusFilter: StatusFilter
) {
  const rightPanelTasks = useMemo(
    () => sortTasksByCreatedAtDesc([...pendingTasks, ...tasks]),
    [pendingTasks, tasks]
  )

  const filteredRightPanelTasks = useMemo(() => {
    return rightPanelTasks.filter((task) => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'succeeded') return task.status === 'succeeded'
      if (statusFilter === 'failed') return task.status === 'failed' || task.status === 'expired'
      if (statusFilter === 'processing') {
        return ['processing', 'queued', 'running', 'pending', 'submit_unknown'].includes(task.status)
      }
      return true
    })
  }, [rightPanelTasks, statusFilter])

  return {
    rightPanelTasks,
    filteredRightPanelTasks,
  }
}
