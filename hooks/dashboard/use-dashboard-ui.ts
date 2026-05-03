'use client'

import { useCallback } from 'react'
import type { DashboardAsset as Asset, DashboardTask as Task } from '@/components/dashboard/types'
import { serializeToApiPayload } from '@/lib/slate'

type TaskStatusFilter = 'all' | 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'submit_unknown'

export function useDashboardUi({
  taskViewAll,
  taskStatusFilter,
  taskMemberFilter,
  statsViewTeam,
  editingAsset,
  deleteConfirmAsset,
  saveAsSubjectAsset,
  fetchTasks,
  syncPendingTasks,
  syncPendingImageTasks,
  fetchStats,
  setAssetPickerMode,
  setShowAssetPicker,
  setEditorValue,
  setPrompt,
  setEditingAsset,
  setShowAssetDetail,
  setAssetActionMenu,
  setSaveAsSubjectAsset,
  setDeleteConfirmAsset,
  setTaskViewAll,
  setTaskStatusFilter,
  setTaskMemberFilter,
  setSelectedTaskDetail,
  setStatsViewTeam,
  setShowRechargeModal,
  setShowAddMemberModal,
  setAllocatingMember,
  setShowAllocateModal,
  setShowEditMemberModal,
  setEditingMember,
  setSelectedPickerAssets,
  setHasMoreTasks,
  setTaskPage,
}: {
  taskViewAll: boolean
  taskStatusFilter: TaskStatusFilter
  taskMemberFilter: string
  statsViewTeam: boolean
  editingAsset: Asset | null
  deleteConfirmAsset: Asset | null
  saveAsSubjectAsset: Asset | null
  fetchTasks: (viewAll?: boolean, status?: TaskStatusFilter, member?: string, page?: number, append?: boolean) => Promise<{ hasMore: boolean; page: number } | undefined>
  syncPendingTasks: (options?: { viewAll?: boolean; memberId?: string | null; limit?: number }) => Promise<any>
  syncPendingImageTasks?: (options?: { taskIds?: string[]; limit?: number }) => Promise<any>
  fetchStats: (viewTeam?: boolean) => Promise<void>
  setAssetPickerMode: React.Dispatch<React.SetStateAction<'image' | 'video' | 'audio'>>
  setShowAssetPicker: React.Dispatch<React.SetStateAction<boolean>>
  setEditorValue: React.Dispatch<React.SetStateAction<any>>
  setPrompt: React.Dispatch<React.SetStateAction<string>>
  setEditingAsset: React.Dispatch<React.SetStateAction<Asset | null>>
  setShowAssetDetail: React.Dispatch<React.SetStateAction<boolean>>
  setAssetActionMenu: React.Dispatch<React.SetStateAction<string | null>>
  setSaveAsSubjectAsset: React.Dispatch<React.SetStateAction<Asset | null>>
  setDeleteConfirmAsset: React.Dispatch<React.SetStateAction<Asset | null>>
  setTaskViewAll: React.Dispatch<React.SetStateAction<boolean>>
  setTaskStatusFilter: React.Dispatch<React.SetStateAction<TaskStatusFilter>>
  setTaskMemberFilter: React.Dispatch<React.SetStateAction<string>>
  setSelectedTaskDetail: React.Dispatch<React.SetStateAction<Task | null>>
  setStatsViewTeam: React.Dispatch<React.SetStateAction<boolean>>
  setShowRechargeModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowAddMemberModal: React.Dispatch<React.SetStateAction<boolean>>
  setAllocatingMember: React.Dispatch<React.SetStateAction<any>>
  setShowAllocateModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowEditMemberModal: React.Dispatch<React.SetStateAction<boolean>>
  setEditingMember: React.Dispatch<React.SetStateAction<any>>
  setSelectedPickerAssets: React.Dispatch<React.SetStateAction<Asset[]>>
  setHasMoreTasks: React.Dispatch<React.SetStateAction<boolean>>
  setTaskPage: React.Dispatch<React.SetStateAction<number>>
}) {
  const openAssetPicker = useCallback((mode: 'image' | 'video' | 'audio') => {
    setAssetPickerMode(mode)
    setShowAssetPicker(true)
  }, [setAssetPickerMode, setShowAssetPicker])

  const handleEditorChange = useCallback((value: any) => {
    setEditorValue(value)
    const payload = serializeToApiPayload(value)
    setPrompt(payload.prompt)
  }, [setEditorValue, setPrompt])

  const openAssetDetail = useCallback((asset: Asset) => {
    setEditingAsset(asset)
    setShowAssetDetail(true)
  }, [setEditingAsset, setShowAssetDetail])

  const closeAssetDetail = useCallback(() => {
    setShowAssetDetail(false)
    setEditingAsset(null)
    setAssetActionMenu(null)
  }, [setAssetActionMenu, setEditingAsset, setShowAssetDetail])

  const closeAssetPicker = useCallback(() => {
    setShowAssetPicker(false)
    setSelectedPickerAssets([])
  }, [setSelectedPickerAssets, setShowAssetPicker])

  const handleTaskViewAllChange = useCallback((checked: boolean) => {
    setTaskViewAll(checked)
    setTaskPage(1)
    fetchTasks(checked, taskStatusFilter, taskMemberFilter, 1, false).then((result) => {
      if (result) {
        setHasMoreTasks(result.hasMore)
      }
    })
  }, [fetchTasks, setHasMoreTasks, setTaskPage, setTaskViewAll, taskMemberFilter, taskStatusFilter])

  const handleTaskStatusFilterChange = useCallback((status: TaskStatusFilter) => {
    setTaskStatusFilter(status)
    setTaskPage(1)
    fetchTasks(taskViewAll, status, taskMemberFilter, 1, false).then((result) => {
      if (result) {
        setHasMoreTasks(result.hasMore)
      }
    })
  }, [fetchTasks, setHasMoreTasks, setTaskPage, setTaskStatusFilter, taskMemberFilter, taskViewAll])

  const handleTaskMemberFilterChange = useCallback((memberId: string) => {
    setTaskMemberFilter(memberId)
    setTaskPage(1)
    fetchTasks(taskViewAll, taskStatusFilter, memberId, 1, false).then((result) => {
      if (result) {
        setHasMoreTasks(result.hasMore)
      }
    })
  }, [fetchTasks, setHasMoreTasks, setTaskMemberFilter, setTaskPage, taskStatusFilter, taskViewAll])

  const refreshTaskList = useCallback(() => {
    setTaskPage(1)
    syncPendingTasks({
      viewAll: taskViewAll,
      memberId: taskMemberFilter !== 'all' ? taskMemberFilter : null,
      limit: 50,
    })
      .then(() => syncPendingImageTasks?.({ limit: 50 }))
      .then(() => fetchTasks(taskViewAll, taskStatusFilter, taskMemberFilter, 1, false))
      .then((result) => {
        if (result) {
          setHasMoreTasks(result.hasMore)
        }
      })
  }, [fetchTasks, setTaskMemberFilter, setTaskPage, setTaskStatusFilter, syncPendingImageTasks, syncPendingTasks, taskMemberFilter, taskStatusFilter, taskViewAll])

  const toggleStatsViewTeam = useCallback(() => {
    const nextValue = !statsViewTeam
    setStatsViewTeam(nextValue)
    fetchStats(nextValue)
  }, [fetchStats, setStatsViewTeam, statsViewTeam])

  const openRechargeModal = useCallback(() => {
    setShowRechargeModal(true)
  }, [setShowRechargeModal])

  const openAddMemberModal = useCallback(() => {
    setShowAddMemberModal(true)
  }, [setShowAddMemberModal])

  const openAllocateModal = useCallback((member: any) => {
    setAllocatingMember(member)
    setShowAllocateModal(true)
  }, [setAllocatingMember, setShowAllocateModal])

  const openEditMemberModal = useCallback((member: any) => {
    setEditingMember(member)
    setShowEditMemberModal(true)
  }, [setEditingMember, setShowEditMemberModal])

  const closeEditMemberModal = useCallback(() => {
    setShowEditMemberModal(false)
    setEditingMember(null)
  }, [setEditingMember, setShowEditMemberModal])

  const closeAllocateModal = useCallback(() => {
    setShowAllocateModal(false)
    setAllocatingMember(null)
  }, [setAllocatingMember, setShowAllocateModal])

  const closeTaskDetail = useCallback(() => {
    setSelectedTaskDetail(null)
  }, [setSelectedTaskDetail])

  const closeDeleteConfirm = useCallback(() => {
    setDeleteConfirmAsset(null)
  }, [setDeleteConfirmAsset])

  const closeSaveAsSubject = useCallback(() => {
    setSaveAsSubjectAsset(null)
  }, [setSaveAsSubjectAsset])

  return {
    openAssetPicker,
    handleEditorChange,
    openAssetDetail,
    closeAssetDetail,
    closeAssetPicker,
    handleTaskViewAllChange,
    handleTaskStatusFilterChange,
    handleTaskMemberFilterChange,
    refreshTaskList,
    toggleStatsViewTeam,
    openRechargeModal,
    openAddMemberModal,
    openAllocateModal,
    openEditMemberModal,
    closeEditMemberModal,
    closeAllocateModal,
    closeTaskDetail,
    closeDeleteConfirm,
    closeSaveAsSubject,
  }
}
