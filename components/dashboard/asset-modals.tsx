'use client'

import type { ChangeEvent, UIEvent } from 'react'
import type { DashboardAsset, DashboardUploadItem } from '@/components/dashboard/types'

type AssetPickerMode = 'image' | 'video' | 'audio'

export function AssetPickerModal(props: {
  open: boolean
  mode: AssetPickerMode
  uploadItems: DashboardUploadItem[]
  selectedCount: number
  filteredAssets: DashboardAsset[]
  filteredAssetCount: number
  visibleAssets: DashboardAsset[]
  hasMoreAssets: boolean
  isLoadingAssets: boolean
  assetLoadError: string | null
  search: string
  selectedAssets: DashboardAsset[]
  onClose: () => void
  onSearchChange: (value: string) => void
  onScroll: (event: UIEvent<HTMLDivElement>) => void
  onToggleAsset: (asset: DashboardAsset) => void
  onUpload: (event: ChangeEvent<HTMLInputElement>, mode: AssetPickerMode) => void
  onConfirm: () => void
}) {
  const {
    open,
    mode,
    uploadItems,
    selectedCount,
    filteredAssets,
    filteredAssetCount,
    visibleAssets,
    hasMoreAssets,
    isLoadingAssets,
    assetLoadError,
    search,
    selectedAssets,
    onClose,
    onSearchChange,
    onScroll,
    onToggleAsset,
    onUpload,
    onConfirm,
  } = props

  if (!open) return null

  const relevantUploads = uploadItems.filter((item) => item.type === mode)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md">
      <div className="flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/90 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  {mode === 'image' ? '选择图片' : mode === 'video' ? '选择视频' : '选择音频'}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {selectedCount > 0 ? `已选择 ${selectedCount} 个素材` : '从资产库选择，或上传新素材'}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/70 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b border-zinc-800/80 bg-zinc-950/60 p-4">
          <label className="group flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-4 transition-all hover:border-blue-500/50 hover:bg-blue-500/5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-zinc-400 transition group-hover:text-blue-300">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-200">上传{mode === 'image' ? '图片' : mode === 'video' ? '视频' : '音频'}</span>
              <span className="mt-0.5 block text-xs text-zinc-500">支持多选，上传完成后自动进入当前选择列表</span>
            </span>
            <input
              type="file"
              multiple
              accept={mode === 'image' ? 'image/*' : mode === 'video' ? 'video/*' : 'audio/*'}
              onChange={(e) => onUpload(e, mode)}
              className="hidden"
            />
          </label>

          {relevantUploads.length > 0 && (
            <div className="mt-4 space-y-2">
              {relevantUploads.map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-xs mb-2">
                    <div className="min-w-0">
                      <div className="text-zinc-200 truncate">{item.name}</div>
                      <div className="text-zinc-500">
                        {(item.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <div className={`shrink-0 ${
                      item.status === 'failed'
                        ? 'text-red-400'
                        : item.status === 'completed'
                          ? 'text-emerald-400'
                          : 'text-blue-400'
                    }`}>
                      {item.status === 'preparing'
                        ? '准备中'
                        : item.status === 'uploading'
                          ? `${item.progress}%`
                          : item.status === 'finalizing'
                            ? '写库中'
                            : item.status === 'completed'
                              ? '完成'
                              : '失败'}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        item.status === 'failed' ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                      }`}
                      style={{ width: `${Math.max(4, item.progress)}%` }}
                    />
                  </div>
                  {item.errorMessage && (
                    <div className="text-[11px] text-red-400 mt-2">{item.errorMessage}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4" onScroll={onScroll}>
          <div className="mb-3 relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索资产..."
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 py-3 pl-10 pr-10 text-sm text-zinc-200 outline-none transition focus:border-blue-500/50 focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/10"
            />
            {search && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <p className="mb-3 text-xs text-zinc-500">
            从资产库选择（点击多选）
            {filteredAssetCount > 0 && <span className="ml-2 text-zinc-400">共 {filteredAssetCount} 个，已加载 {visibleAssets.length} 个</span>}
          </p>
          {assetLoadError && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {assetLoadError}
            </div>
          )}
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {visibleAssets.map((asset) => {
              const isSelected = selectedAssets.find((item) => item.id === asset.id)
              return (
                <button
                  key={asset.id}
                  onClick={() => onToggleAsset(asset)}
                  title={asset.name}
                  className={`relative aspect-square overflow-hidden rounded-2xl border transition-all ${
                    isSelected ? 'border-blue-400 ring-2 ring-blue-500/30' : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-600'
                  }`}
                >
                  {asset.type === 'image' ? (
                    <img src={asset.url} alt={asset.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : asset.type === 'video' ? (
                    <video src={asset.url} preload="none" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl">🎵</span>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 shadow-lg shadow-blue-950/40">
                      <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {(hasMoreAssets || isLoadingAssets) && (
            <div className="text-center py-4">
              <p className="text-xs text-zinc-500">{isLoadingAssets ? '加载中...' : '继续下滑加载更多'}</p>
            </div>
          )}
          {!isLoadingAssets && filteredAssets.length === 0 && (
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm">
                {search ? '没有找到匹配的资产' : `资产库中暂无${mode === 'image' ? '图片' : mode === 'video' ? '视频' : '音频'}`}
              </p>
              <p className="text-zinc-600 text-xs mt-1">请上传新素材</p>
            </div>
          )}
        </div>

        {selectedCount > 0 && (
          <div className="border-t border-zinc-800/80 bg-zinc-950/90 p-4">
            <button
              onClick={onConfirm}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-medium text-white shadow-lg shadow-blue-950/30 transition-all hover:from-blue-500 hover:to-purple-500"
            >
              添加 {selectedCount} 个{mode === 'image' ? '图片' : mode === 'video' ? '视频' : '音频'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function AssetDetailModal(props: {
  open: boolean
  asset: DashboardAsset | null
  onClose: () => void
  onChange: (asset: DashboardAsset) => void
  onSave: () => void
  onDelete: (asset: DashboardAsset) => void
}) {
  const { open, asset, onClose, onChange, onSave, onDelete } = props
  if (!open || !asset) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl border border-zinc-700 w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-video bg-zinc-900 flex items-center justify-center">
          {asset.type === 'image' ? (
            <img src={asset.url} alt={asset.name} className="w-full h-full object-contain" />
          ) : asset.type === 'video' ? (
            <video src={asset.url} controls preload="metadata" playsInline className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <span className="text-6xl">🎵</span>
              <audio src={asset.url} controls className="w-64" />
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="mb-4">
            <label className="block text-xs text-zinc-500 mb-1">文件名</label>
            <input
              type="text"
              value={asset.name}
              onChange={(e) => onChange({ ...asset, name: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {asset.category === 'subject' && (
            <div className="mb-4">
              <label className="block text-xs text-zinc-500 mb-1">主体名称</label>
              <input
                type="text"
                value={asset.subjectName || ''}
                onChange={(e) => onChange({ ...asset, subjectName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-zinc-500 mb-6">
            <span>类型: {asset.type === 'image' ? '图片' : asset.type === 'video' ? '视频' : '音频'}</span>
            <span>分类: {asset.category === 'creation' ? '创作资产' : '主体库'}</span>
            {asset.subjectType && <span>主体类型: {asset.subjectType === 'character' ? '人物' : asset.subjectType === 'scene' ? '场景' : '道具'}</span>}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => onDelete(asset)}
              className="py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-medium text-red-300 transition-all hover:bg-red-500/20 sm:w-[112px]"
            >
              删除
            </button>
            <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-700 text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-all">
              取消
            </button>
            <button onClick={onSave} className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-blue-500 hover:to-purple-500 transition-all">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DeleteAssetConfirmModal(props: {
  asset: DashboardAsset | null
  onClose: () => void
  onConfirm: () => void
}) {
  const { asset, onClose, onConfirm } = props
  if (!asset) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 border border-zinc-700 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-100 mb-2">确认删除</h3>
          <p className="text-sm text-zinc-400">确定要删除「{asset.name}」吗？</p>
          <p className="text-xs text-zinc-500 mt-1">此操作不可撤销</p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-700 text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-all">
            取消
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-all">
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

export function SaveAsSubjectModal(props: {
  asset: DashboardAsset | null
  onClose: () => void
  onSave: (subjectType: 'character' | 'scene' | 'prop', name: string) => void
}) {
  const { asset, onClose, onSave } = props
  if (!asset) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl border border-zinc-700 w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-video bg-zinc-900 flex items-center justify-center">
          <img src={asset.url} alt={asset.name} className="w-full h-full object-contain" />
        </div>

        <div className="p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">保存为主体</h3>

          <div className="mb-4">
            <label className="block text-xs text-zinc-500 mb-2">主体名称</label>
            <input
              type="text"
              defaultValue={asset.name.replace(/\.[^.]+$/, '')}
              id="subject-name-input"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-blue-500"
              placeholder="输入主体名称"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs text-zinc-500 mb-2">主体类型</label>
            <div className="grid grid-cols-3 gap-3">
              {([
                ['character', '👤', '人物角色'],
                ['scene', '🏙️', '场景背景'],
                ['prop', '🎭', '道具物件'],
              ] as const).map(([subjectType, icon, label]) => (
                <button
                  key={subjectType}
                  type="button"
                  onClick={() => {
                    const nameInput = document.getElementById('subject-name-input') as HTMLInputElement
                    const name = nameInput?.value || asset.name
                    onSave(subjectType, name)
                  }}
                  className={`py-3 px-4 rounded-xl border border-zinc-700 transition-all flex flex-col items-center gap-2 ${
                    subjectType === 'character'
                      ? 'hover:border-blue-500 hover:bg-blue-500/10'
                      : subjectType === 'scene'
                        ? 'hover:border-emerald-500 hover:bg-emerald-500/10'
                        : 'hover:border-purple-500 hover:bg-purple-500/10'
                  }`}
                >
                  <span className="text-2xl">{icon}</span>
                  <span className="text-xs text-zinc-300">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <button onClick={onClose} className="w-full py-2.5 border border-zinc-700 text-zinc-400 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-all">
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
