'use client'

import { useCallback } from 'react'
import type { ChangeEvent } from 'react'
import type {
  DashboardAsset as Asset,
  DashboardAssetType as AssetType,
  DashboardUploadItem,
} from '@/components/dashboard/types'
import { createClientId } from '@/lib/modules/browser/client-id'
import { getStoredToken } from '@/lib/modules/auth/browser-session'

type SubjectType = 'character' | 'scene' | 'prop'
const MAX_CONCURRENT_UPLOADS = 3
const COMPLETED_UPLOAD_RETENTION_MS = 1500
const FAILED_UPLOAD_RETENTION_MS = 5000

export function useAssetLibrary({
  referenceUploadModel,
  referenceUploadFamily,
  setAssets,
  setUploadItems,
  setEditingAsset,
  setShowAssetDetail,
  setAssetActionMenu,
  setDeleteConfirmAsset,
  setSaveAsSubjectAsset,
  setReferenceImages,
  setReferenceVideos,
  setReferenceAudios,
  setShowAssetPicker,
  onAssetsUploaded,
}: {
  referenceUploadModel?: string
  referenceUploadFamily?: 'image' | 'video'
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>
  setUploadItems: React.Dispatch<React.SetStateAction<DashboardUploadItem[]>>
  setEditingAsset: React.Dispatch<React.SetStateAction<Asset | null>>
  setShowAssetDetail: React.Dispatch<React.SetStateAction<boolean>>
  setAssetActionMenu: React.Dispatch<React.SetStateAction<string | null>>
  setDeleteConfirmAsset: React.Dispatch<React.SetStateAction<Asset | null>>
  setSaveAsSubjectAsset: React.Dispatch<React.SetStateAction<Asset | null>>
  setReferenceImages: React.Dispatch<React.SetStateAction<Asset[]>>
  setReferenceVideos: React.Dispatch<React.SetStateAction<Asset[]>>
  setReferenceAudios: React.Dispatch<React.SetStateAction<Asset[]>>
  setShowAssetPicker: React.Dispatch<React.SetStateAction<boolean>>
  onAssetsUploaded?: (assets: Asset[]) => void
}) {
  const upsertLocalAsset = useCallback((asset: Asset) => {
    setAssets((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === asset.id)
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = { ...prev[existingIndex], ...asset }
        return next
      }
      return [asset, ...prev]
    })
  }, [setAssets])

  const placeUploadedAssetsAtFront = useCallback((uploadedAssets: Asset[]) => {
    if (uploadedAssets.length === 0) {
      return
    }

    const uploadedAssetIds = new Set(uploadedAssets.map((asset) => asset.id))
    setAssets((prev) => {
      const remainingAssets = prev.filter((asset) => !uploadedAssetIds.has(asset.id))
      return [...uploadedAssets, ...remainingAssets]
    })
  }, [setAssets])

  const addUploadItem = useCallback((item: DashboardUploadItem) => {
    setUploadItems((prev) => [item, ...prev])
  }, [setUploadItems])

  const updateUploadItem = useCallback((uploadId: string, patch: Partial<DashboardUploadItem>) => {
    setUploadItems((prev) =>
      prev.map((item) => (item.id === uploadId ? { ...item, ...patch } : item))
    )
  }, [setUploadItems])

  const removeUploadItemLater = useCallback((uploadId: string, delayMs: number) => {
    window.setTimeout(() => {
      setUploadItems((prev) => prev.filter((item) => item.id !== uploadId))
    }, delayMs)
  }, [setUploadItems])

  const broadcastAssetChange = useCallback(() => {
    try {
      const channel = new BroadcastChannel('seedance_sync')
      channel.postMessage({ type: 'ASSET_CHANGED' })
      channel.close()
    } catch {
      // BroadcastChannel 不支持时静默失败
    }
  }, [])

  const detectAssetType = useCallback((file: File): AssetType => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    return 'image'
  }, [])

  const requestUploadTarget = useCallback(async (token: string | null, file: File, purpose: 'asset' | 'reference') => {
    const response = await fetch('/api/assets/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        purpose,
        model: purpose === 'reference' ? referenceUploadModel : undefined,
        modelFamily: purpose === 'reference' ? referenceUploadFamily : undefined,
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null
      throw new Error(payload?.error || `获取上传地址失败 (${response.status})`)
    }

    return response.json() as Promise<{
      method: 'PUT' | 'POST'
      uploadUrl: string
      fileUrl: string
      objectKey: string
      headers?: Record<string, string>
      fields?: Record<string, string>
    }>
  }, [referenceUploadFamily, referenceUploadModel])

  const uploadFileToObjectStorage = useCallback(async (file: File, uploadTarget: {
    method: 'PUT' | 'POST'
    uploadUrl: string
    headers?: Record<string, string>
    fields?: Record<string, string>
  }, onProgress?: (progress: number) => void) => {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(uploadTarget.method, uploadTarget.uploadUrl)

      if (uploadTarget.method === 'PUT') {
        for (const [header, value] of Object.entries(uploadTarget.headers || {})) {
          xhr.setRequestHeader(header, value)
        }
      }

      xhr.upload.onprogress = (event) => {
        if (!onProgress || !event.lengthComputable) {
          return
        }
        const progress = Math.min(95, Math.round((event.loaded / event.total) * 95))
        onProgress(progress)
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(95)
          resolve()
          return
        }
        const message = xhr.responseText?.trim()
        reject(new Error(message ? `上传失败: ${xhr.status} ${message}` : `上传失败: ${xhr.status}`))
      }

      xhr.onerror = () => reject(new Error('上传失败: 网络错误'))
      xhr.onabort = () => reject(new Error('上传失败: 已取消'))
      if (uploadTarget.method === 'POST') {
        const formData = new FormData()
        for (const [key, value] of Object.entries(uploadTarget.fields || {})) {
          formData.append(key, value)
        }
        formData.append('file', file, file.name)
        xhr.send(formData)
        return
      }

      xhr.send(file)
    })
  }, [])

  const createAssetRecord = useCallback(async (params: {
    token: string
    file: File
    type: AssetType
    uploadTarget: {
      fileUrl: string
      objectKey: string
    }
    duration?: number
    category?: 'creation' | 'subject'
  }) => {
    const assetResponse = await fetch('/api/assets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify({
        url: params.uploadTarget.fileUrl,
        name: params.file.name,
        type: params.type,
        size: params.file.size,
        contentType: params.file.type,
        objectKey: params.uploadTarget.objectKey,
        category: params.category || 'creation',
        duration: params.duration,
      }),
    })

    if (!assetResponse.ok) {
      throw new Error('写入素材记录失败')
    }

    const data = await assetResponse.json()
    return data.asset as Asset
  }, [])

  const deleteAsset = useCallback(async (assetId: string) => {
    const token = getStoredToken()
    try {
      const response = await fetch(`/api/assets?id=${assetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        setAssets((prev) => prev.filter((asset) => asset.id !== assetId))
        setDeleteConfirmAsset(null)
        setAssetActionMenu(null)
        broadcastAssetChange()
      }
    } catch (error) {
      console.error('Delete asset error:', error)
    }
  }, [broadcastAssetChange, setAssetActionMenu, setAssets, setDeleteConfirmAsset])

  const updateAsset = useCallback(async (assetId: string, updates: Partial<Asset>) => {
    const token = getStoredToken()
    try {
      const response = await fetch('/api/assets', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: assetId, ...updates }),
      })
      if (response.ok) {
        const data = await response.json()
        setAssets((prev) => prev.map((asset) => (asset.id === assetId ? { ...asset, ...data.asset } : asset)))
        setEditingAsset(null)
        setShowAssetDetail(false)
        broadcastAssetChange()
      }
    } catch (error) {
      console.error('Update asset error:', error)
    }
  }, [broadcastAssetChange, setAssets, setEditingAsset, setShowAssetDetail])

  const saveAsSubject = useCallback(async (asset: Asset, subjectType: SubjectType, subjectName: string) => {
    const token = getStoredToken()
    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'saveAsSubject',
          sourceAssetId: asset.id,
          subjectType,
          subjectName,
          name: asset.name,
          type: asset.type,
          url: asset.url,
          size: 0,
          contentType: 'image/png',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        upsertLocalAsset(data.asset)
        alert(`已保存为${subjectType === 'character' ? '人物' : subjectType === 'scene' ? '场景' : '道具'}`)
        broadcastAssetChange()
      } else {
        alert('保存失败')
      }
    } catch {
      alert('网络错误')
    }
  }, [broadcastAssetChange, upsertLocalAsset])

  const handleSaveAsSubject = useCallback(async (asset: Asset, subjectType: SubjectType, subjectName: string) => {
    await saveAsSubject(asset, subjectType, subjectName)
    setSaveAsSubjectAsset(null)
  }, [saveAsSubject, setSaveAsSubjectAsset])

  const getMediaDuration = useCallback((file: File): Promise<number> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.onloadedmetadata = () => {
          resolve(video.duration)
          URL.revokeObjectURL(url)
        }
        video.onerror = () => {
          resolve(0)
          URL.revokeObjectURL(url)
        }
        video.src = url
        return
      }

      if (file.type.startsWith('audio/')) {
        const audio = document.createElement('audio')
        audio.preload = 'metadata'
        audio.onloadedmetadata = () => {
          resolve(audio.duration)
          URL.revokeObjectURL(url)
        }
        audio.onerror = () => {
          resolve(0)
          URL.revokeObjectURL(url)
        }
        audio.src = url
        return
      }

      resolve(0)
      URL.revokeObjectURL(url)
    })
  }, [])

  const uploadSingleAsset = useCallback(async (params: {
    file: File
    type: AssetType
    token: string
    persistToLibrary?: boolean
  }) => {
    const uploadId = createClientId('upload')
    addUploadItem({
      id: uploadId,
      name: params.file.name,
      type: params.type,
      size: params.file.size,
      progress: 0,
      status: 'preparing',
      createdAt: new Date().toISOString(),
    })

    try {
      const [uploadTarget, mediaDuration] = await Promise.all([
        requestUploadTarget(params.token, params.file, params.persistToLibrary === false ? 'reference' : 'asset'),
        params.type === 'video' || params.type === 'audio'
          ? getMediaDuration(params.file)
          : Promise.resolve(undefined),
      ])

      updateUploadItem(uploadId, { status: 'uploading', progress: 1 })
      await uploadFileToObjectStorage(params.file, uploadTarget, (progress) => {
        updateUploadItem(uploadId, { status: 'uploading', progress })
      })

      updateUploadItem(uploadId, { status: 'finalizing', progress: 98 })
      const asset = params.persistToLibrary === false
        ? {
            id: createClientId('temp_ref'),
            name: params.file.name,
            type: params.type,
            url: uploadTarget.fileUrl,
            createdAt: new Date().toISOString(),
            duration: mediaDuration,
            category: 'creation' as const,
          } as Asset
        : await createAssetRecord({
            token: params.token,
            file: params.file,
            type: params.type,
            uploadTarget,
            duration: mediaDuration,
          })

      if (params.persistToLibrary !== false) {
        upsertLocalAsset(asset)
      }
      updateUploadItem(uploadId, { status: 'completed', progress: 100 })
      removeUploadItemLater(uploadId, COMPLETED_UPLOAD_RETENTION_MS)
      return asset
    } catch (error: unknown) {
      updateUploadItem(uploadId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : '上传失败',
      })
      removeUploadItemLater(uploadId, FAILED_UPLOAD_RETENTION_MS)
      return null
    }
  }, [
    addUploadItem,
    createAssetRecord,
    getMediaDuration,
    removeUploadItemLater,
    requestUploadTarget,
    updateUploadItem,
    uploadFileToObjectStorage,
    upsertLocalAsset,
  ])

  const uploadAssetsBatch = useCallback(async (params: {
    files: File[]
    explicitType?: AssetType
    persistToLibrary?: boolean
  }) => {
    const token = getStoredToken()
    if (!token) {
      throw new Error('未登录，无法上传素材')
    }

    const files = params.files
    const results: Array<Asset | null> = new Array(files.length).fill(null)
    let cursor = 0
    const workerCount = Math.min(MAX_CONCURRENT_UPLOADS, files.length)

    const workers = Array.from({ length: workerCount }, async () => {
      while (cursor < files.length) {
        const currentIndex = cursor
        cursor += 1
        const file = files[currentIndex]
        const type = params.explicitType || detectAssetType(file)
        results[currentIndex] = await uploadSingleAsset({
          file,
          type,
          token,
          persistToLibrary: params.persistToLibrary,
        })
      }
    })

    await Promise.all(workers)
    return results.filter(Boolean) as Asset[]
  }, [detectAssetType, uploadSingleAsset])

  const handleReferenceUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>, type: AssetType) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    const selectedFiles = Array.from(files)
    event.target.value = ''

    const uploadedAssets = await uploadAssetsBatch({
      files: selectedFiles,
      explicitType: type,
      persistToLibrary: true,
    })

    if (uploadedAssets.length > 0) {
      placeUploadedAssetsAtFront(uploadedAssets)
      onAssetsUploaded?.(uploadedAssets)

      if (type === 'image') {
        setReferenceImages((prev) => [...prev, ...uploadedAssets])
      } else if (type === 'video') {
        setReferenceVideos((prev) => [...prev, ...uploadedAssets])
      } else {
        setReferenceAudios((prev) => [...prev, ...uploadedAssets])
      }

      broadcastAssetChange()
      setShowAssetPicker(false)
    }
  }, [
    broadcastAssetChange,
    placeUploadedAssetsAtFront,
    onAssetsUploaded,
    setReferenceAudios,
    setReferenceImages,
    setReferenceVideos,
    setShowAssetPicker,
    uploadAssetsBatch,
  ])

  const handleFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    const selectedFiles = Array.from(files)
    event.target.value = ''

    try {
      const uploadedAssets = await uploadAssetsBatch({
        files: selectedFiles,
      })
      if (uploadedAssets.length > 0) {
        placeUploadedAssetsAtFront(uploadedAssets)
        onAssetsUploaded?.(uploadedAssets)
        broadcastAssetChange()
        alert(`上传成功 ${uploadedAssets.length} 个素材`)
      }
    } catch {
      alert('上传失败')
    }
  }, [broadcastAssetChange, onAssetsUploaded, placeUploadedAssetsAtFront, uploadAssetsBatch])

  return {
    broadcastAssetChange,
    deleteAsset,
    updateAsset,
    handleSaveAsSubject,
    handleReferenceUpload,
    handleFileUpload,
  }
}
