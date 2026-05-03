/**
 * Slate 编辑器工厂函数
 */

import { createEditor, Descendant } from 'slate'
import { withReact } from 'slate-react'
import { withHistory } from 'slate-history'
import { withAssetMention } from './with-asset-mention'

/**
 * 创建提示词编辑器实例
 * 
 * 插件加载顺序：
 * 1. withHistory - 支持撤销/重做
 * 2. withReact - React 绑定
 * 3. withAssetMention - 自定义 Void 节点支持
 */
export const createPromptEditor = () => {
  return withAssetMention(
    withHistory(
      withReact(
        createEditor()
      )
    )
  )
}

/**
 * 初始空文档
 */
export const initialEditorValue: Descendant[] = [
  {
    type: 'paragraph',
    children: [{ text: '' }],
  },
]
