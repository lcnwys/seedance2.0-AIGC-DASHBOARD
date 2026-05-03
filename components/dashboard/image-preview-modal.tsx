'use client'

import { useEffect, useState } from 'react'

type ImagePreviewModalProps = {
  open: boolean
  imageUrl: string | null
  imageName?: string | null
  onClose: () => void
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function ImagePreviewModal({
  open,
  imageUrl,
  imageName,
  onClose,
}: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!open) {
      setZoom(1)
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open || !imageUrl) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-zinc-100">{imageName || '图片预览'}</div>
            <div className="mt-1 text-xs text-zinc-500">基于适应窗口大小缩放 {Math.round(zoom * 100)}%</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((current) => clampZoom(current - ZOOM_STEP))}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
            >
              缩小
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
            >
              重置
            </button>
            <button
              type="button"
              onClick={() => setZoom((current) => clampZoom(current + ZOOM_STEP))}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
            >
              放大
            </button>
            <a
              href={imageUrl}
              download={imageName || 'image'}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              下载
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
            >
              关闭
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_55%)]">
          <div className="flex min-h-full min-w-full items-center justify-center p-6">
            <img
              src={imageUrl}
              alt={imageName || '图片预览'}
              className="max-h-[calc(92vh-120px)] max-w-full rounded-2xl object-contain shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition-transform duration-200"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
