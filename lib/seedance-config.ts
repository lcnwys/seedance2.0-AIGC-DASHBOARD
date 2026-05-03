import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import {
  DEFAULT_VIDEO_PROVIDER_ID,
  getVideoGenerationProvider,
} from '@/lib/modules/provider/registry'
import type { VideoGenerationProviderId } from '@/lib/modules/provider/types'
import {
  getConfigurableGenerationProvider,
  isVideoConfigurableProviderId,
  normalizeConfigurableProviderId,
  type ConfigurableProviderId,
} from '@/lib/modules/provider/configurable-providers'

export interface TeamProviderConfigResolved {
  providerId: ConfigurableProviderId
  apiKey: string
  apiUrl: string
  apiKeyConfigured: boolean
  isEnabled: boolean
}

// Backward-compatible alias while video call sites are migrated to generic provider naming.
export type TeamVideoProviderConfig = TeamProviderConfigResolved

// Backward-compatible alias for existing Seedance-only call sites.
export interface SeedanceConfig {
  apiKey: string
  apiUrl: string
}

type TeamProviderConfigLike = {
  providerId?: string | null
  apiKeyEncrypted?: string | null
  apiUrl?: string | null
  isEnabled?: boolean | null
}

type LegacyTeamFieldsLike = {
  seedanceApiKey?: string | null
  seedanceApiUrl?: string | null
}

type TeamProviderSource = LegacyTeamFieldsLike & {
  defaultVideoProviderId?: string | null
  providerConfigs?: TeamProviderConfigLike[] | null
}

export function normalizeVideoProviderId(
  providerId: string | null | undefined
): VideoGenerationProviderId {
  return isVideoConfigurableProviderId(providerId)
    ? providerId
    : DEFAULT_VIDEO_PROVIDER_ID
}

export function normalizeTeamProviderConfigId(
  providerId: string | null | undefined
): ConfigurableProviderId {
  return normalizeConfigurableProviderId(providerId)
}

const DEFAULT_API_URL =
  process.env.ARK_API_URL?.trim() || getVideoGenerationProvider(DEFAULT_VIDEO_PROVIDER_ID).defaultApiUrl

function normalizeProviderApiUrl(
  providerId: ConfigurableProviderId,
  apiUrl: string | null | undefined
) {
  const provider = getConfigurableGenerationProvider(providerId)
  const trimmed = apiUrl?.trim()

  if (!trimmed) {
    return provider.defaultApiUrl || DEFAULT_API_URL
  }

  const lower = trimmed.toLowerCase()

  if (providerId === 'aliyun' && lower.includes('volces.com')) {
    return provider.defaultApiUrl || trimmed
  }

  if (providerId === 'volcengine' && lower.includes('aliyuncs.com')) {
    return provider.defaultApiUrl || DEFAULT_API_URL
  }

  if (providerId === 'grsai' && (lower.includes('volces.com') || lower.includes('aliyuncs.com'))) {
    return provider.defaultApiUrl
  }

  return trimmed
}

export function resolveProviderConfig(input?: TeamProviderConfigLike): TeamProviderConfigResolved {
  const providerId = normalizeTeamProviderConfigId(input?.providerId)
  const apiKey = input?.apiKeyEncrypted ? decrypt(input.apiKeyEncrypted) : ''
  const apiUrl = normalizeProviderApiUrl(providerId, input?.apiUrl)

  return {
    providerId,
    apiKey,
    apiUrl,
    apiKeyConfigured: Boolean(apiKey),
    isEnabled: input?.isEnabled !== false,
  }
}

export function resolveVideoProviderConfig(input?: TeamProviderConfigLike): TeamVideoProviderConfig {
  return resolveProviderConfig(input)
}

export function resolveTeamProviderConfig(
  team: TeamProviderSource | null | undefined,
  requestedProviderId?: string | null
): TeamProviderConfigResolved {
  const providerId = normalizeTeamProviderConfigId(requestedProviderId || team?.defaultVideoProviderId)
  const matchedConfig = team?.providerConfigs?.find((config) => config.providerId === providerId)

  if (matchedConfig) {
    return resolveProviderConfig(matchedConfig)
  }

  // Transitional fallback for legacy volcengine fields stored directly on Team.
  if (providerId === 'volcengine') {
    return resolveProviderConfig({
      providerId,
      apiKeyEncrypted: team?.seedanceApiKey || null,
      apiUrl: team?.seedanceApiUrl || null,
      isEnabled: true,
    })
  }

  return resolveProviderConfig({ providerId })
}

export function resolveTeamVideoProviderConfig(
  team: TeamProviderSource | null | undefined,
  requestedProviderId?: string | null
): TeamVideoProviderConfig {
  return resolveTeamProviderConfig(team, requestedProviderId)
}

export async function getTeamProviderConfigByTeamId(
  teamId: string,
  providerId?: string | null
): Promise<TeamProviderConfigResolved | null> {
  const team = await (prisma as any).team.findUnique({
    where: { id: teamId },
    select: {
      defaultVideoProviderId: true,
      seedanceApiKey: true,
      seedanceApiUrl: true,
      providerConfigs: {
        select: {
          providerId: true,
          apiKeyEncrypted: true,
          apiUrl: true,
          isEnabled: true,
        },
      },
    },
  })

  if (!team) {
    return null
  }

  return resolveTeamProviderConfig(team, providerId)
}

export async function getTeamVideoProviderConfigByTeamId(
  teamId: string,
  providerId?: string | null
): Promise<TeamVideoProviderConfig | null> {
  return getTeamProviderConfigByTeamId(teamId, providerId)
}

export async function getUserProviderConfig(
  userId: string,
  providerId?: string | null
): Promise<TeamProviderConfigResolved | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true },
    }) as any

    if (!user?.teamId) {
      return null
    }

    return getTeamProviderConfigByTeamId(user.teamId, providerId)
  } catch (error) {
    console.error('Get team provider config error:', error)
    return null
  }
}

export async function getUserVideoProviderConfig(
  userId: string,
  providerId?: string | null
): Promise<TeamVideoProviderConfig | null> {
  return getUserProviderConfig(userId, providerId)
}

/**
 * Get Seedance API configuration for a user's team
 * Backward compatible helper while current business logic still defaults to volcengine.
 */
export async function getSeedanceConfig(userId: string): Promise<SeedanceConfig | null> {
  const config = await getUserProviderConfig(userId, 'volcengine')
  if (!config?.apiKeyConfigured) {
    return null
  }

  return {
    apiKey: config.apiKey,
    apiUrl: config.apiUrl,
  }
}

/**
 * Get API URL only (for cases where we don't need the key)
 */
export async function getSeedanceApiUrl(userId: string): Promise<string> {
  const config = await getUserProviderConfig(userId, 'volcengine')
  return config?.apiUrl || DEFAULT_API_URL
}
