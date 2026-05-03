import OSS from 'ali-oss'
import { TosClient } from '@volcengine/tos-sdk'
import type { Readable } from 'node:stream'
import { prisma } from '@/lib/prisma'

const DEFAULT_UPLOAD_EXPIRES_SECONDS = 10 * 60
const DEFAULT_UPLOAD_PREFIX = 'uploads'
const TOS_FETCH_TASK_POLL_INTERVAL_MS = 1500
const TOS_FETCH_TASK_TIMEOUT_MS = 180 * 1000

export type ObjectStorageProviderId = 'tos' | 'oss'

export type ObjectStorageProviderOption = {
  id: ObjectStorageProviderId
  label: string
  configured: boolean
}

type ObjectStorageUploadTarget = {
  providerId: ObjectStorageProviderId
  objectKey: string
  uploadUrl: string
  fileUrl: string
  expiresInSeconds: number
}

type ObjectStorageObjectLocation = {
  providerId: ObjectStorageProviderId
  objectKey: string
  fileUrl: string
}

type RemoteFetchUploadResult = ObjectStorageObjectLocation & {
  size: number
  contentType: string | null
}

type ObjectStorageConfig = {
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  endpoint: string
  publicBaseUrl: string | null
  uploadPrefix: string
}

type TosConfig = ObjectStorageConfig & {
  region: string
}

type OssConfig = ObjectStorageConfig & {
  region: string
}

let cachedTosClient: TosClient | null = null
let cachedTosClientKey: string | null = null
let cachedOssClient: OSS | null = null
let cachedOssClientKey: string | null = null

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

export function normalizeObjectStorageProviderId(value: unknown): ObjectStorageProviderId {
  return value === 'oss' ? 'oss' : 'tos'
}

export function getObjectStorageProviderOptions(): ObjectStorageProviderOption[] {
  return [
    {
      id: 'tos',
      label: '火山 TOS',
      configured: isObjectStorageProviderConfigured('tos'),
    },
    {
      id: 'oss',
      label: '阿里云 OSS',
      configured: isObjectStorageProviderConfigured('oss'),
    },
  ]
}

export function hasConfiguredObjectStorageProvider() {
  return isObjectStorageProviderConfigured('tos') || isObjectStorageProviderConfigured('oss')
}

export function shouldUseObjectStorage(): boolean {
  return hasConfiguredObjectStorageProvider()
}

export function isObjectStorageProviderConfigured(providerId: ObjectStorageProviderId) {
  if (providerId === 'oss') {
    return Boolean(
      process.env.OSS_ACCESS_KEY_ID?.trim()
      && process.env.OSS_ACCESS_KEY_SECRET?.trim()
      && process.env.OSS_REGION?.trim()
      && process.env.OSS_BUCKET?.trim()
    )
  }

  return Boolean(
    process.env.TOS_ACCESS_KEY_ID?.trim()
    && process.env.TOS_ACCESS_KEY_SECRET?.trim()
    && process.env.TOS_REGION?.trim()
    && process.env.TOS_BUCKET?.trim()
    && process.env.TOS_ENDPOINT?.trim()
  )
}

export function assertObjectStorageProviderConfigured(providerId: ObjectStorageProviderId) {
  if (isObjectStorageProviderConfigured(providerId)) {
    return
  }

  if (providerId === 'oss') {
    throw new Error('阿里云 OSS 未配置，请补齐 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_REGION / OSS_BUCKET')
  }

  throw new Error('火山 TOS 未配置，请补齐 TOS_ACCESS_KEY_ID / TOS_ACCESS_KEY_SECRET / TOS_REGION / TOS_BUCKET / TOS_ENDPOINT')
}

function getTosConfig(): TosConfig {
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

function getOssEndpointHost(region: string) {
  return `${region}.aliyuncs.com`
}

function getOssConfig(): OssConfig {
  const region = getRequiredEnv('OSS_REGION')
  const endpoint = process.env.OSS_ENDPOINT?.trim()
    ? normalizeEndpoint(process.env.OSS_ENDPOINT)
    : getOssEndpointHost(region)

  return {
    accessKeyId: getRequiredEnv('OSS_ACCESS_KEY_ID'),
    accessKeySecret: getRequiredEnv('OSS_ACCESS_KEY_SECRET'),
    region,
    bucket: getRequiredEnv('OSS_BUCKET'),
    endpoint,
    publicBaseUrl: normalizeBaseUrl(process.env.OSS_PUBLIC_BASE_URL),
    uploadPrefix: process.env.OSS_UPLOAD_PREFIX?.trim() || DEFAULT_UPLOAD_PREFIX,
  }
}

function getTosClient() {
  const config = getTosConfig()
  const clientKey = [
    config.accessKeyId,
    config.accessKeySecret,
    config.region,
    config.bucket,
    config.endpoint,
  ].join(':')

  if (!cachedTosClient || cachedTosClientKey !== clientKey) {
    cachedTosClient = new TosClient({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      region: config.region,
      bucket: config.bucket,
      endpoint: config.endpoint,
    })
    cachedTosClientKey = clientKey
  }

  return cachedTosClient
}

function getOssClient() {
  const config = getOssConfig()
  const clientKey = [
    config.accessKeyId,
    config.accessKeySecret,
    config.region,
    config.bucket,
    config.endpoint,
  ].join(':')

  if (!cachedOssClient || cachedOssClientKey !== clientKey) {
    cachedOssClient = new OSS({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      region: config.region,
      bucket: config.bucket,
      endpoint: `https://${config.endpoint}`,
      secure: true,
    })
    cachedOssClientKey = clientKey
  }

  return cachedOssClient
}

function getProviderUploadPrefix(providerId: ObjectStorageProviderId) {
  return providerId === 'oss'
    ? getOssConfig().uploadPrefix
    : getTosConfig().uploadPrefix
}

function buildObjectKey(params: {
  providerId: ObjectStorageProviderId
  userId: string
  fileName: string
  prefix?: string
}) {
  const { baseName, extension } = sanitizeFileName(params.fileName)
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const normalizedPrefix = (params.prefix || getProviderUploadPrefix(params.providerId) || DEFAULT_UPLOAD_PREFIX)
    .replace(/^\/+|\/+$/g, '')

  return `${normalizedPrefix}/${params.userId}/${year}/${month}/${uniqueSuffix}-${baseName}${extension}`
}

function getObjectUrl(providerId: ObjectStorageProviderId, objectKey: string) {
  const encodedKey = encodeObjectKey(objectKey)

  if (providerId === 'oss') {
    const config = getOssConfig()
    if (config.publicBaseUrl) {
      return `${config.publicBaseUrl}/${encodedKey}`
    }
    return `https://${config.bucket}.${config.endpoint}/${encodedKey}`
  }

  const config = getTosConfig()
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl}/${encodedKey}`
  }

  return `https://${config.bucket}.${config.endpoint}/${encodedKey}`
}

function buildObjectLocation(params: {
  providerId: ObjectStorageProviderId
  userId: string
  fileName: string
  prefix?: string
}): ObjectStorageObjectLocation {
  const objectKey = buildObjectKey(params)

  return {
    providerId: params.providerId,
    objectKey,
    fileUrl: getObjectUrl(params.providerId, objectKey),
  }
}

async function putObject(params: {
  providerId: ObjectStorageProviderId
  objectKey: string
  body: Buffer | Readable
  contentType: string
  contentLength?: number
}) {
  if (params.providerId === 'oss') {
    const client = getOssClient()
    await client.put(params.objectKey, params.body, {
      contentLength: params.contentLength,
      headers: {
        'Content-Type': params.contentType,
      },
    } as OSS.PutObjectOptions & { contentLength?: number })
    return
  }

  const client = getTosClient()
  await client.putObject({
    key: params.objectKey,
    body: params.body,
    contentType: params.contentType,
    contentLength: params.contentLength,
  })
}

async function createUploadTarget(params: {
  providerId: ObjectStorageProviderId
  userId: string
  fileName: string
  prefix?: string
  expiresInSeconds?: number
}): Promise<ObjectStorageUploadTarget> {
  assertObjectStorageProviderConfigured(params.providerId)

  const location = buildObjectLocation(params)
  const expiresInSeconds = params.expiresInSeconds ?? DEFAULT_UPLOAD_EXPIRES_SECONDS

  if (params.providerId === 'oss') {
    const client = getOssClient()
    const uploadUrl = client.signatureUrl(location.objectKey, {
      method: 'PUT',
      expires: expiresInSeconds,
    })

    return {
      providerId: params.providerId,
      objectKey: location.objectKey,
      uploadUrl,
      fileUrl: location.fileUrl,
      expiresInSeconds,
    }
  }

  const config = getTosConfig()
  const client = getTosClient()
  const uploadUrl = client.getPreSignedUrl({
    bucket: config.bucket,
    key: location.objectKey,
    method: 'PUT',
    expires: expiresInSeconds,
  })

  return {
    providerId: params.providerId,
    objectKey: location.objectKey,
    uploadUrl,
    fileUrl: location.fileUrl,
    expiresInSeconds,
  }
}

export async function resolveUserObjectStorageProviderId(params: {
  userId: string
  teamId?: string | null
}) {
  if (params.teamId) {
    const team = await prisma.team.findUnique({
      where: { id: params.teamId },
      select: { storageProviderId: true },
    })
    return normalizeObjectStorageProviderId(team?.storageProviderId)
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      teamId: true,
      team: {
        select: {
          storageProviderId: true,
        },
      },
    },
  })

  return normalizeObjectStorageProviderId(user?.team?.storageProviderId)
}

export async function createObjectStorageUploadTarget(params: {
  userId: string
  teamId?: string | null
  fileName: string
  prefix?: string
  expiresInSeconds?: number
}) {
  const providerId = await resolveUserObjectStorageProviderId({
    userId: params.userId,
    teamId: params.teamId,
  })

  return createUploadTarget({
    providerId,
    userId: params.userId,
    fileName: params.fileName,
    prefix: params.prefix,
    expiresInSeconds: params.expiresInSeconds,
  })
}

export async function createObjectStorageObjectLocationForUser(params: {
  userId: string
  teamId?: string | null
  fileName: string
  prefix?: string
}) {
  const providerId = await resolveUserObjectStorageProviderId({
    userId: params.userId,
    teamId: params.teamId,
  })
  assertObjectStorageProviderConfigured(providerId)

  return buildObjectLocation({
    providerId,
    userId: params.userId,
    fileName: params.fileName,
    prefix: params.prefix,
  })
}

function isSuccessfulTosFetchTaskState(state: string | null | undefined) {
  const normalized = (state || '').trim().toLowerCase()
  return normalized === 'succeed' || normalized === 'fetchsuccesscallbackerror'
}

function isFailedTosFetchTaskState(state: string | null | undefined) {
  const normalized = (state || '').trim().toLowerCase()
  return normalized === 'failed'
}

async function waitForTosFetchTask(params: {
  client: TosClient
  bucket: string
  taskId: string
}) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < TOS_FETCH_TASK_TIMEOUT_MS) {
    const result = await params.client.getFetchTask({
      bucket: params.bucket,
      taskId: params.taskId,
    })
    const state = result.data.State || ''

    if (isSuccessfulTosFetchTaskState(state)) {
      return result
    }

    if (isFailedTosFetchTaskState(state)) {
      throw new Error(result.data.Err || `TOS 远端抓取失败: ${state}`)
    }

    await new Promise((resolve) => setTimeout(resolve, TOS_FETCH_TASK_POLL_INTERVAL_MS))
  }

  throw new Error('TOS 远端抓取超时')
}

export async function fetchRemoteUrlToUserObjectStorage(params: {
  userId: string
  teamId?: string | null
  sourceUrl: string
  fileName: string
  prefix?: string
  contentType?: string | null
}): Promise<RemoteFetchUploadResult> {
  const location = await createObjectStorageObjectLocationForUser({
    userId: params.userId,
    teamId: params.teamId,
    fileName: params.fileName,
    prefix: params.prefix,
  })

  if (location.providerId !== 'tos') {
    throw new Error('当前对象存储不支持服务端直连抓取')
  }

  const config = getTosConfig()
  const client = getTosClient()
  const task = await client.putFetchTask({
    bucket: config.bucket,
    key: location.objectKey,
    url: params.sourceUrl,
    ignoreSameKey: true,
    headers: params.contentType
      ? {
          'content-type': params.contentType,
        }
      : undefined,
  })

  await waitForTosFetchTask({
    client,
    bucket: config.bucket,
    taskId: task.data.TaskId,
  })

  const head = await client.headObject({
    bucket: config.bucket,
    key: location.objectKey,
  })
  const contentLength =
    head.headers['content-length']
    || head.data['content-length']
    || '0'
  const resolvedContentType = [
    head.headers['content-type'],
    head.data['content-type'],
    params.contentType,
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0) || null

  return {
    ...location,
    size: Math.max(0, Number.parseInt(contentLength, 10) || 0),
    contentType: resolvedContentType,
  }
}

export async function uploadBufferForUser(params: {
  userId: string
  teamId?: string | null
  fileName: string
  body: Buffer
  contentType: string
  prefix?: string
}) {
  const providerId = await resolveUserObjectStorageProviderId({
    userId: params.userId,
    teamId: params.teamId,
  })
  assertObjectStorageProviderConfigured(providerId)

  const location = buildObjectLocation({
    providerId,
    userId: params.userId,
    fileName: params.fileName,
    prefix: params.prefix,
  })

  await putObject({
    providerId,
    objectKey: location.objectKey,
    body: params.body,
    contentType: params.contentType,
  })

  return {
    providerId,
    objectKey: location.objectKey,
    fileUrl: location.fileUrl,
  }
}

export async function uploadStreamForUser(params: {
  userId: string
  teamId?: string | null
  fileName: string
  body: Readable
  contentType: string
  contentLength?: number
  prefix?: string
}) {
  const providerId = await resolveUserObjectStorageProviderId({
    userId: params.userId,
    teamId: params.teamId,
  })
  assertObjectStorageProviderConfigured(providerId)

  const location = buildObjectLocation({
    providerId,
    userId: params.userId,
    fileName: params.fileName,
    prefix: params.prefix,
  })

  await putObject({
    providerId,
    objectKey: location.objectKey,
    body: params.body,
    contentType: params.contentType,
    contentLength: params.contentLength,
  })

  return {
    providerId,
    objectKey: location.objectKey,
    fileUrl: location.fileUrl,
  }
}
