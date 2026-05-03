'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { DashboardAsset } from '@/components/dashboard/types'
import type { ImageEditBBox } from '@/lib/modules/image/types'

const MAX_BOXES = 2
const MIN_BOX_SIZE = 12

function cloneBoxes(boxes: ImageEditBBox[]) {
  return boxes.map((box) => [...box] as ImageEditBBox)
}

function rectFromPoints(start: { x: number; y: number }, end: { x: number; y: number }): ImageEditBBox {
  return [
    Math.min(start.x, end.x),
    Math.min(start.y, end.y),
    Math.max(start.x, end.x),
    Math.max(start.y, end.y),
  ]
}

export function ImageBboxEditorModal(props: {
  isOpen: boolean
  asset: DashboardAsset | null
  initialBoxes: ImageEditBBox[]
  onClose: () => void
  onSave: (assetId: string, boxes: ImageEditBBox[]) => void
}) {
  const { isOpen, asset, initialBoxes, onClose, onSave } = props
  const imageRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [boxes, setBoxes] = useState<ImageEditBBox[]>([])
  const [history, setHistory] = useState<ImageEditBBox[][]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [draftBox, setDraftBox] = useState<ImageEditBBox | null>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setBoxes(cloneBoxes(initialBoxes))
    setHistory([])
    setSelectedIndex(null)
    setDraftBox(null)
  }, [initialBoxes, isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const syncDisplaySize = () => {
    if (!imageRef.current) {
      return
    }

    setDisplaySize({
      width: imageRef.current.clientWidth,
      height: imageRef.current.clientHeight,
    })
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleResize = () => syncDisplaySize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

  const renderBoxes = useMemo(() => {
    if (naturalSize.width <= 0 || naturalSize.height <= 0 || displaySize.width <= 0 || displaySize.height <= 0) {
      return []
    }

    const scaleX = displaySize.width / naturalSize.width
    const scaleY = displaySize.height / naturalSize.height

    return boxes.map((box, index) => ({
      index,
      left: box[0] * scaleX,
      top: box[1] * scaleY,
      width: (box[2] - box[0]) * scaleX,
      height: (box[3] - box[1]) * scaleY,
    }))
  }, [boxes, displaySize.height, displaySize.width, naturalSize.height, naturalSize.width])

  const renderedDraftBox = useMemo(() => {
    if (!draftBox || naturalSize.width <= 0 || naturalSize.height <= 0 || displaySize.width <= 0 || displaySize.height <= 0) {
      return null
    }

    const scaleX = displaySize.width / naturalSize.width
    const scaleY = displaySize.height / naturalSize.height

    return {
      left: draftBox[0] * scaleX,
      top: draftBox[1] * scaleY,
      width: (draftBox[2] - draftBox[0]) * scaleX,
      height: (draftBox[3] - draftBox[1]) * scaleY,
    }
  }, [displaySize.height, displaySize.width, draftBox, naturalSize.height, naturalSize.width])

  const pushHistory = (nextBoxes: ImageEditBBox[]) => {
    setHistory((previous) => [...previous, cloneBoxes(boxes)])
    setBoxes(nextBoxes)
  }

  const getNaturalPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || naturalSize.width <= 0 || naturalSize.height <= 0) {
      return null
    }

    const x = ((clientX - rect.left) / rect.width) * naturalSize.width
    const y = ((clientY - rect.top) / rect.height) * naturalSize.height

    return {
      x: Math.min(Math.max(0, x), naturalSize.width),
      y: Math.min(Math.max(0, y), naturalSize.height),
    }
  }

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }

    if (boxes.length >= MAX_BOXES) {
      setSelectedIndex(null)
      return
    }

    const point = getNaturalPoint(event.clientX, event.clientY)
    if (!point) {
      return
    }

    drawStartRef.current = point
    setSelectedIndex(null)
    setDraftBox([point.x, point.y, point.x, point.y])
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawStartRef.current) {
      return
    }

    const point = getNaturalPoint(event.clientX, event.clientY)
    if (!point) {
      return
    }

    setDraftBox(rectFromPoints(drawStartRef.current, point))
  }

  const handleCanvasPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawStartRef.current || !draftBox) {
      return
    }

    event.currentTarget.releasePointerCapture(event.pointerId)
    drawStartRef.current = null

    const nextBox = draftBox
    setDraftBox(null)

    if ((nextBox[2] - nextBox[0]) < MIN_BOX_SIZE || (nextBox[3] - nextBox[1]) < MIN_BOX_SIZE) {
      return
    }

    const nextBoxes = [...boxes, nextBox]
    pushHistory(nextBoxes)
    setSelectedIndex(nextBoxes.length - 1)
  }

  const handleUndo = () => {
    if (history.length === 0) {
      return
    }

    const previousBoxes = history[history.length - 1]
    setHistory((current) => current.slice(0, -1))
    setBoxes(previousBoxes)
    setSelectedIndex(previousBoxes.length > 0 ? previousBoxes.length - 1 : null)
  }

  const handleDeleteSelected = () => {
    if (selectedIndex === null) {
      return
    }

    const nextBoxes = boxes.filter((_, index) => index !== selectedIndex)
    pushHistory(nextBoxes)
    setSelectedIndex(nextBoxes.length > 0 ? Math.min(selectedIndex, nextBoxes.length - 1) : null)
  }

  const handleClear = () => {
    if (boxes.length === 0) {
      return
    }

    pushHistory([])
    setSelectedIndex(null)
  }

  const handleSave = () => {
    if (!asset) {
      return
    }

    onSave(asset.id, boxes)
    onClose()
  }

  if (!isOpen || !asset) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-[#101010] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 md:px-6">
          <div>
            <div className="text-lg font-medium text-zinc-100">框选改图</div>
            <div className="mt-1 text-sm text-zinc-500">
              在图片上拖动画框，最多 {MAX_BOXES} 个区域。当前已设置 {boxes.length} 个区域。
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
          >
            关闭
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto px-5 py-5 md:grid-cols-[minmax(0,1fr)_260px] md:px-6">
          <div className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
            <div ref={canvasRef} className="relative inline-block select-none">
              <img
                ref={imageRef}
                src={asset.url}
                alt={asset.name}
                className="max-h-[70vh] max-w-full rounded-2xl object-contain"
                onLoad={(event) => {
                  setNaturalSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                  requestAnimationFrame(() => syncDisplaySize())
                }}
                draggable={false}
              />

              <div
                className="absolute inset-0 cursor-crosshair rounded-2xl"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
              >
                {renderBoxes.map((box) => (
                  <button
                    key={`${box.index}-${box.left}-${box.top}`}
                    type="button"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      setSelectedIndex(box.index)
                    }}
                    className={`absolute border-2 transition-all ${
                      selectedIndex === box.index
                        ? 'border-amber-300 bg-amber-300/15'
                        : 'border-emerald-400 bg-emerald-400/15'
                    }`}
                    style={{
                      left: `${box.left}px`,
                      top: `${box.top}px`,
                      width: `${box.width}px`,
                      height: `${box.height}px`,
                    }}
                  >
                    <span className={`absolute -left-1.5 -top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      selectedIndex === box.index
                        ? 'bg-amber-300 text-zinc-950'
                        : 'bg-emerald-400 text-zinc-950'
                    }`}>
                      {box.index + 1}
                    </span>
                  </button>
                ))}

                {renderedDraftBox ? (
                  <div
                    className="absolute border-2 border-cyan-300 bg-cyan-300/15"
                    style={{
                      left: `${renderedDraftBox.left}px`,
                      top: `${renderedDraftBox.top}px`,
                      width: `${renderedDraftBox.width}px`,
                      height: `${renderedDraftBox.height}px`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-sm font-medium text-zinc-100">操作提示</div>
              <div className="mt-3 space-y-2 text-sm text-zinc-500">
                <p>1. 在图片空白区域按住并拖动鼠标即可画框。</p>
                <p>2. 点击已有框可选中，再执行删除。</p>
                <p>3. 每张参考图最多保留 2 个框选区域。</p>
                <p>4. 坐标会自动换算成原图尺寸后提交给 Wan 2.7。</p>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  撤销上一步
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedIndex === null}
                  className="rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-300 transition hover:border-red-400/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  删除选中框
                </button>
                <button
                  onClick={handleClear}
                  disabled={boxes.length === 0}
                  className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  清空重画
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-500">
                {boxes.length >= MAX_BOXES
                  ? '已达到当前版本的 2 个框选上限，如需重画请先删除或清空。'
                  : '还可以继续新增框选区域。'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-5 py-4 md:px-6">
          <div className="text-xs text-zinc-500">
            当前图片：{asset.name}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:from-emerald-500 hover:to-cyan-500"
            >
              保存框选
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
