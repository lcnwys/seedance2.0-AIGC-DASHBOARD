import { TosClient } from '@volcengine/tos-sdk'

const DEFAULT_UPLOAD_EXPIRES_SECONDS = 10 * 60
const DEFAULT_UPLOAD_PREFIX = 'uploads'

type TosConfig = {
  accessKeyId: string
  accessKeySecret: string
  region: string
  bucket: string
  endpoint: string
  publicBaseUrl: string | null
  uploadPrefix: string
}

let cachedClient: TosClient | null = null
let cachedClientKey: string | null = null

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function normalizeEndpoint(endpoint: string) {
  return endpoint.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

function normalizeBaseUrl(url: string | undefined) {
  const trimmed = url?.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.replace(/\/+$/, '')
}

function encodeObjectKey(key: string) {
  return key
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim() || 'file'
  const extIndex = normalized.lastIndexOf('.')
  const extension = extIndex >= 0 ? normalized.slice(extIndex).toLowerCase() : ''
  const baseName = extIndex >= 0 ? normalized.slice(0, extIndex) : normalized
  const safeBaseName = baseName
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'file'

  return {
    baseName: safeBaseName,
    extension: extension.slice(0, 16),
  }
}

export function getTosConfig(): TosConfig {
  return {
    accessKeyId: getRequiredEnv('TOS_ACCESS_KEY_ID'),
    accessKeySecret: getRequiredEnv('TOS_ACCESS_KEY_SECRET'),
    region: getRequiredEnv('TOS_REGION'),
    bucket: getRequiredEnv('TOS_BUCKET'),
    endpoint: normalizeEndpoint(getRequiredEnv('TOS_ENDPOINT')),
    publicBaseUrl: normalizeBaseUrl(process.env.TOS_PUBLIC_BASE_URL),
    uploadPrefix: process.env.TOS_UPLOAD_PREFIX?.trim() || DEFAULT_UPLOAD_PREFIX,
  }
}

export function getTosClient() {
  const config = getTosConfig()
  const clientKey = [
    config.accessKeyId,
    config.accessKeySecret,
    config.region,
    config.bucket,
    config.endpoint,
  ].join(':')

  if (!cachedClient || cachedClientKey !== clientKey) {
    cachedClient = new TosClient({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      region: config.region,
      bucket: config.bucket,
      endpoint: config.endpoint,
    })
    cachedClientKey = clientKey
  }

  return cachedClient
}

export function buildTosObjectKey(params: {
  userId: string
  fileName: string
  prefix?: string
}) {
  const { userId, fileName, prefix } = params
  const config = getTosConfig()
  const { baseName, extension } = sanitizeFileName(fileName)
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const normalizedPrefix = (prefix || config.uploadPrefix || DEFAULT_UPLOAD_PREFIX).replace(/^\/+|\/+$/g, '')

  return `${normalizedPrefix}/${userId}/${year}/${month}/${uniqueSuffix}-${baseName}${extension}`
}

export function getTosObjectUrl(objectKey: string) {
  const config = getTosConfig()
  const encodedKey = encodeObjectKey(objectKey)

  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl}/${encodedKey}`
  }

  return `https://${config.bucket}.${config.endpoint}/${encodedKey}`
}

export function createTosUploadTarget(params: {
  userId: string
  fileName: string
  prefix?: string
  expiresInSeconds?: number
}) {
  const { bucket } = getTosConfig()
  const client = getTosClient()
  const objectKey = buildTosObjectKey({
    userId: params.userId,
    fileName: params.fileName,
    prefix: params.prefix,
  })
  const expiresInSeconds = params.expiresInSeconds ?? DEFAULT_UPLOAD_EXPIRES_SECONDS
  const uploadUrl = client.getPreSignedUrl({
    bucket,
    key: objectKey,
    method: 'PUT',
    expires: expiresInSeconds,
  })

  return {
    bucket,
    objectKey,
    uploadUrl,
    fileUrl: getTosObjectUrl(objectKey),
    expiresInSeconds,
  }
}
