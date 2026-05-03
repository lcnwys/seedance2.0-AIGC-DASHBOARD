/**
 * Slate 序列化器
 * 
 * 将 Slate 编辑器状态树序列化为 API 请求所需的格式
 * 
 * 核心功能：
 * 1. 遍历 Slate JSON 树
 * 2. 基于 assetUrl 去重并按出现顺序生成连续序号
 * 3. 输出紧凑的 prompt 字符串（无冗余空格）
 */

import { Descendant, Text } from 'slate'
import { 
  AssetMentionElement, 
  isAssetMentionElement, 
  PromptApiPayload,
  AssetType
} from '@/types/slate-types'
import { buildReferenceAssetLabel } from '@/lib/modules/tasks/reference-asset-order'

/**
 * 将 Slate 编辑器内容序列化为 API 请求格式
 * 
 * @param nodes - Slate 文档节点
 * @returns API 请求所需的 payload
 */
export function serializeToApiPayload(nodes: Descendant[]): PromptApiPayload {
  // 用于去重和追踪序号
  const imageUrls: string[] = []
  const videoUrls: string[] = []
  const audioUrls: string[] = []
  
  // URL -> 序号标签的映射（用于去重时复用标签）
  const keyToLabel = new Map<string, string>()
  
  // 计数器
  const counters = {
    image: 0,
    video: 0,
    audio: 0,
  }
  
  // 序列化文本片段
  const textParts: string[] = []
  
  /**
   * 获取或创建资产标签
   */
  function getOrCreateLabel(url: string, type: AssetType, existingLabel?: string): string {
    const key = `${type}::${url}`

    // 如果已存在，复用标签
    if (keyToLabel.has(key)) {
      return keyToLabel.get(key)!
    }

    counters[type]++
    const label = existingLabel?.trim() || buildReferenceAssetLabel(type, counters[type])

    // 记录映射
    keyToLabel.set(key, label)

    // 添加到对应数组
    if (type === 'image') {
      imageUrls.push(url)
    } else if (type === 'video') {
      videoUrls.push(url)
    } else {
      audioUrls.push(url)
    }
    
    return label
  }
  
  /**
   * 递归遍历节点
   */
  function processNode(node: Descendant): void {
    // 文本节点
    if (Text.isText(node)) {
      if (node.text) {
        textParts.push(node.text)
      }
      return
    }
    
    // AssetMention 节点
    if (isAssetMentionElement(node)) {
      const label = getOrCreateLabel(node.assetUrl, node.assetType, node.assetLabel)
      textParts.push(`@${label}`)
      return
    }
    
    // 其他元素节点（如 paragraph）
    if ('children' in node) {
      for (const child of node.children) {
        processNode(child)
      }
    }
  }
  
  // 处理所有顶级节点
  for (const node of nodes) {
    processNode(node)
  }
  
  // 合并文本并清理空格
  let prompt = textParts.join('')
  
  // 清理：
  // 1. 合并连续空格为单个空格
  // 2. 去除首尾空格
  // 3. 去除 @mention 前后的多余空格（保留单个）
  prompt = prompt
    .replace(/\s+/g, ' ')  // 多个空白字符合并为单个空格
    .replace(/\s*@/g, '@') // @前面的空格去除
    .replace(/@(\S+)\s{2,}/g, '@$1 ') // @mention后的多个空格合并为一个
    .trim()
  
  return {
    prompt,
    reference_image_urls: imageUrls,
    reference_video_urls: videoUrls,
    reference_audio_urls: audioUrls,
  }
}

/**
 * 获取纯文本（用于字符计数等场景）
 */
export function serializeToPlainText(nodes: Descendant[]): string {
  const parts: string[] = []
  
  function processNode(node: Descendant): void {
    if (Text.isText(node)) {
      if (node.text) {
        parts.push(node.text)
      }
      return
    }
    
    if (isAssetMentionElement(node)) {
      parts.push(`@${node.assetLabel}`)
      return
    }
    
    if ('children' in node) {
      for (const child of node.children) {
        processNode(child)
      }
    }
  }
  
  for (const node of nodes) {
    processNode(node)
  }
  
  return parts.join('').replace(/\s+/g, ' ').trim()
}

/**
 * 从纯文本解析为 Slate 节点（用于数据库回填）
 * 
 * @param text - 包含 @mention 的纯文本
 * @param assets - 可用资产列表（用于匹配 URL）
 */
export function deserializeFromText(
  text: string, 
  assets: Array<{ type: AssetType; url: string; label: string }>
): Descendant[] {
  const children: Descendant[] = []
  
  // 正则匹配 @图片1、@视频2 等
  const regex = /@(图片|视频|音频)(\d+)/g
  let lastIndex = 0
  let match
  
  while ((match = regex.exec(text)) !== null) {
    // 添加 match 之前的纯文本
    if (match.index > lastIndex) {
      children.push({ text: text.slice(lastIndex, match.index) })
    }
    
    // 解析 mention
    const typeText = match[1]
    const num = parseInt(match[2])
    const type: AssetType = typeText === '图片' ? 'image' : typeText === '视频' ? 'video' : 'audio'
    const label = `${typeText}${num}`
    
    // 查找对应资产
    const asset = assets.find(a => a.type === type && a.label === label)
    
    if (asset) {
      const mentionNode: AssetMentionElement = {
        type: 'asset-mention',
        assetType: type,
        assetUrl: asset.url,
        assetLabel: label,
        children: [{ text: '' }],
      }
      children.push(mentionNode)
    } else {
      // 找不到资产，保留原文本
      children.push({ text: match[0] })
    }
    
    lastIndex = match.index + match[0].length
  }
  
  // 添加剩余文本
  if (lastIndex < text.length) {
    children.push({ text: text.slice(lastIndex) })
  }
  
  // 如果没有内容，添加空文本节点
  if (children.length === 0) {
    children.push({ text: '' })
  }
  
  return [
    {
      type: 'paragraph',
      children,
    },
  ]
}
