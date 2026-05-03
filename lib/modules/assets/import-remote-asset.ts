import dns from 'node:dns/promises'
import net from 'node:net'
import { Readable, Transform } from 'node:stream'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { prisma } from '@/lib/prisma'
import {
  fetchRemoteUrlToUserObjectStorage,
  resolveUserObjectStorageProviderId,
  uploadStreamForUser,
} from '@/lib/object-storage'

export type RemoteAssetType = 'image' | 'video' | 'audio'
const REMOTE_FETCH_REDIRECT_LIMIT = 3
const DEFAULT_REMOTE_ASSET_MAX_BYTES = 5 * 1024 * 1024 * 1024
const inFlightRemoteAssetImports = new Map<string, Promise<unknown>>()

function getRemoteAssetMaxBytes() {
  const configured = Number.parseInt(process.env.REMOTE_ASSET_MAX_BYTES || '', 10)
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_REMOTE_ASSET_MAX_BYTES
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${value} B`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MiB`
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GiB`
}

function buildRemoteAssetImportKey(params: {
  userId: string
  sourceUrl: string
  fileBaseName: string
  type: RemoteAssetType
  fileExtension?: string | null
}) {
  return [
    params.userId,
    params.type,
    sanitizeNameSegment(params.fileBaseName) || `generated-${params.type}`,
    (params.fileExtension || '').trim().toLowerCase(),
    params.sourceUrl.trim(),
  ].join('::')
}

async function withRemoteAssetImportLock<T>(key: string, factory: () => Promise<T>) {
  const existing = inFlightRemoteAssetImports.get(key)
  if (existing) {
    return existing as Promise<T>
  }

  const promise = factory().finally(() => {
    if (inFlightRemoteAssetImports.get(key) === promise) {
      inFlightRemoteAssetImports.delete(key)
    }
  })

  inFlightRemoteAssetImports.set(key, promise)
  return promise
}

function sanitizeNameSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function inferExtension(contentType: string | null, fallback: string, type: RemoteAssetType) {
  const normalizedFallback = fallback.trim().replace(/^\./, '').toLowerCase()
  if (normalizedFallback) {
    return normalizedFallback
  }

  switch ((contentType || '').toLowerCase()) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'video/mp4':
      return 'mp4'
    case 'video/quicktime':
      return 'mov'
    case 'video/webm':
      return 'webm'
    case 'audio/mpeg':
      return 'mp3'
    case 'audio/wav':
      return 'wav'
    case 'audio/x-wav':
      return 'wav'
    case 'audio/mp4':
      return 'm4a'
    default:
      return type === 'video'
        ? 'mp4'
        : type === 'audio'
          ? 'mp3'
          : 'jpg'
  }
}

function inferExtensionFromUrl(sourceUrl: string) {
  try {
    const pathname = new URL(sourceUrl).pathname
    const extension = pathname.split('/').pop()?.split('.').pop()?.trim().toLowerCase() || ''
    return extension.replace(/[^a-z0-9]+/g, '').slice(0, 16)
  } catch {
    return ''
  }
}

function inferContentType(type: RemoteAssetType, contentType: string | null, extension: string) {
  if (contentType) {
    return contentType
  }

  if (type === 'video') {
    if (extension === 'mov') return 'video/quicktime'
    if (extension === 'webm') return 'video/webm'
    return 'video/mp4'
  }

  if (type === 'audio') {
    if (extension === 'wav') return 'audio/wav'
    if (extension === 'm4a') return 'audio/mp4'
    return 'audio/mpeg'
  }

  return extension === 'png'
    ? 'image/png'
    : extension === 'webp'
      ? 'image/webp'
      : 'image/jpeg'
}

function getAssetUploadPrefix(type: RemoteAssetType) {
  if (type === 'video') return 'generated-videos'
  if (type === 'audio') return 'generated-audios'
  return 'generated-images'
}

function isBlockedIpv4(address: string) {
  const segments = address.split('.').map((segment) => Number(segment))
  if (segments.length !== 4 || segments.some((segment) => Number.isNaN(segment))) {
    return false
  }

  if (segments[0] === 10) return true
  if (segments[0] === 127) return true
  if (segments[0] === 169 && segments[1] === 254) return true
  if (segments[0] === 172 && segments[1] >= 16 && segments[1] <= 31) return true
  if (segments[0] === 192 && segments[1] === 168) return true
  return false
}

function isBlockedIpv6(address: string) {
  const normalized = address.toLowerCase()
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  )
}

function isBlockedIpAddress(address: string) {
  if (net.isIPv4(address)) return isBlockedIpv4(address)
  if (net.isIPv6(address)) return isBlockedIpv6(address)
  return false
}

async function assertSafeRemoteUrl(rawUrl: string) {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new Error('远端素材地址无效')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('远端素材地址仅支持 HTTP 或 HTTPS')
  }

  const hostname = parsedUrl.hostname.trim().toLowerCase()
  if (!hostname) {
    throw new Error('远端素材地址缺少主机名')
  }

  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new Error('不允许访问本地主机或内网域名')
  }

  if (net.isIP(hostname) && isBlockedIpAddress(hostname)) {
    throw new Error('不允许访问内网或回环地址')
  }

  let resolvedAddresses: Array<{ address: string }>
  try {
    resolvedAddresses = await dns.lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error('无法解析远端素材地址')
  }

  if (!resolvedAddresses.length) {
    throw new Error('远端素材地址未解析到可访问公网地址')
  }

  if (resolvedAddresses.some((record) => isBlockedIpAddress(record.address))) {
    throw new Error('远端素材地址解析到了内网地址，已拒绝访问')
  }

  return parsedUrl
}

async function fetchRemoteAsset(
  sourceUrl: string,
  redirectCount = 0,
  signal?: AbortSignal,
): Promise<Response> {
  const safeUrl = await assertSafeRemoteUrl(sourceUrl)
  const response = await fetch(safeUrl.toString(), {
    redirect: 'manual',
    signal,
  })

  if (response.status >= 300 && response.status < 400) {
    if (redirectCount >= REMOTE_FETCH_REDIRECT_LIMIT) {
      throw new Error('远端素材重定向次数过多')
    }

    const location = response.headers.get('location')
    if (!location) {
      throw new Error('远端素材重定向地址缺失')
    }

    return fetchRemoteAsset(new URL(location, safeUrl).toString(), redirectCount + 1, signal)
  }

  return response
}

function parseContentLength(response: Response) {
  const value = response.headers.get('content-length')?.trim()
  if (!value) return null

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function createByteLimitTransform(maxBytes: number, abortController: AbortController) {
  let totalBytes = 0

  return {
    stream: new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        totalBytes += chunk.byteLength

        if (totalBytes > maxBytes) {
          abortController.abort()
          callback(new Error(`远端素材超过大小限制: ${formatBytes(maxBytes)}`))
          return
        }

        callback(null, chunk)
      },
    }),
    getTotalBytes: () => totalBytes,
  }
}

async function relayRemoteAssetThroughServer(params: {
  userId: string
  sourceUrl: string
  fileName: string
  type: RemoteAssetType
  fileExtension?: string | null
  contentType?: string | null
}) {
  const maxBytes = getRemoteAssetMaxBytes()
  const abortController = new AbortController()
  const response = await fetchRemoteAsset(params.sourceUrl, 0, abortController.signal)
  if (!response.ok) {
    throw new Error(`下载远端素材失败: ${response.status}`)
  }

  if (!response.body) {
    throw new Error('远端素材响应缺少可读取内容')
  }

  const contentLength = parseContentLength(response)
  if (contentLength != null && contentLength > maxBytes) {
    abortController.abort()
    throw new Error(`远端素材超过大小限制: ${formatBytes(maxBytes)}`)
  }

  const contentTypeHeader = response.headers.get('content-type')?.split(';')[0]?.trim() || null
  const contentType = params.contentType?.trim() || contentTypeHeader
  const extension = inferExtension(
    contentType,
    params.fileExtension || inferExtensionFromUrl(params.sourceUrl),
    params.type,
  )
  const finalContentType = inferContentType(params.type, contentType, extension)
  const { stream, getTotalBytes } = createByteLimitTransform(maxBytes, abortController)
  const sourceStream = Readable.fromWeb(response.body as WebReadableStream<Uint8Array>)
  const limitedStream = sourceStream.pipe(stream)

  const relayUpload = await uploadStreamForUser({
    userId: params.userId,
    fileName: params.fileName,
    body: limitedStream,
    contentType: finalContentType,
    contentLength: contentLength ?? undefined,
    prefix: getAssetUploadPrefix(params.type),
  })

  return {
    fileUrl: relayUpload.fileUrl,
    size: getTotalBytes() || contentLength || 0,
    contentType: finalContentType,
  }
}

export async function importRemoteAssetToAsset(params: {
  userId: string
  sourceUrl: string
  fileBaseName: string
  type: RemoteAssetType
  fileExtension?: string | null
  contentType?: string | null
  duration?: number | null
}) {
  const importKey = buildRemoteAssetImportKey(params)
  return withRemoteAssetImportLock(importKey, async () => {
    const safeBaseName = sanitizeNameSegment(params.fileBaseName) || `generated-${params.type}`
    const initialExtension = inferExtension(
      params.contentType?.trim() || null,
      params.fileExtension || inferExtensionFromUrl(params.sourceUrl),
      params.type,
    )
    const initialContentType = inferContentType(params.type, params.contentType?.trim() || null, initialExtension)
    const fileName = `${safeBaseName}.${initialExtension}`

    await assertSafeRemoteUrl(params.sourceUrl)
    const existing = await prisma.asset.findFirst({
      where: {
        userId: params.userId,
        type: params.type,
        name: fileName,
      },
    })

    if (existing) {
      return existing
    }

    const storageProviderId = await resolveUserObjectStorageProviderId({
      userId: params.userId,
    })
    let uploaded: {
      fileUrl: string
      size: number
      contentType: string | null
    }

    if (storageProviderId === 'tos') {
      try {
        uploaded = await fetchRemoteUrlToUserObjectStorage({
          userId: params.userId,
          sourceUrl: params.sourceUrl,
          fileName,
          prefix: getAssetUploadPrefix(params.type),
          contentType: initialContentType,
        })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown TOS fetch error'
        console.warn('TOS remote fetch import failed, falling back to server relay upload:', {
          sourceUrl: params.sourceUrl,
          fileName,
          error: message,
        })

        uploaded = await relayRemoteAssetThroughServer({
          userId: params.userId,
          sourceUrl: params.sourceUrl,
          fileName,
          type: params.type,
          fileExtension: params.fileExtension,
          contentType: params.contentType,
        })
      }
    } else {
      uploaded = await relayRemoteAssetThroughServer({
        userId: params.userId,
        sourceUrl: params.sourceUrl,
        fileName,
        type: params.type,
        fileExtension: params.fileExtension,
        contentType: params.contentType,
      })
    }

    const finalContentType = uploaded.contentType || initialContentType

    const asset = await prisma.asset.create({
      data: {
        name: fileName,
        type: params.type,
        url: uploaded.fileUrl,
        size: uploaded.size,
        duration: params.duration ?? null,
        contentType: finalContentType,
        category: 'creation',
        userId: params.userId,
      },
    })

    return asset
  })
}

export async function importRemoteImageToAsset(params: {
  userId: string
  sourceUrl: string
  fileBaseName: string
  outputFormat?: string | null
}) {
  return importRemoteAssetToAsset({
    userId: params.userId,
    sourceUrl: params.sourceUrl,
    fileBaseName: params.fileBaseName,
    type: 'image',
    fileExtension: params.outputFormat,
  })
}

export async function importRemoteVideoToAsset(params: {
  userId: string
  sourceUrl: string
  fileBaseName: string
  contentType?: string | null
  duration?: number | null
}) {
  return importRemoteAssetToAsset({
    userId: params.userId,
    sourceUrl: params.sourceUrl,
    fileBaseName: params.fileBaseName,
    type: 'video',
    fileExtension: 'mp4',
    contentType: params.contentType,
    duration: params.duration,
  })
}
