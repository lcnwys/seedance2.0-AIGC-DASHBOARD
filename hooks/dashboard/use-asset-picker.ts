'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UIEvent } from 'react'
import type { DashboardAsset as Asset } from '@/components/dashboard/types'
import { getStoredToken } from '@/lib/modules/auth/browser-session'

type AssetPickerMode = 'image' | 'video' | 'audio'

export function useAssetPicker(
  fallbackAssets: Asset[],
  open: boolean,
  assetPickerMode: AssetPickerMode,
  assetPickerSearch: string,
  pageSize: number = 24
) {
  const [assetPickerPage, setAssetPickerPage] = useState(1)
  const [serverAssets, setServerAssets] = useState<Asset[]>([])
  const [serverTotal, setServerTotal] = useState(0)
  const [hasMoreAssets, setHasMoreAssets] = useState(false)
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [assetLoadError, setAssetLoadError] = useState<string | null>(null)
  const requestSeqRef = useRef(0)

  const loadAssetPickerPage = useCallback(async (page: number, append: boolean) => {
    if (!open) return

    const token = getStoredToken()
    const requestSeq = requestSeqRef.current + 1
    requestSeqRef.current = requestSeq
    setIsLoadingAssets(true)
    setAssetLoadError(null)

    try {
      const params = new URLSearchParams()
      params.set('type', assetPickerMode)
      params.set('page', String(page))
      params.set('limit', String(pageSize))
      const search = assetPickerSearch.trim()
      if (search) {
        params.set('search', search)
      }

      const response = await fetch(`/api/assets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error(`资源加载失败 (${response.status})`)
      }

      const data = await response.json() as {
        assets?: Asset[]
        pagination?: {
          total?: number
          hasMore?: boolean
        }
      }

      if (requestSeqRef.current !== requestSeq) {
        return
      }

      const nextAssets = data.assets || []
      setServerAssets((prev) => append ? [...prev, ...nextAssets] : nextAssets)
      setServerTotal(data.pagination?.total || nextAssets.length)
      setHasMoreAssets(Boolean(data.pagination?.hasMore))
      setAssetPickerPage(page)
    } catch (error) {
      if (requestSeqRef.current !== requestSeq) {
        return
      }
      setAssetLoadError(error instanceof Error ? error.message : '资源加载失败')
    } finally {
      if (requestSeqRef.current === requestSeq) {
        setIsLoadingAssets(false)
      }
    }
  }, [assetPickerMode, assetPickerSearch, open, pageSize])

  useEffect(() => {
    if (!open) {
      return
    }

    const timer = window.setTimeout(() => {
      void loadAssetPickerPage(1, false)
    }, assetPickerSearch.trim() ? 250 : 0)

    return () => window.clearTimeout(timer)
  }, [assetPickerMode, assetPickerSearch, loadAssetPickerPage, open])

  useEffect(() => {
    if (!open) {
      setServerAssets([])
      setServerTotal(0)
      setHasMoreAssets(false)
      setIsLoadingAssets(false)
      setAssetLoadError(null)
      setAssetPickerPage(1)
    }
  }, [open])

  const filteredAssets = useMemo(() => {
    if (open) {
      return serverAssets
    }

    let filtered = fallbackAssets.filter((asset) => asset.type === assetPickerMode)
    if (assetPickerSearch.trim()) {
      const query = assetPickerSearch.toLowerCase()
      filtered = filtered.filter((asset) => asset.name.toLowerCase().includes(query))
    }
    return filtered
  }, [assetPickerMode, assetPickerSearch, fallbackAssets, open, serverAssets])

  const visibleAssets = filteredAssets
  const filteredAssetCount = open ? serverTotal : filteredAssets.length

  const handleAssetPickerScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 100 && hasMoreAssets && !isLoadingAssets) {
      void loadAssetPickerPage(assetPickerPage + 1, true)
    }
  }, [assetPickerPage, hasMoreAssets, isLoadingAssets, loadAssetPickerPage])

  const prependAssetPickerAssets = useCallback((assets: Asset[]) => {
    if (assets.length === 0) return
    const incomingIds = new Set(assets.map((asset) => asset.id))
    setServerAssets((prev) => [
      ...assets.filter((asset) => asset.type === assetPickerMode),
      ...prev.filter((asset) => !incomingIds.has(asset.id)),
    ])
    setServerTotal((prev) => prev + assets.filter((asset) => asset.type === assetPickerMode).length)
  }, [assetPickerMode])

  return {
    filteredAssets,
    filteredAssetCount,
    visibleAssets,
    hasMoreAssets,
    isLoadingAssets,
    assetLoadError,
    assetPickerPage,
    setAssetPickerPage,
    handleAssetPickerScroll,
    reloadAssetPicker: () => loadAssetPickerPage(1, false),
    prependAssetPickerAssets,
  }
}
