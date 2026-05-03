'use client'

import type { ChangeEvent, UIEvent } from 'react'
import type {
  DashboardAsset as Asset,
  DashboardTask as Task,
  DashboardUploadItem,
} from '@/components/dashboard/types'
import {
  AddMemberModal,
  AllocateBudgetModal,
  EditMemberModal,
  RechargeBudgetModal,
  TeamSettingsModal,
} from '@/components/dashboard/team-modals'
import {
  AssetDetailModal,
  AssetPickerModal,
  DeleteAssetConfirmModal,
  SaveAsSubjectModal,
} from '@/components/dashboard/asset-modals'
import { TaskDetailModal } from '@/components/dashboard/task-detail-modal'

interface DashboardModalLayerProps {
  showAssetPicker: boolean
  assetPickerMode: 'image' | 'video' | 'audio'
  uploadItems: DashboardUploadItem[]
  selectedPickerAssets: Asset[]
  filteredAssets: Asset[]
  filteredAssetCount: number
  visibleAssets: Asset[]
  hasMoreAssets: boolean
  isLoadingAssets: boolean
  assetLoadError: string | null
  assetPickerSearch: string
  showAssetDetail: boolean
  editingAsset: Asset | null
  deleteConfirmAsset: Asset | null
  saveAsSubjectAsset: Asset | null
  showSettings: boolean
  isConfigAdmin: boolean
  apiKeyConfigured: boolean
  videoProviderId: string
  apiKey: string
  seedanceUrl: string
  storageProviderId: 'tos' | 'oss'
  storageProviders: Array<{ id: 'tos' | 'oss'; label: string; configured: boolean }>
  maxConcurrentTasks: number
  maxRequestsPerMinute: number
  memberCooldownSeconds: number
  savingConfig: boolean
  showAddMemberModal: boolean
  teamInfo: any
  teamMembers: any[]
  showEditMemberModal: boolean
  editingMember: any
  showRechargeModal: boolean
  showAllocateModal: boolean
  allocatingMember: any
  selectedTaskDetail: Task | null
  onCloseAssetPicker: () => void
  onAssetPickerSearchChange: (value: string) => void
  onAssetPickerScroll: (event: UIEvent<HTMLDivElement>) => void
  onTogglePickerAsset: (asset: Asset) => void
  onReferenceUpload: (event: ChangeEvent<HTMLInputElement>, mode: 'image' | 'video' | 'audio') => void
  onConfirmSelectedReferences: () => void
  onCloseAssetDetail: () => void
  onEditingAssetChange: (asset: Asset | null) => void
  onSaveAssetDetail: () => void
  onDeleteAssetFromDetail: (asset: Asset) => void
  onCloseDeleteConfirm: () => void
  onConfirmDeleteAsset: () => void
  onCloseSaveAsSubject: () => void
  onSaveAsSubject: (subjectType: 'character' | 'scene' | 'prop', name: string) => void
  onCloseSettings: () => void
  onVideoProviderIdChange: (value: string) => void
  onApiKeyChange: (value: string) => void
  onSeedanceUrlChange: (value: string) => void
  onStorageProviderIdChange: (value: 'tos' | 'oss') => void
  onMaxConcurrentTasksChange: (value: number) => void
  onMaxRequestsPerMinuteChange: (value: number) => void
  onMemberCooldownSecondsChange: (value: number) => void
  onSaveTeamConfig: () => void
  onCloseAddMemberModal: () => void
  onAddTeamMember: (email: string, name: string, password: string) => Promise<{ success: boolean; error?: string }>
  formatTokens: (tokens: number | string) => string
  onCloseEditMemberModal: () => void
  onUpdateTeamMember: (memberId: string, updates: any) => Promise<{ success: boolean; error?: string }>
  onCloseRechargeModal: () => void
  onRechargeTeamBudget: (amountYuan: number) => Promise<{ success: boolean; error?: string }>
  onCloseAllocateModal: () => void
  onAllocateBudget: (memberId: string, allocatedBudgetYuan: number) => Promise<{ success: boolean; error?: string }>
  onCloseTaskDetail: () => void
}

export function DashboardModalLayer({
  showAssetPicker,
  assetPickerMode,
  uploadItems,
  selectedPickerAssets,
  filteredAssets,
  filteredAssetCount,
  visibleAssets,
  hasMoreAssets,
  isLoadingAssets,
  assetLoadError,
  assetPickerSearch,
  showAssetDetail,
  editingAsset,
  deleteConfirmAsset,
  saveAsSubjectAsset,
  showSettings,
  isConfigAdmin,
  apiKeyConfigured,
  videoProviderId,
  apiKey,
  seedanceUrl,
  storageProviderId,
  storageProviders,
  maxConcurrentTasks,
  maxRequestsPerMinute,
  memberCooldownSeconds,
  savingConfig,
  showAddMemberModal,
  teamInfo,
  teamMembers,
  showEditMemberModal,
  editingMember,
  showRechargeModal,
  showAllocateModal,
  allocatingMember,
  selectedTaskDetail,
  onCloseAssetPicker,
  onAssetPickerSearchChange,
  onAssetPickerScroll,
  onTogglePickerAsset,
  onReferenceUpload,
  onConfirmSelectedReferences,
  onCloseAssetDetail,
  onEditingAssetChange,
  onSaveAssetDetail,
  onDeleteAssetFromDetail,
  onCloseDeleteConfirm,
  onConfirmDeleteAsset,
  onCloseSaveAsSubject,
  onSaveAsSubject,
  onCloseSettings,
  onVideoProviderIdChange,
  onApiKeyChange,
  onSeedanceUrlChange,
  onStorageProviderIdChange,
  onMaxConcurrentTasksChange,
  onMaxRequestsPerMinuteChange,
  onMemberCooldownSecondsChange,
  onSaveTeamConfig,
  onCloseAddMemberModal,
  onAddTeamMember,
  formatTokens,
  onCloseEditMemberModal,
  onUpdateTeamMember,
  onCloseRechargeModal,
  onRechargeTeamBudget,
  onCloseAllocateModal,
  onAllocateBudget,
  onCloseTaskDetail,
}: DashboardModalLayerProps) {
  return (
    <>
      <AssetPickerModal
        open={showAssetPicker}
        mode={assetPickerMode}
        uploadItems={uploadItems}
        selectedCount={selectedPickerAssets.length}
        filteredAssets={filteredAssets}
        filteredAssetCount={filteredAssetCount}
        visibleAssets={visibleAssets}
        hasMoreAssets={hasMoreAssets}
        isLoadingAssets={isLoadingAssets}
        assetLoadError={assetLoadError}
        search={assetPickerSearch}
        selectedAssets={selectedPickerAssets}
        onClose={onCloseAssetPicker}
        onSearchChange={onAssetPickerSearchChange}
        onScroll={onAssetPickerScroll}
        onToggleAsset={onTogglePickerAsset}
        onUpload={onReferenceUpload}
        onConfirm={onConfirmSelectedReferences}
      />

      <AssetDetailModal
        open={showAssetDetail}
        asset={editingAsset}
        onClose={onCloseAssetDetail}
        onChange={onEditingAssetChange}
        onSave={onSaveAssetDetail}
        onDelete={onDeleteAssetFromDetail}
      />

      <DeleteAssetConfirmModal
        asset={deleteConfirmAsset}
        onClose={onCloseDeleteConfirm}
        onConfirm={onConfirmDeleteAsset}
      />

      <SaveAsSubjectModal
        asset={saveAsSubjectAsset}
        onClose={onCloseSaveAsSubject}
        onSave={onSaveAsSubject}
      />

      <TeamSettingsModal
        open={showSettings}
        onClose={onCloseSettings}
        isConfigAdmin={isConfigAdmin}
        apiKeyConfigured={apiKeyConfigured}
        videoProviderId={videoProviderId}
        apiKey={apiKey}
        seedanceUrl={seedanceUrl}
        storageProviderId={storageProviderId}
        storageProviders={storageProviders}
        maxConcurrentTasks={maxConcurrentTasks}
        maxRequestsPerMinute={maxRequestsPerMinute}
        memberCooldownSeconds={memberCooldownSeconds}
        savingConfig={savingConfig}
        onVideoProviderIdChange={onVideoProviderIdChange}
        onApiKeyChange={onApiKeyChange}
        onSeedanceUrlChange={onSeedanceUrlChange}
        onStorageProviderIdChange={onStorageProviderIdChange}
        onMaxConcurrentTasksChange={onMaxConcurrentTasksChange}
        onMaxRequestsPerMinuteChange={onMaxRequestsPerMinuteChange}
        onMemberCooldownSecondsChange={onMemberCooldownSecondsChange}
        onSave={onSaveTeamConfig}
      />

      <AddMemberModal
        open={showAddMemberModal}
        onClose={onCloseAddMemberModal}
        onSubmit={onAddTeamMember}
      />

      <EditMemberModal
        open={showEditMemberModal}
        member={editingMember}
        onClose={onCloseEditMemberModal}
        onSubmit={onUpdateTeamMember}
      />

      <RechargeBudgetModal
        open={showRechargeModal}
        teamInfo={teamInfo}
        onClose={onCloseRechargeModal}
        onSubmit={onRechargeTeamBudget}
      />

      <AllocateBudgetModal
        open={showAllocateModal}
        member={allocatingMember}
        teamInfo={teamInfo}
        onClose={onCloseAllocateModal}
        onSubmit={onAllocateBudget}
      />

      <TaskDetailModal
        task={selectedTaskDetail}
        onClose={onCloseTaskDetail}
        formatTokens={formatTokens}
      />
    </>
  )
}
