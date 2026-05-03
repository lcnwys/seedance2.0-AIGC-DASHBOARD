'use client'

import type { RefObject } from 'react'
import type { DashboardAsset as Asset } from '@/components/dashboard/types'

interface HoverPreviewPortalProps {
  asset: Asset | null
  position: { x: number; y: number }
  audioPreviewRef: RefObject<HTMLAudioElement | null>
  onAudioPlay: (assetId: string | null) => void
  onAudioPause: () => void
}

export function HoverPreviewPortal({
  asset,
  position,
  audioPreviewRef,
  onAudioPlay,
  onAudioPause,
}: HoverPreviewPortalProps) {
  if (!asset) {
    return null
  }

  return (
    <div
      className="fixed z-[9999] glass rounded-xl border border-zinc-700 shadow-2xl shadow-black/50 overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        maxWidth: '300px',
      }}
    >
      {asset.type === 'image' ? (
        <img
          src={asset.url}
          alt={asset.name}
          className="w-full max-h-48 object-contain bg-zinc-900"
        />
      ) : asset.type === 'video' ? (
        <video
          src={asset.url}
          autoPlay
          muted
          loop
          className="w-full max-h-48 object-contain bg-black"
        />
      ) : (
        <div className="p-4 bg-zinc-900">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🎵</span>
            <span className="text-sm text-zinc-300 truncate">{asset.name}</span>
          </div>
          <audio
            ref={audioPreviewRef}
            src={asset.url}
            controls
            className="w-full h-8"
            onPlay={() => onAudioPlay(asset.id)}
            onPause={onAudioPause}
          />
        </div>
      )}
      <div className="px-3 py-2 bg-zinc-800/80 text-xs text-zinc-400 truncate">
        {asset.name}
      </div>
    </div>
  )
}
