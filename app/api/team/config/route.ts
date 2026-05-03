import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { requireAdminRole, requireSessionUser, requireTeamMembership } from '@/lib/modules/auth/session'
import {
  DEFAULT_VIDEO_PROVIDER_ID,
  getVideoGenerationProvider,
} from '@/lib/modules/provider/registry'
import {
  getAllConfigurableGenerationProviders,
  getConfigurableGenerationProvider,
  isVideoConfigurableProviderId,
} from '@/lib/modules/provider/configurable-providers'
import {
  assertObjectStorageProviderConfigured,
  getObjectStorageProviderOptions,
  normalizeObjectStorageProviderId,
} from '@/lib/object-storage'
import {
  getTeamProviderConfigByTeamId,
  normalizeTeamProviderConfigId,
  resolveTeamProviderConfig,
} from '@/lib/seedance-config'
import { normalizeTeamSubmissionGuard } from '@/lib/modules/team/submission-guard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_PROVIDER = getVideoGenerationProvider(DEFAULT_VIDEO_PROVIDER_ID)

// GET - Return a safe summary by default. Full config is only fetched on-demand by admins.
export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }
    const user = session.user as any

    const teamGuard = requireTeamMembership(user)
    if (teamGuard) {
      return teamGuard.response
    }

    const team = await (prisma as any).team.findUnique({
      where: { id: user.teamId },
      include: {
        providerConfigs: true,
      },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const isAdmin = user.role === 'admin'
    const detail = request.nextUrl.searchParams.get('detail') === 'true'
    const requestedProviderId = request.nextUrl.searchParams.get('providerId')
    const providerConfig = resolveTeamProviderConfig(team, requestedProviderId)

    if (detail) {
      const adminGuard = requireAdminRole(user, 'Only admin can view team config detail')
      if (adminGuard) {
        return adminGuard.response
      }

      return NextResponse.json({
        providerId: providerConfig.providerId,
        apiKey: '',
        apiKeyConfigured: providerConfig.apiKeyConfigured,
        apiUrl: providerConfig.apiUrl,
        storageProviderId: normalizeObjectStorageProviderId((team as any).storageProviderId),
        storageProviders: getObjectStorageProviderOptions(),
        providers: getAllConfigurableGenerationProviders(),
        requestedProviderId: providerConfig.providerId,
        submissionGuard: normalizeTeamSubmissionGuard(team),
        isAdmin: true,
        isSuperAdmin: user.isSuperAdmin || false,
      })
    }

    return NextResponse.json({
      providerId: providerConfig.providerId,
      apiKeyConfigured: providerConfig.apiKeyConfigured,
      apiUrl: providerConfig.apiUrl,
      storageProviderId: normalizeObjectStorageProviderId((team as any).storageProviderId),
      storageProviders: getObjectStorageProviderOptions(),
      providers: getAllConfigurableGenerationProviders(),
      submissionGuard: normalizeTeamSubmissionGuard(team),
      isAdmin,
      isSuperAdmin: user.isSuperAdmin || false,
    })
  } catch (error) {
    console.error('Get team config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update team Seedance config (admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }
    const user = session.user as any

    const teamGuard = requireTeamMembership(user)
    if (teamGuard) {
      return teamGuard.response
    }

    const adminGuard = requireAdminRole(user, 'Only admin can update team config')
    if (adminGuard) {
      return adminGuard.response
    }

    const {
      providerId,
      apiKey,
      apiUrl,
      storageProviderId,
      maxConcurrentTasks,
      maxRequestsPerMinute,
      memberCooldownSeconds,
    } = await request.json()
    const normalizedProviderId = normalizeTeamProviderConfigId(providerId)
    const normalizedStorageProviderId = normalizeObjectStorageProviderId(storageProviderId)
    const provider = getConfigurableGenerationProvider(normalizedProviderId)
    assertObjectStorageProviderConfigured(normalizedStorageProviderId)

    // Build update data
    const updateData: any = {}
    const normalizedApiUrl = typeof apiUrl === 'string' && apiUrl.trim()
      ? apiUrl.trim()
      : provider.defaultApiUrl || DEFAULT_PROVIDER.defaultApiUrl

    if (isVideoConfigurableProviderId(normalizedProviderId)) {
      updateData.defaultVideoProviderId = normalizedProviderId
    }
    updateData.storageProviderId = normalizedStorageProviderId

    if (normalizedProviderId === 'volcengine') {
      updateData.seedanceApiUrl = normalizedApiUrl
      if (typeof apiKey === 'string' && apiKey.trim()) {
        updateData.seedanceApiKey = encrypt(apiKey.trim())
      }
    }

    const normalizedGuard = normalizeTeamSubmissionGuard({
      maxConcurrentTasks,
      maxRequestsPerMinute,
      memberCooldownSeconds,
    })
    updateData.maxConcurrentTasks = normalizedGuard.maxConcurrentTasks
    updateData.maxRequestsPerMinute = normalizedGuard.maxRequestsPerMinute
    updateData.memberCooldownSeconds = normalizedGuard.memberCooldownSeconds

    const team = await prisma.$transaction(async (tx) => {
      const updatedTeam = await (tx as any).team.update({
        where: { id: user.teamId },
        data: updateData,
      })

      const providerConfigData: any = {
        apiUrl: normalizedApiUrl,
        isEnabled: true,
      }
      if (typeof apiKey === 'string' && apiKey.trim()) {
        providerConfigData.apiKeyEncrypted = encrypt(apiKey.trim())
      }

      await (tx as any).teamProviderConfig.upsert({
        where: {
          teamId_providerId: {
            teamId: user.teamId,
            providerId: normalizedProviderId,
          },
        },
        update: providerConfigData,
        create: {
          teamId: user.teamId,
          providerId: normalizedProviderId,
          ...providerConfigData,
        },
      })

      return updatedTeam
    })
    const resolvedConfig = await getTeamProviderConfigByTeamId(user.teamId, normalizedProviderId)

    return NextResponse.json({
      success: true,
      message: 'Team config updated',
      providerId: normalizedProviderId,
      apiKeyConfigured: resolvedConfig?.apiKeyConfigured || false,
      apiUrl: resolvedConfig?.apiUrl || normalizedApiUrl,
      storageProviderId: normalizedStorageProviderId,
      storageProviders: getObjectStorageProviderOptions(),
      providers: getAllConfigurableGenerationProviders(),
      submissionGuard: normalizeTeamSubmissionGuard(team),
    })
  } catch (error) {
    console.error('Update team config error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = /未配置|Missing required environment variable/i.test(message) ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
