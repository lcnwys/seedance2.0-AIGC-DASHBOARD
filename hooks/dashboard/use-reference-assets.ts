'use client'

import { useCallback } from 'react'
import type { DragEvent } from 'react'
import type { DashboardAsset as Asset } from '@/components/dashboard/types'

type AssetPickerMode = 'image' | 'video' | 'audio'
type ReferenceAssetType = 'image' | 'video' | 'audio'

export function useReferenceAssets({
  assetPickerMode,
  selectedPickerAssets,
  referenceImages,
  referenceVideos,
  referenceAudios,
  draggedItem,
  setSelectedPickerAssets,
  setShowAssetPicker,
  setReferenceImages,
  setReferenceVideos,
  setReferenceAudios,
  setDraggedItem,
  maxImageReferences,
  maxVideoReferences,
}: {
  assetPickerMode: AssetPickerMode
  selectedPickerAssets: Asset[]
  referenceImages: Asset[]
  referenceVideos: Asset[]
  referenceAudios: Asset[]
  draggedItem: { type: ReferenceAssetType; index: number } | null
  setSelectedPickerAssets: React.Dispatch<React.SetStateAction<Asset[]>>
  setShowAssetPicker: React.Dispatch<React.SetStateAction<boolean>>
  setReferenceImages: React.Dispatch<React.SetStateAction<Asset[]>>
  setReferenceVideos: React.Dispatch<React.SetStateAction<Asset[]>>
  setReferenceAudios: React.Dispatch<React.SetStateAction<Asset[]>>
  setDraggedItem: React.Dispatch<React.SetStateAction<{ type: ReferenceAssetType; index: number } | null>>
  maxImageReferences?: number | null
  maxVideoReferences?: number | null
}) {
  const addSelectedReferences = useCallback(() => {
    if (selectedPickerAssets.length === 0) return

    if (assetPickerMode === 'image') {
      const newAssets = selectedPickerAssets.filter((asset) => !referenceImages.find((item) => item.id === asset.id))
      if (typeof maxImageReferences === 'number') {
        const remainingSlots = Math.max(0, maxImageReferences - referenceImages.length)
        const acceptedAssets = newAssets.slice(0, remainingSlots)
        if (acceptedAssets.length > 0) {
          setReferenceImages([...referenceImages, ...acceptedAssets])
        }
        if (newAssets.length > acceptedAssets.length) {
          window.alert(`当前模型最多支持 ${maxImageReferences} 张参考图片`)
        }
      } else {
        setReferenceImages([...referenceImages, ...newAssets])
      }
    } else if (assetPickerMode === 'video') {
      const newAssets = selectedPickerAssets.filter((asset) => !referenceVideos.find((item) => item.id === asset.id))
      if (typeof maxVideoReferences === 'number') {
        const remainingSlots = Math.max(0, maxVideoReferences - referenceVideos.length)
        const acceptedAssets = newAssets.slice(0, remainingSlots)
        if (acceptedAssets.length > 0) {
          setReferenceVideos([...referenceVideos, ...acceptedAssets])
        }
        if (newAssets.length > acceptedAssets.length) {
          window.alert(`当前模式最多支持 ${maxVideoReferences} 条参考视频`)
        }
      } else {
        setReferenceVideos([...referenceVideos, ...newAssets])
      }
    } else {
      const newAssets = selectedPickerAssets.filter((asset) => !referenceAudios.find((item) => item.id === asset.id))
      setReferenceAudios([...referenceAudios, ...newAssets])
    }

    setSelectedPickerAssets([])
    setShowAssetPicker(false)
  }, [
    assetPickerMode,
    referenceAudios,
    referenceImages,
    referenceVideos,
    selectedPickerAssets,
    setReferenceAudios,
    setReferenceImages,
    setReferenceVideos,
    setSelectedPickerAssets,
    setShowAssetPicker,
    maxImageReferences,
    maxVideoReferences,
  ])

  const togglePickerAsset = useCallback((asset: Asset) => {
    if (selectedPickerAssets.find((item) => item.id === asset.id)) {
      setSelectedPickerAssets(selectedPickerAssets.filter((item) => item.id !== asset.id))
    } else {
      setSelectedPickerAssets([...selectedPickerAssets, asset])
    }
  }, [selectedPickerAssets, setSelectedPickerAssets])

  const removeReference = useCallback((type: ReferenceAssetType, id: string) => {
    if (type === 'image') {
      setReferenceImages(referenceImages.filter((asset) => asset.id !== id))
    } else if (type === 'video') {
      setReferenceVideos(referenceVideos.filter((asset) => asset.id !== id))
    } else {
      setReferenceAudios(referenceAudios.filter((asset) => asset.id !== id))
    }
  }, [referenceAudios, referenceImages, referenceVideos, setReferenceAudios, setReferenceImages, setReferenceVideos])

  const handleDragStart = useCallback((type: ReferenceAssetType, index: number) => {
    setDraggedItem({ type, index })
  }, [setDraggedItem])

  const handleDragOver = useCallback((event: DragEvent, type: ReferenceAssetType, index: number) => {
    event.preventDefault()
    if (!draggedItem || draggedItem.type !== type) return

    if (draggedItem.index !== index) {
      const items = type === 'image'
        ? [...referenceImages]
        : type === 'video'
          ? [...referenceVideos]
          : [...referenceAudios]

      const [draggedElement] = items.splice(draggedItem.index, 1)
      items.splice(index, 0, draggedElement)

      if (type === 'image') {
        setReferenceImages(items)
      } else if (type === 'video') {
        setReferenceVideos(items)
      } else {
        setReferenceAudios(items)
      }

      setDraggedItem({ type, index })
    }
  }, [
    draggedItem,
    referenceAudios,
    referenceImages,
    referenceVideos,
    setDraggedItem,
    setReferenceAudios,
    setReferenceImages,
    setReferenceVideos,
  ])

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null)
  }, [setDraggedItem])

  return {
    addSelectedReferences,
    togglePickerAsset,
    removeReference,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  }
}
