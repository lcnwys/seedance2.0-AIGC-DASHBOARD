/**
 * Slate.js 自定义类型定义
 * 
 * 用于提示词编辑器的富文本支持
 */

import { BaseEditor, Descendant } from 'slate'
import { ReactEditor } from 'slate-react'
import { HistoryEditor } from 'slate-history'

// ============================================
// 自定义节点类型定义
// ============================================

/** 资产类型 */
export type AssetType = 'image' | 'video' | 'audio'

/** 
 * @mention Void 节点 - 不可编辑的资产引用块
 * 
 * 设计原则：
 * - 作为 Void Element，Slate 不会尝试编辑其内部
 * - 所有数据存储在节点属性中，渲染由 React 组件负责
 */
export interface AssetMentionElement {
  type: 'asset-mention'
  assetType: AssetType
  assetUrl: string
  assetLabel: string  // 显示文本，如 "图片1"
  assetName?: string  // 原始文件名
  children: [{ text: '' }]  // Void 节点必须有空 children
}

/** 段落节点 */
export interface ParagraphElement {
  type: 'paragraph'
  children: Descendant[]
}

/** 纯文本叶子节点 */
export interface CustomText {
  text: string
  // 可扩展：bold?: boolean, italic?: boolean 等
}

/** 所有元素类型的联合 */
export type CustomElement = ParagraphElement | AssetMentionElement

// ============================================
// 扩展 Slate 类型声明
// ============================================

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor
    Element: CustomElement
    Text: CustomText
  }
}

// ============================================
// 类型守卫函数
// ============================================

export const isAssetMentionElement = (element: any): element is AssetMentionElement => {
  return element?.type === 'asset-mention'
}

export const isParagraphElement = (element: any): element is ParagraphElement => {
  return element?.type === 'paragraph'
}

// ============================================
// API Payload 类型
// ============================================

export interface PromptApiPayload {
  prompt: string
  reference_image_urls: string[]
  reference_video_urls: string[]
  reference_audio_urls: string[]
}
