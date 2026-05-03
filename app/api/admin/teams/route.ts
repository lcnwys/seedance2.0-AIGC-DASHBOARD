import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { maskApiKey } from '@/lib/crypto'
import { resolveTeamProviderConfig } from '@/lib/seedance-config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/teams
 * 系统管理员接口：获取所有团队列表及本地统计数据
 * 仅 isSuperAdmin=true 的用户可访问
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 验证是否为系统管理员
    const currentUser = await (prisma.user.findUnique as any)({
      where: { id: payload.userId },
      select: { isSuperAdmin: true },
    })

    if (!currentUser?.isSuperAdmin) {
      return NextResponse.json({ error: '权限不足：仅系统管理员可访问' }, { status: 403 })
    }

    // 获取时间范围参数
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // 构建时间过滤条件
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      // 设置为当天结束
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0

    // 获取所有团队
    const teams = await (prisma as any).team.findMany({
      include: {
        providerConfigs: true,
        members: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            usedTokens: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 为每个团队计算本地统计数据
    const teamsWithStats = await Promise.all(
      teams.map(async (team: any) => {
        const defaultProviderConfig = resolveTeamProviderConfig(team)
        const memberIds = team.members.map((m: any) => m.id)

        // 查询该团队所有成功任务的统计
        const taskStats = await prisma.generationTask.aggregate({
          where: {
            userId: { in: memberIds },
            status: 'succeeded',
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          _sum: {
            totalTokens: true,
          },
          _count: true,
        })

        // 计算费用 (需要单独查询包含 costYuan 和 billingType 的任务)
        const costStats = await prisma.generationTask.findMany({
          where: {
            userId: { in: memberIds },
            status: 'succeeded',
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          select: { costYuan: true, billingType: true, totalTokens: true },
        })
        const totalCostYuan = costStats.reduce((sum: number, t: any) => sum + (t.costYuan || 0), 0)
        
        // 按计费类型分类统计
        const withVideoTasks = costStats.filter((t: any) => t.billingType === 'with_video')
        const withoutVideoTasks = costStats.filter((t: any) => t.billingType === 'without_video')
        const billingStats = {
          withVideo: {
            taskCount: withVideoTasks.length,
            tokens: withVideoTasks.reduce((sum: number, t: any) => sum + (t.totalTokens || 0), 0),
            cost: withVideoTasks.reduce((sum: number, t: any) => sum + (t.costYuan || 0), 0),
          },
          withoutVideo: {
            taskCount: withoutVideoTasks.length,
            tokens: withoutVideoTasks.reduce((sum: number, t: any) => sum + (t.totalTokens || 0), 0),
            cost: withoutVideoTasks.reduce((sum: number, t: any) => sum + (t.costYuan || 0), 0),
          },
        }

        // 按用户分组统计
        const memberStats = await Promise.all(
          team.members.map(async (member: any) => {
            const stats = await prisma.generationTask.aggregate({
              where: {
                userId: member.id,
                status: 'succeeded',
                ...(hasDateFilter ? { createdAt: dateFilter } : {}),
              },
              _sum: {
                totalTokens: true,
              },
              _count: true,
            })

            const memberCostStats = await prisma.generationTask.findMany({
              where: {
                userId: member.id,
                status: 'succeeded',
                ...(hasDateFilter ? { createdAt: dateFilter } : {}),
              },
              select: { costYuan: true },
            })
            const memberCostYuan = memberCostStats.reduce((sum: number, t: any) => sum + (t.costYuan || 0), 0)

            return {
              id: member.id,
              email: member.email,
              name: member.name,
              role: member.role,
              localStats: {
                taskCount: stats._count,
                totalTokens: stats._sum.totalTokens || 0,
                costYuan: memberCostYuan,
              },
            }
          })
        )

        return {
          id: team.id,
          name: team.name,
          description: team.description,
          defaultVideoProviderId: defaultProviderConfig.providerId,
          // API Key 脱敏显示
          seedanceApiKey: defaultProviderConfig.apiKeyConfigured ? maskApiKey(defaultProviderConfig.apiKey) : null,
          seedanceApiUrl: defaultProviderConfig.apiUrl,
          hasApiKey: defaultProviderConfig.apiKeyConfigured,
          createdAt: team.createdAt,
          // 团队级别统计（本地）
          localStats: {
            taskCount: taskStats._count,
            totalTokens: taskStats._sum.totalTokens || 0,
            costYuan: totalCostYuan,
          },
          // 按计费类型分类统计
          billingStats,
          // 成员列表及各自统计
          members: memberStats,
          memberCount: team.members.length,
        }
      })
    )

    // 汇总所有团队数据
    const summary = {
      teamCount: teams.length,
      totalTasks: teamsWithStats.reduce((sum: number, t: any) => sum + t.localStats.taskCount, 0),
      totalTokens: teamsWithStats.reduce((sum: number, t: any) => sum + t.localStats.totalTokens, 0),
      totalCostYuan: teamsWithStats.reduce((sum: number, t: any) => sum + t.localStats.costYuan, 0),
    }

    return NextResponse.json({
      teams: teamsWithStats,
      summary,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    })
  } catch (error: any) {
    console.error('Admin teams API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
