interface ReferenceAssetLike {
  id?: string
  type: string
  url: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
}

export function buildReferenceAssetLabel(type: string, index: number) {
  return `${ASSET_TYPE_LABELS[type] || '素材'}${index}`
}

export function getReferenceAssetKey(asset: Pick<ReferenceAssetLike, 'type' | 'url'>) {
  return `${asset.type}::${asset.url}`
}

function parseStoredReferenceAssetOrder(storedOrder: unknown): string[] {
  if (!storedOrder) {
    return []
  }

  let parsedValue: unknown = storedOrder

  if (typeof storedOrder === 'string') {
    try {
      parsedValue = JSON.parse(storedOrder)
    } catch {
      return []
    }
  }

  if (!Array.isArray(parsedValue)) {
    return []
  }

  return parsedValue.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function collectMentionKeys(node: unknown, orderedKeys: string[], seenKeys: Set<string>) {
  if (!isRecord(node)) {
    return
  }

  const nodeType = typeof node.type === 'string' ? node.type : null
  const assetType = typeof node.assetType === 'string' ? node.assetType : null
  const assetUrl = typeof node.assetUrl === 'string' ? node.assetUrl : null

  if (nodeType === 'asset-mention' && assetType && assetUrl) {
    const key = getReferenceAssetKey({ type: assetType, url: assetUrl })
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      orderedKeys.push(key)
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectMentionKeys(child, orderedKeys, seenKeys)
    }
  }
}

function orderReferenceAssetsByStoredOrder<T extends ReferenceAssetLike>(
  referenceAssets: T[],
  storedOrder: unknown,
): T[] {
  const orderedIdsOrKeys = parseStoredReferenceAssetOrder(storedOrder)

  if (orderedIdsOrKeys.length === 0) {
    return [...referenceAssets]
  }

  const usedIndexes = new Set<number>()
  const orderedAssets: T[] = []

  for (const token of orderedIdsOrKeys) {
    const assetIndex = referenceAssets.findIndex((asset, index) => {
      if (usedIndexes.has(index)) {
        return false
      }

      return asset.id === token || getReferenceAssetKey(asset) === token
    })

    if (assetIndex >= 0) {
      usedIndexes.add(assetIndex)
      orderedAssets.push(referenceAssets[assetIndex])
    }
  }

  referenceAssets.forEach((asset, index) => {
    if (!usedIndexes.has(index)) {
      orderedAssets.push(asset)
    }
  })

  return orderedAssets
}

export function orderReferenceAssetsByPromptAst<T extends ReferenceAssetLike>(
  referenceAssets: T[] | null | undefined,
  promptAst: unknown,
): T[] {
  if (!referenceAssets || referenceAssets.length === 0) {
    return []
  }

  if (!Array.isArray(promptAst) || promptAst.length === 0) {
    return [...referenceAssets]
  }

  const orderedKeys: string[] = []
  const seenKeys = new Set<string>()

  for (const node of promptAst) {
    collectMentionKeys(node, orderedKeys, seenKeys)
  }

  if (orderedKeys.length === 0) {
    return [...referenceAssets]
  }

  const usedIndexes = new Set<number>()
  const orderedAssets: T[] = []

  for (const key of orderedKeys) {
    const [assetType, assetUrl] = key.split('::')
    const assetIndex = referenceAssets.findIndex((asset, index) => {
      return !usedIndexes.has(index) && asset.type === assetType && asset.url === assetUrl
    })

    if (assetIndex >= 0) {
      usedIndexes.add(assetIndex)
      orderedAssets.push(referenceAssets[assetIndex])
    }
  }

  referenceAssets.forEach((asset, index) => {
    if (!usedIndexes.has(index)) {
      orderedAssets.push(asset)
    }
  })

  return orderedAssets
}

export function orderReferenceAssets<T extends ReferenceAssetLike>(
  referenceAssets: T[] | null | undefined,
  options?: {
    promptAst?: unknown
    storedOrder?: unknown
  },
): T[] {
  if (!referenceAssets || referenceAssets.length === 0) {
    return []
  }

  const orderedByStoredOrder = orderReferenceAssetsByStoredOrder(referenceAssets, options?.storedOrder)

  if (parseStoredReferenceAssetOrder(options?.storedOrder).length > 0) {
    return orderedByStoredOrder
  }

  return orderReferenceAssetsByPromptAst(orderedByStoredOrder, options?.promptAst)
}

function buildReferenceLabelMap<T extends ReferenceAssetLike>(referenceAssets: T[]) {
  const counters: Record<string, number> = {
    image: 0,
    video: 0,
    audio: 0,
  }
  const labelMap = new Map<string, string>()

  for (const asset of referenceAssets) {
    counters[asset.type] = (counters[asset.type] || 0) + 1
    labelMap.set(
      getReferenceAssetKey(asset),
      buildReferenceAssetLabel(asset.type, counters[asset.type]),
    )
  }

  return labelMap
}

function normalizePromptAstNode(
  node: unknown,
  labelMap: Map<string, string>,
): { node: unknown; changed: boolean } {
  if (!isRecord(node)) {
    return { node, changed: false }
  }

  const nodeType = typeof node.type === 'string' ? node.type : null
  const assetType = typeof node.assetType === 'string' ? node.assetType : null
  const assetUrl = typeof node.assetUrl === 'string' ? node.assetUrl : null
  const assetLabel = typeof node.assetLabel === 'string' ? node.assetLabel : null

  if (nodeType === 'asset-mention' && assetType && assetUrl) {
    const nextLabel = labelMap.get(getReferenceAssetKey({ type: assetType, url: assetUrl }))

    if (!nextLabel) {
      return {
        node: { text: `@${assetLabel || buildReferenceAssetLabel(assetType, 1)}` },
        changed: true,
      }
    }

    if (assetLabel === nextLabel) {
      return { node, changed: false }
    }

    return {
      node: {
        ...node,
        assetLabel: nextLabel,
      },
      changed: true,
    }
  }

  if (!Array.isArray(node.children)) {
    return { node, changed: false }
  }

  let changed = false
  const nextChildren = node.children.map((child) => {
    const result = normalizePromptAstNode(child, labelMap)
    if (result.changed) {
      changed = true
    }
    return result.node
  })

  if (!changed) {
    return { node, changed: false }
  }

  return {
    node: {
      ...node,
      children: nextChildren,
    },
    changed: true,
  }
}

export function normalizePromptAstAssetLabels<T extends ReferenceAssetLike>(
  promptAst: unknown,
  referenceAssets: T[] | null | undefined,
): { promptAst: unknown; changed: boolean } {
  if (!Array.isArray(promptAst)) {
    return { promptAst, changed: false }
  }

  const labelMap = buildReferenceLabelMap(referenceAssets || [])
  let changed = false
  const nextPromptAst = promptAst.map((node) => {
    const result = normalizePromptAstNode(node, labelMap)
    if (result.changed) {
      changed = true
    }
    return result.node
  })

  return {
    promptAst: changed ? nextPromptAst : promptAst,
    changed,
  }
}
