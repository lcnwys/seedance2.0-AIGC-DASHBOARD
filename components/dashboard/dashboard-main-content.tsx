'use client'

import { useEffect, useState, type ChangeEvent, type DragEvent, type ReactNode, type RefObject } from 'react'
import { DashboardStatsPanel, type DashboardStatsData } from '@/components/dashboard/stats-panel'
import { TaskListPanel } from '@/components/dashboard/task-list-panel'
import { TeamManagementPanel } from '@/components/dashboard/team-management-panel'
import { AssetLibraryPanel } from '@/components/dashboard/asset-library-panel'
import { GenerationDisplayPanel } from '@/components/dashboard/generation-display-panel'
import { GenerationConfigPanel } from '@/components/dashboard/generation-config-panel'
import type { SizeTier } from '@/lib/modules/image/size-config'
import { HoverPreviewPortal } from '@/components/dashboard/hover-preview-portal'
import type {
  DashboardAsset as Asset,
  DashboardTask as Task,
  DashboardUploadItem,
  ImageGenerationUiMode,
  VideoImageSubMode,
  VideoGenerationUiMode,
} from '@/components/dashboard/types'
import type { ImageEditBBox } from '@/lib/modules/image/types'
import type { Descendant } from 'slate'
import { formatTokenCount, type TokenCalculationResult } from '@/lib/token-calculator'

interface DashboardMainContentProps {
  activeTab: string
  user: any
  assets: Asset[]
  tasks: Task[]
  taskCenterTasks: Task[]
  stats: DashboardStatsData | null
  uploadItems: DashboardUploadItem[]
  assetLibraryTab: 'creation' | 'subject'
  subjectFilter: 'all' | 'character' | 'scene' | 'prop'
  assetTypeFilter: 'all' | 'image' | 'video' | 'audio'
  hoveredAsset: string | null
  assetActionMenu: string | null
  taskViewAll: boolean
  taskStatusFilter: 'all' | 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'submit_unknown'
  taskMemberFilter: string
  taskTeamMembers: { id: string; name: string }[]
  isTaskAdmin: boolean
  statsViewTeam: boolean
  teamInfo: any
  teamMembers: any[]
  currentUserId: string | undefined
  hasMoreTasks: boolean
  hasObjectStorage: boolean
  canUploadAssets: boolean
  onLoadMore: () => void
  videoGenMode: VideoGenerationUiMode
  imageGenSubMode: VideoImageSubMode
  selectedModel: string
  referenceImages: Asset[]
  referenceVideos: Asset[]
  referenceAudios: Asset[]
  editorKey: number
  editorValue: Descendant[]
  resolution: string
  ratio: string
  duration: number
  videoCount: number
  videoPromptExtend: boolean
  videoSeed: string
  videoGenerateAudio: boolean
  estimatedTokens: number
  tokenResult: TokenCalculationResult
  inputVideoDuration: number
  isGenerating: boolean
  prompt: string
  displayFilter: 'all' | 'video' | 'image'
  statusFilter: 'all' | 'succeeded' | 'failed' | 'processing'
  rightPanelTasks: Task[]
  filteredRightPanelTasks: Task[]
  hoverPreview: { asset: Asset | null; position: { x: number; y: number } }
  audioPreviewRef: RefObject<HTMLAudioElement | null>
  onActiveTabChange: (tab: 'ai-video' | 'ai-image') => void
  onMainTabChange: (tab: string) => void
  onStartSubjectImageCreation: (draft: any) => void
  onStartStoryboardVideoCreation: (draft: any) => void
  onRefreshAssets: () => Promise<void>
  onVideoGenModeChange: (mode: VideoGenerationUiMode) => void
  onImageGenSubModeChange: (mode: VideoImageSubMode) => void
  onSelectedModelChange: (model: string) => void
  onOpenAssetPicker: (mode: 'image' | 'video' | 'audio') => void
  onDragStart: (type: 'image' | 'video' | 'audio', index: number) => void
  onDragOver: (event: DragEvent, type: 'image' | 'video' | 'audio', index: number) => void
  onDragEnd: () => void
  onRemoveReference: (type: 'image' | 'video' | 'audio', id: string) => void
  onEditorChange: (value: Descendant[]) => void
  onResolutionChange: (value: string) => void
  onRatioChange: (value: string) => void
  onDurationChange: (value: number) => void
  onVideoCountChange: (value: number) => void
  onVideoPromptExtendChange: (value: boolean) => void
  onVideoSeedChange: (value: string) => void
  onVideoGenerateAudioChange: (value: boolean) => void
  onGenerate: () => void
  imageSelectedModel: string
  imageReferenceImages: Asset[]
  imageReferenceBoxesByAssetId: Record<string, ImageEditBBox[]>
  imageEditorKey: number
  imageEditorValue: Descendant[]
  imageSize: string
  imageRatio: string
  imageRatioMode: 'preset' | 'custom'
  imageSizeTier: SizeTier
  imageCustomRatio: string
  imageOutputFormat: 'jpeg' | 'png'
  imageGenerationMode: ImageGenerationUiMode
  imageSequentialMode: 'disabled' | 'auto'
  imageMaxImages: number
  imageWatermark: boolean
  imageEnableWebSearch: boolean
  isImageGenerating: boolean
  imagePrompt: string
  onImageSelectedModelChange: (model: string) => void
  onImageSizeChange: (value: string) => void
  onImageRatioChange: (value: string) => void
  onImageRatioModeChange: (value: 'preset' | 'custom') => void
  onImageSizeTierChange: (value: string) => void
  onImageCustomRatioChange: (value: string) => void
  onImageOutputFormatChange: (value: 'jpeg' | 'png') => void
  onImageGenerationModeChange: (value: ImageGenerationUiMode) => void
  onImageSequentialModeChange: (value: 'disabled' | 'auto') => void
  onImageMaxImagesChange: (value: number) => void
  onImageWatermarkChange: (value: boolean) => void
  onImageEnableWebSearchChange: (value: boolean) => void
  onImageEditorChange: (value: Descendant[]) => void
  onGenerateImage: () => void
  onOpenImageBboxEditor: (asset: Asset) => void
  onClearVideoConfig: () => void
  onClearImageConfig: () => void
  onDisplayFilterChange: (filter: 'all' | 'video' | 'image') => void
  onStatusFilterChange: (filter: 'all' | 'succeeded' | 'failed' | 'processing') => void
  onRefreshGenerationTasks: () => void
  onReEdit: (task: Task, batchSize?: number) => void
  onReGenerate: (task: Task, batchSize?: number) => void
  onUseImageTaskAsReference: (task: Task) => Promise<void> | void
  onDeleteImageTask: (task: Task) => Promise<{ success: boolean; error?: string }>
  onUseVideoTasksAsReference: (tasks: Task[]) => Promise<void> | void
  onDeleteVideoTasks: (tasks: Task[]) => Promise<{ success: boolean; error?: string }>
  onVideoEdit: (task: Task) => void
  renderPromptWithRefs: (task: Task) => ReactNode
  getModeLabel: (mode: string) => string
  formatGenerationTime: (seconds: number) => string | null
  onAudioPlay: (assetId: string | null) => void
  onAudioPause: () => void
  onAssetLibraryTabChange: (tab: 'creation' | 'subject') => void
  onSubjectFilterChange: (filter: 'all' | 'character' | 'scene' | 'prop') => void
  onAssetTypeFilterChange: (filter: 'all' | 'image' | 'video' | 'audio') => void
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onHoverAsset: (assetId: string | null) => void
  onOpenAsset: (asset: Asset) => void
  onToggleActionMenu: (assetId: string | null) => void
  onSaveAsSubject: (asset: Asset | null) => void
  onDeleteAssetRequest: (asset: Asset | null) => void
  onTaskViewAllChange: (checked: boolean) => void
  onTaskStatusFilterChange: (status: 'all' | 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'submit_unknown') => void
  onTaskMemberFilterChange: (memberId: string) => void
  onRefreshTasks: () => void
  onOpenTaskDetail: (task: Task) => void
  onRefreshTask: (taskId: string) => Promise<{ success: boolean; error?: string }>
  formatTokens: (tokens: number | string) => string
  onToggleStatsViewTeam: () => void
  onOpenRechargeModal: () => void
  onOpenAddMemberModal: () => void
  onOpenAllocateModal: (member: any) => void
  onOpenEditMemberModal: (member: any) => void
  onDeleteMember: (memberId: string) => Promise<{ success: boolean; error?: string }>
}

export function DashboardMainContent(props: DashboardMainContentProps) {
  const {
    activeTab,
    user,
    assets,
    tasks,
    taskCenterTasks,
    stats,
    uploadItems,
    assetLibraryTab,
    subjectFilter,
    assetTypeFilter,
    hoveredAsset,
    assetActionMenu,
    taskViewAll,
    taskStatusFilter,
    taskMemberFilter,
    taskTeamMembers,
    isTaskAdmin,
    statsViewTeam,
    teamInfo,
    teamMembers,
    currentUserId,
    hasMoreTasks,
    hasObjectStorage,
    canUploadAssets,
    onLoadMore,
    videoGenMode,
    imageGenSubMode,
    selectedModel,
    referenceImages,
    referenceVideos,
    referenceAudios,
    editorKey,
    editorValue,
    resolution,
    ratio,
    duration,
    videoCount,
    videoPromptExtend,
    videoSeed,
    videoGenerateAudio,
    estimatedTokens,
    tokenResult,
    inputVideoDuration,
    isGenerating,
    prompt,
    displayFilter,
    statusFilter,
    rightPanelTasks,
    filteredRightPanelTasks,
    hoverPreview,
    audioPreviewRef,
    onActiveTabChange,
    onMainTabChange,
    onStartSubjectImageCreation,
    onStartStoryboardVideoCreation,
    onRefreshAssets,
    onVideoGenModeChange,
    onImageGenSubModeChange,
    onSelectedModelChange,
    onOpenAssetPicker,
    onDragStart,
    onDragOver,
    onDragEnd,
    onRemoveReference,
    onEditorChange,
    onResolutionChange,
    onRatioChange,
    onDurationChange,
    onVideoCountChange,
    onVideoPromptExtendChange,
    onVideoSeedChange,
    onVideoGenerateAudioChange,
    onGenerate,
    imageSelectedModel,
    imageReferenceImages,
    imageReferenceBoxesByAssetId,
    imageEditorKey,
    imageEditorValue,
    imageSize,
    imageRatio,
    imageRatioMode,
    imageSizeTier,
    imageCustomRatio,
    imageOutputFormat,
    imageGenerationMode,
    imageSequentialMode,
    imageMaxImages,
    imageWatermark,
    imageEnableWebSearch,
    isImageGenerating,
    imagePrompt,
    onImageSelectedModelChange,
    onImageSizeChange,
    onImageRatioChange,
    onImageRatioModeChange,
    onImageSizeTierChange,
    onImageCustomRatioChange,
    onImageOutputFormatChange,
    onImageGenerationModeChange,
    onImageSequentialModeChange,
    onImageMaxImagesChange,
    onImageWatermarkChange,
    onImageEnableWebSearchChange,
    onImageEditorChange,
    onGenerateImage,
    onOpenImageBboxEditor,
    onClearVideoConfig,
    onClearImageConfig,
    onDisplayFilterChange,
    onStatusFilterChange,
    onRefreshGenerationTasks,
    onReEdit,
    onReGenerate,
    onUseImageTaskAsReference,
    onDeleteImageTask,
    onUseVideoTasksAsReference,
    onDeleteVideoTasks,
    onVideoEdit,
    renderPromptWithRefs,
    getModeLabel,
    formatGenerationTime,
    onAudioPlay,
    onAudioPause,
    onAssetLibraryTabChange,
    onSubjectFilterChange,
    onAssetTypeFilterChange,
    onFileUpload,
    onHoverAsset,
    onOpenAsset,
    onToggleActionMenu,
    onSaveAsSubject,
    onDeleteAssetRequest,
    onTaskViewAllChange,
    onTaskStatusFilterChange,
    onTaskMemberFilterChange,
    onRefreshTasks,
    onOpenTaskDetail,
    onRefreshTask,
    formatTokens,
    onToggleStatsViewTeam,
    onOpenRechargeModal,
    onOpenAddMemberModal,
    onOpenAllocateModal,
    onOpenEditMemberModal,
    onDeleteMember,
  } = props

  const [mobileAiPanel, setMobileAiPanel] = useState<'config' | 'results'>('config')

  useEffect(() => {
    if (activeTab !== 'ai-video' && activeTab !== 'ai-image') {
      setMobileAiPanel('config')
    }
  }, [activeTab])

  return (
    <main className="flex-1 min-h-0 overflow-visible pb-24 xl:h-screen xl:overflow-hidden xl:pb-0">
      {(activeTab === 'ai-video' || activeTab === 'ai-image') && (
        <div className="flex min-h-full flex-col xl:h-full xl:flex-row">
          <div className="sticky top-[73px] z-20 border-b border-zinc-800/80 bg-[#050505]/95 px-4 py-3 backdrop-blur xl:hidden">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1">
              <button
                onClick={() => setMobileAiPanel('config')}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                  mobileAiPanel === 'config'
                    ? activeTab === 'ai-image'
                      ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'text-zinc-400'
                }`}
              >
                生成配置
              </button>
              <button
                onClick={() => setMobileAiPanel('results')}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                  mobileAiPanel === 'results'
                    ? activeTab === 'ai-image'
                      ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'text-zinc-400'
                }`}
              >
                任务结果
              </button>
            </div>
          </div>

          <div className={`${mobileAiPanel === 'config' ? 'block' : 'hidden'} xl:block`}>
            <GenerationConfigPanel
              activeTab={activeTab as 'ai-video' | 'ai-image'}
              hasObjectStorage={hasObjectStorage}
              videoGenMode={videoGenMode}
              imageGenSubMode={imageGenSubMode}
              selectedModel={selectedModel}
              referenceImages={referenceImages}
              referenceVideos={referenceVideos}
              referenceAudios={referenceAudios}
              editorKey={editorKey}
              editorValue={editorValue}
              resolution={resolution}
              ratio={ratio}
          duration={duration}
          videoCount={videoCount}
          videoPromptExtend={videoPromptExtend}
          videoSeed={videoSeed}
          videoGenerateAudio={videoGenerateAudio}
          estimatedTokens={estimatedTokens}
              tokenResult={tokenResult}
              inputVideoDuration={inputVideoDuration}
              isGenerating={isGenerating}
              prompt={prompt}
              onActiveTabChange={onActiveTabChange}
              onVideoGenModeChange={onVideoGenModeChange}
              onImageGenSubModeChange={onImageGenSubModeChange}
              onSelectedModelChange={onSelectedModelChange}
              onOpenAssetPicker={onOpenAssetPicker}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onRemoveReference={onRemoveReference}
              onEditorChange={onEditorChange}
              onResolutionChange={onResolutionChange}
              onRatioChange={onRatioChange}
          onDurationChange={onDurationChange}
          onVideoCountChange={onVideoCountChange}
          onVideoPromptExtendChange={onVideoPromptExtendChange}
          onVideoSeedChange={onVideoSeedChange}
          onVideoGenerateAudioChange={onVideoGenerateAudioChange}
          onGenerate={onGenerate}
              imageSelectedModel={imageSelectedModel}
              imageReferenceImages={imageReferenceImages}
              imageReferenceBoxesByAssetId={imageReferenceBoxesByAssetId}
              imageEditorKey={imageEditorKey}
              imageEditorValue={imageEditorValue}
              imageSize={imageSize}
              imageRatio={imageRatio}
              imageRatioMode={imageRatioMode}
              imageSizeTier={imageSizeTier}
              imageCustomRatio={imageCustomRatio}
              imageOutputFormat={imageOutputFormat}
              imageGenerationMode={imageGenerationMode}
              imageSequentialMode={imageSequentialMode}
              imageMaxImages={imageMaxImages}
              imageWatermark={imageWatermark}
              imageEnableWebSearch={imageEnableWebSearch}
              isImageGenerating={isImageGenerating}
              imagePrompt={imagePrompt}
              onImageSelectedModelChange={onImageSelectedModelChange}
              onImageSizeChange={onImageSizeChange}
              onImageRatioChange={onImageRatioChange}
              onImageRatioModeChange={onImageRatioModeChange}
              onImageSizeTierChange={onImageSizeTierChange}
              onImageCustomRatioChange={onImageCustomRatioChange}
              onImageOutputFormatChange={onImageOutputFormatChange}
              onImageGenerationModeChange={onImageGenerationModeChange}
              onImageSequentialModeChange={onImageSequentialModeChange}
              onImageMaxImagesChange={onImageMaxImagesChange}
              onImageWatermarkChange={onImageWatermarkChange}
              onImageEnableWebSearchChange={onImageEnableWebSearchChange}
              onImageEditorChange={onImageEditorChange}
              onGenerateImage={onGenerateImage}
              onOpenImageBboxEditor={onOpenImageBboxEditor}
              onClearVideoConfig={onClearVideoConfig}
              onClearImageConfig={onClearImageConfig}
            />
          </div>

          <div className={`${mobileAiPanel === 'results' ? 'flex min-h-[50vh] flex-1' : 'hidden'} xl:flex xl:min-h-0 xl:flex-1`}>
            <GenerationDisplayPanel
              activeTab={activeTab as 'ai-video' | 'ai-image'}
              displayFilter={displayFilter}
              statusFilter={statusFilter}
              tasks={tasks}
              rightPanelTasks={rightPanelTasks}
              filteredRightPanelTasks={filteredRightPanelTasks}
              isGenerating={isGenerating}
              onDisplayFilterChange={onDisplayFilterChange}
              onStatusFilterChange={onStatusFilterChange}
              onRefresh={onRefreshGenerationTasks}
              onReEdit={onReEdit}
              onReGenerate={onReGenerate}
              onUseImageTaskAsReference={onUseImageTaskAsReference}
              onDeleteImageTask={onDeleteImageTask}
              onUseVideoTasksAsReference={onUseVideoTasksAsReference}
              onDeleteVideoTasks={onDeleteVideoTasks}
              onVideoEdit={onVideoEdit}
              renderPromptWithRefs={renderPromptWithRefs}
              getModeLabel={getModeLabel}
              formatGenerationTime={formatGenerationTime}
            />
          </div>

          <HoverPreviewPortal
            asset={hoverPreview.asset}
            position={hoverPreview.position}
            audioPreviewRef={audioPreviewRef}
            onAudioPlay={onAudioPlay}
            onAudioPause={onAudioPause}
          />
        </div>
      )}

      {activeTab === 'assets' && (
        <div className="min-h-full xl:h-full xl:min-h-0 xl:overflow-hidden">
          <AssetLibraryPanel
            assets={assets}
            uploadItems={uploadItems}
            canUploadAssets={canUploadAssets}
            assetLibraryTab={assetLibraryTab}
            subjectFilter={subjectFilter}
            assetTypeFilter={assetTypeFilter}
            hoveredAsset={hoveredAsset}
            assetActionMenu={assetActionMenu}
            onAssetLibraryTabChange={onAssetLibraryTabChange}
            onSubjectFilterChange={onSubjectFilterChange}
            onAssetTypeFilterChange={onAssetTypeFilterChange}
            onFileUpload={onFileUpload}
            onHoverAsset={onHoverAsset}
            onOpenAsset={onOpenAsset}
            onToggleActionMenu={onToggleActionMenu}
            onSaveAsSubject={onSaveAsSubject}
            onDeleteAssetRequest={onDeleteAssetRequest}
          />
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="min-h-full xl:h-full xl:min-h-0 xl:overflow-y-auto">
          <TaskListPanel
            tasks={taskCenterTasks}
            isTaskAdmin={isTaskAdmin}
            taskViewAll={taskViewAll}
            taskStatusFilter={taskStatusFilter}
            taskMemberFilter={taskMemberFilter}
            taskTeamMembers={taskTeamMembers}
            hasMoreTasks={hasMoreTasks}
            onLoadMore={onLoadMore}
            onTaskViewAllChange={onTaskViewAllChange}
            onTaskStatusFilterChange={onTaskStatusFilterChange}
            onTaskMemberFilterChange={onTaskMemberFilterChange}
            onRefresh={onRefreshTasks}
            onOpenDetail={onOpenTaskDetail}
            onRefreshTask={onRefreshTask}
            formatTokens={formatTokens}
          />
        </div>
      )}

      {activeTab === 'stats' && stats && (
        <DashboardStatsPanel
          stats={stats}
          statsViewTeam={statsViewTeam}
          onToggleViewTeam={onToggleStatsViewTeam}
          formatTokenCount={formatTokenCount}
        />
      )}

      {activeTab === 'team' && user?.role === 'admin' && (
        <TeamManagementPanel
          teamInfo={teamInfo}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
          onOpenRechargeModal={onOpenRechargeModal}
          onOpenAddMemberModal={onOpenAddMemberModal}
          onOpenAllocateModal={onOpenAllocateModal}
          onOpenEditMemberModal={onOpenEditMemberModal}
          onDeleteMember={onDeleteMember}
        />
      )}
    </main>
  )
}
