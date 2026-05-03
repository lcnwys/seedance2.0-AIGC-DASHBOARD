'use client'

/**
 * 提示词编辑器组件
 * 
 * 基于 Slate.js 实现，支持 @mention 资产引用
 */

import React, { 
  useCallback, 
  useMemo, 
  useState, 
  useRef, 
  useEffect,
  KeyboardEvent 
} from 'react'
import { createPortal } from 'react-dom'
import { 
  Slate, 
  Editable, 
  withReact, 
  ReactEditor,
  RenderElementProps,
  RenderLeafProps,
} from 'slate-react'
import { 
  Editor, 
  Transforms, 
  Range, 
  createEditor,
  Descendant,
  Element as SlateElement,
  Node,
  Text,
  Point,
} from 'slate'
import { withHistory } from 'slate-history'
import { 
  AssetMentionElement, 
  AssetType, 
  isAssetMentionElement,
  CustomElement,
} from '@/types/slate-types'
import { withAssetMention } from '@/lib/slate/with-asset-mention'
import { initialEditorValue } from '@/lib/slate/create-editor'

// ============================================
// 类型定义
// ============================================

export interface Asset {
  id: string
  name: string
  type: 'image' | 'video' | 'audio'
  url: string
  subjectName?: string
}

interface PromptEditorProps {
  /** 可用资产列表 */
  assets: Asset[]
  /** 编辑器值变更回调 */
  onChange?: (value: Descendant[]) => void
  /** 初始值 */
  initialValue?: Descendant[]
  /** 占位文本 */
  placeholder?: string
  /** 编辑器引用 */
  editorRef?: React.MutableRefObject<Editor | null>
}

// ============================================
// Mention 胶囊组件
// ============================================

interface MentionElementProps {
  attributes: any
  children: React.ReactNode
  element: AssetMentionElement
}

const MentionElement: React.FC<MentionElementProps> = ({ 
  attributes, 
  children, 
  element 
}) => {
  const typeColors = {
    image: {
      bg: 'bg-emerald-500/20',
      border: 'border-emerald-500/40',
      text: 'text-emerald-300',
      iconBg: 'bg-emerald-900/50',
      iconColor: 'text-emerald-400',
    },
    video: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/40',
      text: 'text-blue-300',
      iconBg: 'bg-blue-900/50',
      iconColor: 'text-blue-400',
    },
    audio: {
      bg: 'bg-purple-500/20',
      border: 'border-purple-500/40',
      text: 'text-purple-300',
      iconBg: 'bg-purple-900/50',
      iconColor: 'text-purple-400',
    },
  }
  
  const colors = typeColors[element.assetType]
  
  return (
    <span
      {...attributes}
      contentEditable={false}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border mx-0.5 cursor-default select-none ${colors.bg} ${colors.border}`}
    >
      {/* 缩略图 */}
      <span className="w-4 h-4 rounded overflow-hidden shrink-0 inline-block">
        {element.assetType === 'image' && element.assetUrl ? (
          <img src={element.assetUrl} className="w-full h-full object-cover" alt="" />
        ) : element.assetType === 'video' && element.assetUrl ? (
          <video src={element.assetUrl} className="w-full h-full object-cover" />
        ) : (
          <span className={`w-full h-full ${colors.iconBg} flex items-center justify-center`}>
            {element.assetType === 'audio' ? (
              <svg className={`w-2.5 h-2.5 ${colors.iconColor}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            ) : element.assetType === 'video' ? (
              <svg className={`w-2.5 h-2.5 ${colors.iconColor}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            ) : (
              <svg className={`w-2.5 h-2.5 ${colors.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            )}
          </span>
        )}
      </span>
      {/* 标签 */}
      <span className={`text-xs font-medium ${colors.text}`}>
        @{element.assetLabel}
      </span>
      {children}
    </span>
  )
}

// ============================================
// 素材选择浮窗
// ============================================

interface AssetPickerProps {
  assets: Asset[]
  search: string
  selectedIndex: number
  position: { top: number; left: number } | null
  show: boolean  // 新增：显示状态
  onSelect: (asset: Asset) => void
  onClose: () => void
}

const AssetPicker: React.FC<AssetPickerProps> = ({
  assets,
  search,
  selectedIndex,
  position,
  show,
  onSelect,
  onClose,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  
  // 客户端挂载检测（Portal 需要）
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // 键盘上下选择时自动滚动到选中项
  useEffect(() => {
    if (scrollContainerRef.current && show) {
      const container = scrollContainerRef.current
      const selectedItem = container.children[selectedIndex] as HTMLElement
      if (selectedItem) {
        const containerRect = container.getBoundingClientRect()
        const itemRect = selectedItem.getBoundingClientRect()
        
        // 如果选中项在容器下方不可见
        if (itemRect.bottom > containerRect.bottom) {
          container.scrollTop += itemRect.bottom - containerRect.bottom
        }
        // 如果选中项在容器上方不可见
        if (itemRect.top < containerRect.top) {
          container.scrollTop -= containerRect.top - itemRect.top
        }
      }
    }
  }, [selectedIndex, show])
  
  // 不显示的条件：未挂载、未开启、无位置、无素材
  if (!mounted || !show || !position || assets.length === 0) return null
  
  const filteredAssets = assets.filter(asset => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      asset.name.toLowerCase().includes(searchLower) ||
      (asset.subjectName && asset.subjectName.toLowerCase().includes(searchLower)) ||
      asset.type.includes(searchLower)
    )
  })
  
  if (filteredAssets.length === 0) return null
  
  // 使用 Portal 渲染到 body，避免被父元素遮挡
  return createPortal(
    <div
      ref={scrollContainerRef}
      className="fixed z-[9999] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl max-h-48 overflow-auto"
      style={{ top: position.top, left: position.left, minWidth: 220 }}
    >
      {filteredAssets.map((asset, index) => (
        <div
          key={asset.id}
          className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
            index === selectedIndex ? 'bg-blue-600/30' : 'hover:bg-zinc-800'
          }`}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(asset)
          }}
        >
          {/* 缩略图 */}
          <div className="w-8 h-8 rounded overflow-hidden bg-zinc-800 shrink-0">
            {asset.type === 'image' ? (
              <img src={asset.url} className="w-full h-full object-cover" alt="" />
            ) : asset.type === 'video' ? (
              <video src={asset.url} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-purple-900/50 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
            )}
          </div>
          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-zinc-200 truncate">
              {asset.subjectName || asset.name}
            </div>
            <div className="text-xs text-zinc-500">
              {asset.type === 'image' ? '图片' : asset.type === 'video' ? '视频' : '音频'}
            </div>
          </div>
        </div>
      ))}
    </div>,
    document.body
  )
}

// ============================================
// 主编辑器组件
// ============================================

export const PromptEditor: React.FC<PromptEditorProps> = ({
  assets,
  onChange,
  initialValue,
  placeholder = '描述视频内容，使用 @ 引用素材...',
  editorRef,
}) => {
  // 创建编辑器实例（仅在客户端）
  const editor = useMemo(() => {
    return withAssetMention(withHistory(withReact(createEditor())))
  }, [])
  
  // 暴露编辑器引用
  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor
    }
  }, [editor, editorRef])
  
  // 状态
  const [value, setValue] = useState<Descendant[]>(initialValue || initialEditorValue)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [target, setTarget] = useState<Range | null>(null)
  
  // 过滤后的资产
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      if (!pickerSearch) return true
      const searchLower = pickerSearch.toLowerCase()
      return (
        asset.name.toLowerCase().includes(searchLower) ||
        (asset.subjectName && asset.subjectName.toLowerCase().includes(searchLower)) ||
        asset.type.includes(searchLower)
      )
    })
  }, [assets, pickerSearch])
  
  // URL → 标签的映射（用于复用已有标签）
  const urlToLabelMap = useRef<Map<string, string>>(new Map())
  
  // 计数器（用于生成新标签）
  const labelCounters = useRef({
    image: 0,
    video: 0,
    audio: 0,
  })
  
  // 插入 mention 节点
  const insertMention = useCallback((asset: Asset) => {
    if (!target) return
    
    // 参考区的当前编号优先作为真实标签，其次才回退到本地分配
    let label = asset.subjectName?.trim() || urlToLabelMap.current.get(asset.url)

    if (!label) {
      labelCounters.current[asset.type]++
      const typeLabel = asset.type === 'image' ? '图片' : asset.type === 'video' ? '视频' : '音频'
      label = `${typeLabel}${labelCounters.current[asset.type]}`
    }

    urlToLabelMap.current.set(asset.url, label)
    
    // 创建 mention 节点
    const mention: AssetMentionElement = {
      type: 'asset-mention',
      assetType: asset.type,
      assetUrl: asset.url,
      assetLabel: label,
      assetName: asset.name,
      children: [{ text: '' }],
    }
    
    // 选中 @ 范围并删除
    Transforms.select(editor, target)
    Transforms.delete(editor)
    
    // 插入 mention
    Transforms.insertNodes(editor, mention)
    
    // 移动光标到 mention 之后
    Transforms.move(editor)
    
    // 关闭选择器
    setShowPicker(false)
    setTarget(null)
    setPickerSearch('')
    setSelectedIndex(0)
    
    // 聚焦编辑器
    ReactEditor.focus(editor)
  }, [editor, target])
  
  // 处理值变更
  const handleChange = useCallback((newValue: Descendant[]) => {
    setValue(newValue)
    onChange?.(newValue)
    
    // 检测 @ 触发
    const { selection } = editor
    if (selection && Range.isCollapsed(selection)) {
      const [start] = Range.edges(selection)
      const wordBefore = Editor.before(editor, start, { unit: 'word' })
      const before = wordBefore && Editor.before(editor, wordBefore)
      const beforeRange = before && Editor.range(editor, before, start)
      const beforeText = beforeRange && Editor.string(editor, beforeRange)
      
      // 检查是否刚输入了 @
      const charBefore = Editor.before(editor, start, { unit: 'character' })
      const charRange = charBefore && Editor.range(editor, charBefore, start)
      const charText = charRange && Editor.string(editor, charRange)
      
      if (charText === '@' && charRange) {
        // 显示选择器
        setTarget(charRange)
        setShowPicker(true)
        setPickerSearch('')
        setSelectedIndex(0)
        
        // 计算位置（使用视口坐标，配合 Portal fixed 定位）
        try {
          const domRange = ReactEditor.toDOMRange(editor, charRange)
          const rect = domRange.getBoundingClientRect()
          
          setPickerPosition({
            top: rect.bottom + 4,  // 视口坐标
            left: rect.left,       // 视口坐标
          })
        } catch {
          setPickerPosition({ top: 100, left: 100 })
        }
      } else if (showPicker && target) {
        // 更新搜索文本
        const searchRange = Editor.range(editor, target.anchor, start)
        const searchText = Editor.string(editor, searchRange)
        
        if (searchText.startsWith('@')) {
          setPickerSearch(searchText.slice(1))
        } else {
          // 关闭选择器
          setShowPicker(false)
          setTarget(null)
        }
      }
    }
  }, [editor, onChange, showPicker, target])
  
  // 键盘事件处理
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (!showPicker || filteredAssets.length === 0) return
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredAssets.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        event.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredAssets.length - 1
        )
        break
      case 'Enter':
      case 'Tab':
        event.preventDefault()
        const selected = filteredAssets[selectedIndex]
        if (selected) {
          insertMention(selected)
        }
        break
      case 'Escape':
        event.preventDefault()
        setShowPicker(false)
        setTarget(null)
        break
    }
  }, [showPicker, filteredAssets, selectedIndex, insertMention])
  
  // 自定义元素渲染
  const renderElement = useCallback((props: RenderElementProps) => {
    const { element, attributes, children } = props
    
    if (isAssetMentionElement(element)) {
      return (
        <MentionElement 
          attributes={attributes} 
          element={element}
        >
          {children}
        </MentionElement>
      )
    }
    
    // 默认段落
    return <p {...attributes}>{children}</p>
  }, [])
  
  // 自定义叶子渲染
  const renderLeaf = useCallback((props: RenderLeafProps) => {
    return <span {...props.attributes}>{props.children}</span>
  }, [])
  
  return (
    <div className="relative">
      <Slate editor={editor} initialValue={value} onChange={handleChange}>
        <Editable
          className="w-full min-h-[80px] px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-sm leading-relaxed text-zinc-100 outline-none focus:border-blue-500/50 transition-colors"
          style={{ caretColor: '#60a5fa' }}
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          onBlur={() => {
            // 延迟关闭，允许点击选择器
            setTimeout(() => {
              setShowPicker(false)
            }, 200)
          }}
        />
        
        {/* 素材选择器 */}
        <AssetPicker
          assets={filteredAssets}
          search={pickerSearch}
          selectedIndex={selectedIndex}
          position={pickerPosition}
          show={showPicker}
          onSelect={insertMention}
          onClose={() => {
            setShowPicker(false)
            setTarget(null)
          }}
        />
      </Slate>
    </div>
  )
}

export default PromptEditor
