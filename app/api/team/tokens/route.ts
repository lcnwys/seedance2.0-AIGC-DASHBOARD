import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import {
  DEFAULT_SEEDANCE_MODEL,
  FAST_SEEDANCE_MODEL,
  getSeedanceBillingRangeLabel,
  getSeedanceBillingRate,
} from '@/lib/modules/provider/seedance/models'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const TOKEN_PRICE = {
  [DEFAULT_SEEDANCE_MODEL]: {
    label: 'Seedance 2.0',
    withVideo: {
      tokensPerUnit: 1_000_000,
      pricePerUnit: getSeedanceBillingRate(DEFAULT_SEEDANCE_MODEL, 'with_video'),
    },
    withoutVideo: {
      tokensPerUnit: 1_000_000,
      pricePerUnit: getSeedanceBillingRate(DEFAULT_SEEDANCE_MODEL, 'without_video'),
    },
  },
  [FAST_SEEDANCE_MODEL]: {
    label: 'Seedance 2.0 Fast',
    withVideo: {
      tokensPerUnit: 1_000_000,
      pricePerUnit: getSeedanceBillingRate(FAST_SEEDANCE_MODEL, 'with_video'),
    },
    withoutVideo: {
      tokensPerUnit: 1_000_000,
      pricePerUnit: getSeedanceBillingRate(FAST_SEEDANCE_MODEL, 'without_video'),
    },
  },
}

export function tokensToYuan(
  tokens: number | bigint,
  hasVideoInput: boolean,
  model: string = DEFAULT_SEEDANCE_MODEL
): number {
  const tokenNum = typeof tokens === 'bigint' ? Number(tokens) : tokens
  const pricePerUnit = getSeedanceBillingRate(model, hasVideoInput ? 'with_video' : 'without_video')
  return (tokenNum / 1_000_000) * pricePerUnit
}

const PRICE_CONFIG = {
  models: TOKEN_PRICE,
  billingRanges: {
    withVideo: getSeedanceBillingRangeLabel('with_video'),
    withoutVideo: getSeedanceBillingRangeLabel('without_video'),
  },
}

// Get team budget info (admin only)
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

    // Get current user with team
    const currentUser = await (prisma.user.findUnique as any)({
      where: { id: payload.userId },
      include: { team: true },
    })

    if (!currentUser || !currentUser.teamId) {
      return NextResponse.json({ error: 'User not in a team' }, { status: 400 })
    }

    const team = currentUser.team!

    // Get all members' budget allocation
    const members = await (prisma.user.findMany as any)({
      where: { teamId: currentUser.teamId },
      select: {
        id: true,
        name: true,
        allocatedBudget: true,
        usedBudget: true,
        reservedBudget: true,
        allocatedTokens: true,
        usedTokens: true,
      },
    })

    // Calculate totals (in cents)
    const totalAllocatedCents = members.reduce((sum: number, m: any) => sum + Number(m.allocatedBudget || 0), 0)
    const totalUsedCents = members.reduce((sum: number, m: any) => sum + Number(m.usedBudget || 0), 0)
    const teamTotalBudgetCents = Number(team.totalBudget || 0)
    const unallocatedCents = teamTotalBudgetCents - totalAllocatedCents

    // If admin, return full team view
    if (currentUser.role === 'admin') {
      return NextResponse.json({
        team: {
          id: team.id,
          name: team.name,
          // 预算信息（元）
          totalBudgetYuan: (teamTotalBudgetCents / 100).toFixed(2),
          usedBudgetYuan: (Number(team.usedBudget || 0) / 100).toFixed(2),
          allocatedBudgetYuan: (totalAllocatedCents / 100).toFixed(2),
          unallocatedBudgetYuan: (unallocatedCents / 100).toFixed(2),
          // Token统计（用于对账）
          totalTokens: team.totalTokens?.toString() || '0',
          usedTokens: team.usedTokens?.toString() || '0',
        },
        members: members.map((m: any) => {
          const allocatedCents = Number(m.allocatedBudget || 0)
          const usedCents = Number(m.usedBudget || 0)
          const reservedCents = Number(m.reservedBudget || 0)
          return {
            id: m.id,
            name: m.name,
            // 预算信息（元）
            allocatedBudgetYuan: (allocatedCents / 100).toFixed(2),
            usedBudgetYuan: (usedCents / 100).toFixed(2),
            reservedBudgetYuan: (reservedCents / 100).toFixed(2),
            availableBudgetYuan: ((allocatedCents - usedCents - reservedCents) / 100).toFixed(2),
            // Token统计（用于对账）
            allocatedTokens: m.allocatedTokens?.toString() || '0',
            usedTokens: m.usedTokens?.toString() || '0',
          }
        }),
        priceConfig: PRICE_CONFIG,
      })
    }

    // For regular members, return only their own info
    const userAllocatedCents = Number(currentUser.allocatedBudget || 0)
    const userUsedCents = Number(currentUser.usedBudget || 0)
    const userReservedCents = Number(currentUser.reservedBudget || 0)
    
    return NextResponse.json({
      user: {
        id: currentUser.id,
        name: currentUser.name,
        allocatedBudgetYuan: (userAllocatedCents / 100).toFixed(2),
        usedBudgetYuan: (userUsedCents / 100).toFixed(2),
        reservedBudgetYuan: (userReservedCents / 100).toFixed(2),
        availableBudgetYuan: ((userAllocatedCents - userUsedCents - userReservedCents) / 100).toFixed(2),
      },
      priceConfig: PRICE_CONFIG,
    })
  } catch (error) {
    console.error('Get budget info error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Add budget to team pool (admin only) - 充值以元为单位
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get current user
    const currentUser = await (prisma.user.findUnique as any)({
      where: { id: payload.userId },
    })

    if (!currentUser || currentUser.role !== 'admin' || !currentUser.teamId) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { amountYuan, description } = await request.json()

    if (!amountYuan || amountYuan <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const budgetToAddCents = Math.round(amountYuan * 100)  // 元 -> 分

    // Update team's total budget
    const updatedTeam = await (prisma.team.update as any)({
      where: { id: currentUser.teamId },
      data: {
        totalBudget: { increment: budgetToAddCents },
      },
    })

    return NextResponse.json({
      success: true,
      team: {
        id: updatedTeam.id,
        name: updatedTeam.name,
        totalBudgetYuan: (Number(updatedTeam.totalBudget || 0) / 100).toFixed(2),
        usedBudgetYuan: (Number(updatedTeam.usedBudget || 0) / 100).toFixed(2),
      },
      addedYuan: amountYuan.toFixed(2),
      description: description || '手动充值',
    })
  } catch (error) {
    console.error('Add budget error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Allocate budget to a member (admin only) - 分配以元为单位
export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get current user
    const currentUser = await (prisma.user.findUnique as any)({
      where: { id: payload.userId },
      include: { team: true },
    })

    if (!currentUser || currentUser.role !== 'admin' || !currentUser.teamId) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { memberId, allocatedBudgetYuan } = await request.json()

    if (!memberId || allocatedBudgetYuan === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify member belongs to same team
    const member = await (prisma.user.findFirst as any)({
      where: {
        id: memberId,
        teamId: currentUser.teamId,
      },
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const newAllocationCents = Math.round(allocatedBudgetYuan * 100)  // 元 -> 分
    const memberUsedCents = Number(member.usedBudget || 0)

    // Ensure new allocation is not less than used budget
    if (newAllocationCents < memberUsedCents) {
      return NextResponse.json({
        error: `不能低于已使用金额: ¥${(memberUsedCents / 100).toFixed(2)}`,
      }, { status: 400 })
    }

    // Calculate available pool
    const allocatedSum = await (prisma.user.aggregate as any)({
      where: {
        teamId: currentUser.teamId,
        id: { not: memberId },
      },
      _sum: { allocatedBudget: true },
    })

    const otherAllocatedCents = Number(allocatedSum._sum.allocatedBudget || 0)
    const team = currentUser.team!
    const teamTotalBudgetCents = Number(team.totalBudget || 0)
    const availableForMemberCents = teamTotalBudgetCents - otherAllocatedCents

    if (newAllocationCents > availableForMemberCents) {
      return NextResponse.json({
        error: `无法分配更多预算。最大可用: ¥${(availableForMemberCents / 100).toFixed(2)}`,
      }, { status: 400 })
    }

    // Update member's allocation
    const updatedMember = await (prisma.user.update as any)({
      where: { id: memberId },
      data: { allocatedBudget: BigInt(newAllocationCents) },
    })

    const updatedAllocatedCents = Number(updatedMember.allocatedBudget || 0)
    const updatedUsedCents = Number(updatedMember.usedBudget || 0)
    const updatedReservedCents = Number(updatedMember.reservedBudget || 0)

    return NextResponse.json({
      success: true,
      member: {
        id: updatedMember.id,
        name: updatedMember.name,
        allocatedBudgetYuan: (updatedAllocatedCents / 100).toFixed(2),
        usedBudgetYuan: (updatedUsedCents / 100).toFixed(2),
        reservedBudgetYuan: (updatedReservedCents / 100).toFixed(2),
        availableBudgetYuan: ((updatedAllocatedCents - updatedUsedCents - updatedReservedCents) / 100).toFixed(2),
      },
    })
  } catch (error) {
    console.error('Allocate budget error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
