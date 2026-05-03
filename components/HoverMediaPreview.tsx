'use client'

import React, { useState, useRef, useCallback } from 'react'

interface HoverMediaPreviewProps {
  /** 媒体类型 */
  type: 'video' | 'audio'
  /** 媒体 URL */
  url: string
  /** 显示名称 */
  name: string
  /** 悬停延迟时间（ms），默认 500ms */
  hoverDelay?: number
  /** 自定义类名 */
  className?: string
}

/**
 * HoverMediaPreview - 带意图防抖的媒体预览组件
 * 
 * 核心逻辑：
 * 1. 默认只显示图标+文件名，不渲染媒体标签
 * 2. 鼠标悬停超过 500ms 才挂载媒体标签并自动播放
 * 3. 鼠标移出立即卸载媒体标签，释放带宽和内存
 */
export const HoverMediaPreview: React.FC<HoverMediaPreviewProps> = ({
  type,
  url,
  name,
  hoverDelay = 500,
  className = '',
}) => {
  // 是否激活媒体加载
  const [isActive, setIsActive] = useState(false)
  // 防抖定时器
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 鼠标进入：启动防抖计时
  const handleMouseEnter = useCallback(() => {
    // 清除可能存在的旧定时器
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
    }
    // 延迟激活
    hoverTimerRef.current = setTimeout(() => {
      setIsActive(true)
    }, hoverDelay)
  }, [hoverDelay])

  // 鼠标离开：立即清理
  const handleMouseLeave = useCallback(() => {
    // 清除防抖定时器
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    // 立即卸载媒体
    setIsActive(false)
  }, [])

  // 图标
  const icon = type === 'video' ? '🎬' : '🎵'
  
  // 背景色
  const bgColor = type === 'video' 
    ? 'bg-blue-500/20 border-blue-500/40' 
    : 'bg-purple-500/20 border-purple-500/40'
  
  const textColor = type === 'video' ? 'text-blue-300' : 'text-purple-300'

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 px-2 py-1 rounded border ${bgColor} cursor-pointer transition-all ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 默认态：视频显示首帧缩略图，音频显示图标 */}
      {type === 'video' ? (
        <span className="w-5 h-5 rounded overflow-hidden shrink-0 bg-zinc-800">
          <video
            src={url}
            preload="metadata"
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </span>
      ) : (
        <span className="text-sm">{icon}</span>
      )}
      <span className={`text-xs font-medium ${textColor} truncate max-w-[120px]`}>
        {name}
      </span>

      {/* 激活后的媒体预览浮层 */}
      {isActive && (
        <div 
          className="absolute left-0 top-full mt-2 z-[9999] bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden"
          style={{ minWidth: '200px', maxWidth: '300px' }}
        >
          {type === 'video' ? (
            <video
              src={url}
              autoPlay
              muted
              loop
              playsInline
              className="w-full max-h-40 object-contain bg-black"
            />
          ) : (
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🎵</span>
                <span className="text-xs text-zinc-300 truncate">{name}</span>
              </div>
              <audio
                src={url}
                autoPlay
                controls
                className="w-full h-8"
              />
            </div>
          )}
          <div className="px-2 py-1.5 bg-zinc-800/80 text-xs text-zinc-400 truncate">
            {name}
          </div>
        </div>
      )}
    </div>
  )
}

export default HoverMediaPreview
