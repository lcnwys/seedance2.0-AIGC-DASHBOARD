'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { DashboardAsset, DashboardUploadItem } from '@/components/dashboard/types'

type AssetTypeFilter = 'all' | 'image' | 'video' | 'audio'
const ASSET_PAGE_SIZE = 10

export function AssetLibraryPanel(props: {
  assets: DashboardAsset[]
  uploadItems: DashboardUploadItem[]
  assetLibraryTab: 'creation' | 'subject'
  subjectFilter: 'all' | 'character' | 'scene' | 'prop'
  assetTypeFilter: AssetTypeFilter
  hoveredAsset: string | null
  assetActionMenu: string | null
  canUploadAssets: boolean
  onAssetLibraryTabChange: (tab: 'creation' | 'subject') => void
  onSubjectFilterChange: (filter: 'all' | 'character' | 'scene' | 'prop') => void
  onAssetTypeFilterChange: (filter: AssetTypeFilter) => void
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onHoverAsset: (assetId: string | null) => void
  onOpenAsset: (asset: DashboardAsset) => void
  onToggleActionMenu: (assetId: string | null) => void
  onSaveAsSubject: (asset: DashboardAsset) => void
  onDeleteAssetRequest: (asset: DashboardAsset) => void
}) {
  const {
    assets,
    uploadItems,
    assetTypeFilter,
    hoveredAsset,
    assetActionMenu,
    canUploadAssets,
    onAssetTypeFilterChange,
    onFileUpload,
    onHoverAsset,
    onOpenAsset,
    onToggleActionMenu,
    onDeleteAssetRequest,
  } = props

  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(ASSET_PAGE_SIZE)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const filteredAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return assets.filter((asset) => {
      if (asset.category !== 'creation') return false
      if (assetTypeFilter !== 'all' && asset.type !== assetTypeFilter) return false
      if (!normalizedSearch) return true

      return [
        asset.name,
        asset.subjectName,
        asset.type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    })
  }, [assetTypeFilter, assets, search])

  useEffect(() => {
    setVisibleCount(ASSET_PAGE_SIZE)
  }, [assetTypeFilter, search, assets.length])

  const visibleAssets = filteredAssets.slice(0, visibleCount)
  const hasMoreAssets = visibleCount < filteredAssets.length

  useEffect(() => {
    if (!hasMoreAssets || typeof IntersectionObserver === 'undefined') {
      return
    }

    const root = scrollContainerRef.current
    const target = loadMoreRef.current
    if (!target) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((current) => Math.min(current + ASSET_PAGE_SIZE, filteredAssets.length))
        }
      },
      {
        root,
        rootMargin: '220px 0px',
      }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [filteredAssets.length, hasMoreAssets])

  return (
    <div ref={scrollContainerRef} className="h-full overflow-y-auto px-3 pb-24 pt-3 md:px-4 md:pb-8 md:pt-4">
      <div className="sticky top-0 z-20 mb-3 bg-[#050505]/95 pb-3 backdrop-blur md:mb-4">
        <div className="glass rounded-2xl border border-zinc-800 p-3 md:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-base font-medium text-zinc-100 md:text-lg">资产库</div>
                <div className="mt-1 text-xs text-zinc-500 md:text-sm">
                  默认先展示 10 条，继续下拉会按需加载，搜索和筛选会实时收窄结果。
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                已显示 {visibleAssets.length} / {filteredAssets.length}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索资产名称 / 类型"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
              />
              <label
                className={`rounded-xl px-4 py-2.5 text-center text-sm font-medium transition-all md:min-w-[116px] ${
                  canUploadAssets
                    ? 'cursor-pointer bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500'
                    : 'cursor-not-allowed border border-zinc-800 bg-zinc-900/40 text-zinc-600'
                }`}
                title={canUploadAssets ? '上传资产' : '当前状态不允许上传到素材库'}
              >
                上传资产
                <input type="file" multiple onChange={onFileUpload} disabled={!canUploadAssets} className="hidden" />
              </label>
            </div>
            {!canUploadAssets ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                当前状态下资产库上传已关闭；生成面板仍可上传临时参考素材并提交给厂商。
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {(['all', 'image', 'video', 'audio'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => onAssetTypeFilterChange(type)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-all ${
                    assetTypeFilter === type ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {type === 'all' ? '全部' : type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'}
                </button>
              ))}
              {hasMoreAssets ? <span className="self-center text-xs text-zinc-500">继续下滑加载更多</span> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-zinc-800 p-3 md:p-4">
        {uploadItems.length > 0 && (
          <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 md:p-4">
            <div className="mb-3 text-sm font-medium text-zinc-200">上传队列</div>
            <div className="space-y-2">
              {uploadItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="truncate text-zinc-200">{item.name}</div>
                      <div className="text-zinc-500">
                        {item.type === 'image' ? '图片' : item.type === 'video' ? '视频' : '音频'} · {(item.size / 1024 / 1024).toFixed(2)} MB
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
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full transition-all ${
                        item.status === 'failed' ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                      }`}
                      style={{ width: `${Math.max(4, item.progress)}%` }}
                    />
                  </div>
                  {item.errorMessage && (
                    <div className="mt-2 text-[11px] text-red-400">{item.errorMessage}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(164px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(188px,1fr))]">
          {visibleAssets.map((asset) => (
            <div
              key={asset.id}
              className="glass group relative overflow-hidden rounded-xl border border-zinc-800 transition-all hover:border-blue-500/50"
              onMouseEnter={() => onHoverAsset(asset.id)}
              onMouseLeave={() => onHoverAsset(null)}
              onClick={() => onOpenAsset(asset)}
            >
              <div className="relative overflow-hidden rounded-t-xl bg-zinc-900/60">
                {asset.type === 'image' ? (
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="aspect-[4/5] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : asset.type === 'video' ? (
                  <video
                    src={asset.url}
                    className="aspect-[4/5] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="flex aspect-[4/5] w-full items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-fuchsia-950/50">
                    <span className="text-3xl md:text-4xl">🎵</span>
                  </div>
                )}

                <div
                  className={`absolute right-1 top-1 flex items-center gap-1 transition-opacity md:opacity-0 ${
                    hoveredAsset === asset.id || assetActionMenu === asset.id ? 'opacity-100' : 'opacity-100 md:group-hover:opacity-100'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteAssetRequest(asset)
                      onToggleActionMenu(null)
                    }}
                    className="flex h-6 min-w-6 items-center justify-center rounded-md bg-red-500/70 px-1.5 text-[11px] font-medium text-white transition-all hover:bg-red-500"
                    title="删除资产"
                  >
                    删
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleActionMenu(assetActionMenu === asset.id ? null : asset.id)
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white/80 transition-all hover:bg-black/80 hover:text-white"
                    title="更多操作"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>

                  {assetActionMenu === asset.id && (
                    <div
                      className="absolute right-0 top-7 w-36 py-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          onOpenAsset(asset)
                          onToggleActionMenu(null)
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        重命名
                      </button>
                      <button
                        onClick={() => {
                          onDeleteAssetRequest(asset)
                          onToggleActionMenu(null)
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate text-sm text-zinc-200">{asset.name}</p>
                <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                  <span>{asset.type === 'image' ? '图片' : asset.type === 'video' ? '视频' : '音频'}</span>
                  {asset.createdAt ? (
                    <span className="shrink-0">
                      {new Date(asset.createdAt).toLocaleDateString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        {hasMoreAssets ? <div ref={loadMoreRef} className="h-8 w-full" /> : null}

        {filteredAssets.length === 0 && (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900">
              <span className="text-3xl">📁</span>
            </div>
            <p className="text-zinc-500">
              暂无
              {assetTypeFilter === 'all'
                ? '创作'
                : assetTypeFilter === 'image'
                  ? '图片'
                  : assetTypeFilter === 'video'
                    ? '视频'
                    : '音频'}
              资产
            </p>
            <p className="mt-1 text-xs text-zinc-600">上传文件开始使用</p>
          </div>
        )}
      </div>
    </div>
  )
}
