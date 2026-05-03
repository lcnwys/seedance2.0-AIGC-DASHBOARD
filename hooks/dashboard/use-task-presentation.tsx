'use client'

import { useCallback } from 'react'
import { HoverMediaPreview } from '@/components/HoverMediaPreview'
import type { DashboardAsset as Asset, DashboardTask as Task } from '@/components/dashboard/types'

interface HoverPreview {
  asset: Asset | null
  position: { x: number; y: number }
}

export function useTaskPresentation({
  setHoverPreview,
}: {
  setHoverPreview: React.Dispatch<React.SetStateAction<HoverPreview>>
}) {
  const formatTokens = useCallback((tokens: number | string) => {
    const tokenNum = typeof tokens === 'string' ? parseInt(tokens) : tokens
    if (tokenNum >= 1_000_000) {
      return `${(tokenNum / 1_000_000).toFixed(2)}M`
    }
    if (tokenNum >= 1_000) {
      return `${(tokenNum / 1_000).toFixed(1)}K`
    }
    return tokenNum.toString()
  }, [])

  const getModeLabel = useCallback((mode: string) => {
    const labels: Record<string, string> = {
      text_to_video: '文生视频',
      text_to_image: '文生图',
      image_to_image: '参考生图',
      first_frame: '首帧生成',
      first_last_frame: '首尾帧',
      first_clip: '视频续写',
      reference: '参考生成',
      video_edit: '视频编辑',
      video_extend: '参考生成',
    }
    return labels[mode] || mode
  }, [])

  const formatGenerationTime = useCallback((seconds: number | undefined) => {
    if (!seconds) return null
    if (seconds < 60) {
      return `${seconds}秒`
    }
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`
    }

    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`
  }, [])

  const renderPromptWithRefs = useCallback((task: Task) => {
    const parts: React.ReactNode[] = []

    if (task.promptAst && Array.isArray(task.promptAst) && task.promptAst.length > 0) {
      let nodeIndex = 0

      const renderNode = (node: any) => {
        if (node.type === 'asset-mention') {
          const { assetType, assetUrl, assetLabel } = node

          if (assetType === 'video' || assetType === 'audio') {
            parts.push(
              <HoverMediaPreview
                key={`mention-${nodeIndex++}`}
                type={assetType}
                url={assetUrl}
                name={`@${assetLabel}`}
                hoverDelay={500}
                className="mx-0.5"
              />
            )
          } else {
            parts.push(
              <span
                key={`mention-${nodeIndex++}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-emerald-500/20 border-emerald-500/40 cursor-pointer mx-0.5"
                onMouseEnter={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  setHoverPreview({
                    asset: { id: '', name: assetLabel, type: assetType, url: assetUrl, category: 'creation' as const },
                    position: { x: rect.left, y: rect.bottom + 8 },
                  })
                }}
                onMouseLeave={() => setHoverPreview({ asset: null, position: { x: 0, y: 0 } })}
              >
                <span className="w-4 h-4 rounded overflow-hidden shrink-0">
                  <img src={assetUrl} className="w-full h-full object-cover" />
                </span>
                <span className="text-xs font-medium text-emerald-300">@{assetLabel}</span>
              </span>
            )
          }
          return
        }

        if (node.text !== undefined) {
          if (node.text) {
            parts.push(<span key={`text-${nodeIndex++}`}>{node.text}</span>)
          }
          return
        }

        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(renderNode)
        }
      }

      task.promptAst.forEach(renderNode)
      return parts.length > 0 ? parts : task.prompt || ''
    }

    const text = task.prompt || ''
    const assets = task.referenceAssets || []
    const regex = /@([\u4e00-\u9fa5a-zA-Z][\u4e00-\u9fa5a-zA-Z0-9._-]*)/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>)
      }

      const refLabel = match[1]
      const matchedAsset = assets.find((asset) => {
        const assetName = asset.name.replace(/\.[^.]+$/, '')
        return (
          asset.name === refLabel ||
          assetName === refLabel ||
          asset.name.includes(refLabel) ||
          (refLabel.startsWith('图片') && asset.type === 'image') ||
          (refLabel.startsWith('视频') && asset.type === 'video') ||
          (refLabel.startsWith('音频') && asset.type === 'audio')
        )
      })

      if (matchedAsset) {
        if (matchedAsset.type === 'video' || matchedAsset.type === 'audio') {
          parts.push(
            <HoverMediaPreview
              key={`ref-${match.index}`}
              type={matchedAsset.type}
              url={matchedAsset.url}
              name={`@${refLabel}`}
              hoverDelay={500}
              className="mx-0.5"
            />
          )
        } else {
          parts.push(
            <span
              key={`ref-${match.index}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-emerald-500/20 border-emerald-500/40 cursor-pointer mx-0.5"
              onMouseEnter={(event) => {
                const rect = event.currentTarget.getBoundingClientRect()
                setHoverPreview({
                  asset: matchedAsset,
                  position: { x: rect.left, y: rect.bottom + 8 },
                })
              }}
              onMouseLeave={() => setHoverPreview({ asset: null, position: { x: 0, y: 0 } })}
            >
              <span className="w-4 h-4 rounded overflow-hidden shrink-0">
                <img src={matchedAsset.url} className="w-full h-full object-cover" />
              </span>
              <span className="text-xs font-medium text-emerald-300">@{refLabel}</span>
            </span>
          )
        }
      } else {
        parts.push(
          <span key={`ref-${match.index}`} className="text-zinc-500">
            @{refLabel}
          </span>
        )
      }

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>)
    }

    return parts.length > 0 ? parts : text
  }, [setHoverPreview])

  return {
    formatTokens,
    getModeLabel,
    formatGenerationTime,
    renderPromptWithRefs,
  }
}
