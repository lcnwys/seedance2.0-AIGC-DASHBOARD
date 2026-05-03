/**
 * Slate 自定义插件：支持 AssetMention Void 节点
 * 
 * 关键功能：
 * 1. 将 asset-mention 标记为 Void（不可编辑）
 * 2. 将 asset-mention 标记为 Inline（行内元素）
 */

import { Editor, Element as SlateElement } from 'slate'
import { isAssetMentionElement } from '@/types/slate-types'

export const withAssetMention = <T extends Editor>(editor: T): T => {
  const { isVoid, isInline } = editor

  // asset-mention 是 Void 节点（内部不可编辑）
  editor.isVoid = (element: SlateElement) => {
    return isAssetMentionElement(element) ? true : isVoid(element)
  }

  // asset-mention 是 Inline 节点（行内显示，不独占一行）
  editor.isInline = (element: SlateElement) => {
    return isAssetMentionElement(element) ? true : isInline(element)
  }

  return editor
}
