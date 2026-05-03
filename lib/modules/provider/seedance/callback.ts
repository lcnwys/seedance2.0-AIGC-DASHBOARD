import type { NextRequest } from 'next/server'

const DEFAULT_CALLBACK_PATH = '/api/webhook/video'

type CallbackMode = 'auto' | 'disabled' | 'force'

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '')
}

function isLoopbackHost(hostname: string) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname)
}

function isPrivateIpv4(hostname: string) {
  const segments = hostname.split('.').map((segment) => Number(segment))
  if (segments.length !== 4 || segments.some((segment) => Number.isNaN(segment))) {
    return false
  }

  if (segments[0] === 10) return true
  if (segments[0] === 127) return true
  if (segments[0] === 192 && segments[1] === 168) return true
  if (segments[0] === 172 && segments[1] >= 16 && segments[1] <= 31) return true
  return false
}

function isPublicCallbackHostname(hostname: string) {
  const normalizedHostname = hostname.trim().toLowerCase()
  if (!normalizedHostname) return false
  if (isLoopbackHost(normalizedHostname)) return false
  if (normalizedHostname.endsWith('.local')) return false
  if (isPrivateIpv4(normalizedHostname)) return false
  return true
}

function getRequestBaseUrl(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host')?.trim()

  if (!host) {
    return request.nextUrl.origin
  }

  const protocol = forwardedProto || request.nextUrl.protocol.replace(':', '') || 'https'
  return `${protocol}://${host}`
}

function getCallbackMode(): CallbackMode {
  const mode = process.env.TASK_CALLBACK_MODE?.trim().toLowerCase()
  if (mode === 'disabled' || mode === 'force') {
    return mode
  }
  return 'auto'
}

export function getTaskWebhookSecret() {
  return process.env.TASK_WEBHOOK_SECRET?.trim() || ''
}

export function resolvePublicAppBaseUrl(request?: NextRequest) {
  const configuredBaseUrl = process.env.APP_PUBLIC_BASE_URL?.trim()
  const mode = getCallbackMode()
  const candidateBaseUrl = configuredBaseUrl || (request ? getRequestBaseUrl(request) : '')

  if (!candidateBaseUrl) {
    return null
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(normalizeBaseUrl(candidateBaseUrl))
  } catch {
    return null
  }

  if (mode !== 'force' && !isPublicCallbackHostname(parsedUrl.hostname)) {
    return null
  }

  return normalizeBaseUrl(parsedUrl.toString())
}

export function buildVideoTaskCallbackUrl(request?: NextRequest) {
  const mode = getCallbackMode()
  if (mode === 'disabled') {
    return null
  }

  const webhookSecret = getTaskWebhookSecret()
  if (!webhookSecret) {
    if (mode === 'force') {
      throw new Error('TASK_WEBHOOK_SECRET is required when TASK_CALLBACK_MODE=force')
    }
    return null
  }

  const baseUrl = resolvePublicAppBaseUrl(request)
  if (!baseUrl) {
    if (mode === 'force') {
      throw new Error('Unable to resolve a public callback URL. Check APP_PUBLIC_BASE_URL.')
    }
    return null
  }

  const callbackUrl = new URL(DEFAULT_CALLBACK_PATH, `${baseUrl}/`)
  callbackUrl.searchParams.set('token', webhookSecret)
  return callbackUrl.toString()
}
