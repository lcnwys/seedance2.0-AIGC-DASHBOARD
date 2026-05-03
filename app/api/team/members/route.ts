import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { requireAdminRole, requireSessionUser, requireTeamMembership } from '@/lib/modules/auth/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Get team members (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionUser(request, {
      include: { team: true },
    })
    if ('response' in session) {
      return session.response
    }
    const currentUser = session.user

    const teamGuard = requireTeamMembership(currentUser)
    if (teamGuard) {
      return teamGuard.response
    }

    const adminGuard = requireAdminRole(currentUser)
    if (adminGuard) {
      return adminGuard.response
    }

    // Get all team members with budget info
    const members = await (prisma.user.findMany as any)({
      where: { teamId: currentUser.teamId! },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        allocatedTokens: true,
        usedTokens: true,
        allocatedBudget: true,
        usedBudget: true,
        reservedBudget: true,
        createdAt: true,
        _count: {
          select: { generationTasks: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Get team info
    const team = await (prisma.team.findUnique as any)({
      where: { id: currentUser.teamId! },
    })

    // Calculate totals (in cents)
    const totalAllocatedCents = members.reduce((sum: number, m: any) => sum + Number(m.allocatedBudget || 0), 0)
    const teamTotalBudgetCents = Number(team?.totalBudget || 0)
    const unallocatedCents = teamTotalBudgetCents - totalAllocatedCents

    return NextResponse.json({
      team: {
        id: team?.id,
        name: team?.name,
        // 预算信息（元）- 主要使用
        totalBudgetYuan: (teamTotalBudgetCents / 100).toFixed(2),
        usedBudgetYuan: (Number(team?.usedBudget || 0) / 100).toFixed(2),
        allocatedBudgetYuan: (totalAllocatedCents / 100).toFixed(2),
        unallocatedBudgetYuan: (unallocatedCents / 100).toFixed(2),
        // Token信息（兼容旧版，用于对账）
        totalTokens: team?.totalTokens?.toString() || '0',
        usedTokens: team?.usedTokens?.toString() || '0',
      },
      members: members.map((m: any) => {
        const allocatedCents = Number(m.allocatedBudget || 0)
        const usedCents = Number(m.usedBudget || 0)
        const reservedCents = Number(m.reservedBudget || 0)
        return {
          id: m.id,
          email: m.email,
          name: m.name,
          role: m.role,
          isActive: m.isActive,
          createdAt: m.createdAt,
          taskCount: m._count.generationTasks,
          // 预算信息（元）- 主要使用
          allocatedBudgetYuan: (allocatedCents / 100).toFixed(2),
          usedBudgetYuan: (usedCents / 100).toFixed(2),
          reservedBudgetYuan: (reservedCents / 100).toFixed(2),
          availableBudgetYuan: ((allocatedCents - usedCents - reservedCents) / 100).toFixed(2),
          // Token信息（兼容旧版）
          allocatedTokens: m.allocatedTokens?.toString() || '0',
          usedTokens: m.usedTokens?.toString() || '0',
        }
      }),
    })
  } catch (error) {
    console.error('Get members error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create new team member (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }
    const currentUser = session.user

    const teamGuard = requireTeamMembership(currentUser)
    if (teamGuard) {
      return teamGuard.response
    }

    const adminGuard = requireAdminRole(currentUser)
    if (adminGuard) {
      return adminGuard.response
    }

    const { email, name, password, allocatedTokens, allocatedBudgetYuan } = await request.json()

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    // Check team budget pool has enough budget
    const team = await prisma.team.findUnique({
      where: { id: currentUser.teamId! },
    }) as any

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // 预算分配（元 -> 分）
    const requestedBudgetCents = Math.round((allocatedBudgetYuan || 0) * 100)
    
    // 计算已分配的预算
    const allocatedSum = await (prisma.user.aggregate as any)({
      where: { teamId: currentUser.teamId! },
      _sum: { allocatedBudget: true },
    })
    
    const totalAllocated = Number(allocatedSum._sum.allocatedBudget || 0)
    const teamTotalBudget = Number(team.totalBudget || 0)
    const remainingPool = teamTotalBudget - totalAllocated

    if (requestedBudgetCents > remainingPool) {
      return NextResponse.json({ 
        error: `团队预算不足。可用：¥${(remainingPool / 100).toFixed(2)}` 
      }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)

    // 兼容旧的 allocatedTokens 参数
    const requestedTokens = BigInt(allocatedTokens || 0)

    // Create new member
    const newMember = await (prisma.user.create as any)({
      data: {
        email,
        name,
        password: hashedPassword,
        role: 'member',
        teamId: currentUser.teamId!,
        allocatedTokens: requestedTokens,  // 兼容旧字段
        allocatedBudget: BigInt(requestedBudgetCents),  // 新预算字段
      },
    })

    return NextResponse.json({
      member: {
        id: newMember.id,
        email: newMember.email,
        name: newMember.name,
        role: newMember.role,
        isActive: newMember.isActive,
        allocatedTokens: newMember.allocatedTokens.toString(),
        allocatedBudgetYuan: (Number(newMember.allocatedBudget || 0) / 100).toFixed(2),
        usedTokens: newMember.usedTokens.toString(),
        usedBudgetYuan: (Number(newMember.usedBudget || 0) / 100).toFixed(2),
      },
    })
  } catch (error) {
    console.error('Create member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Update team member (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }
    const currentUser = session.user

    const teamGuard = requireTeamMembership(currentUser)
    if (teamGuard) {
      return teamGuard.response
    }

    const adminGuard = requireAdminRole(currentUser)
    if (adminGuard) {
      return adminGuard.response
    }

    const { memberId, name, isActive, allocatedTokens, allocatedBudgetYuan, password } = await request.json()

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID required' }, { status: 400 })
    }

    // Verify member belongs to same team
    const member = await (prisma.user.findFirst as any)({
      where: {
        id: memberId,
        teamId: currentUser.teamId!,
      },
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Prevent admin from disabling themselves
    if (memberId === currentUser.id && isActive === false) {
      return NextResponse.json({ error: 'Cannot disable your own account' }, { status: 400 })
    }

    // Build update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (isActive !== undefined) updateData.isActive = isActive
    
    // Handle budget allocation change (新)
    if (allocatedBudgetYuan !== undefined) {
      const newAllocationCents = Math.round(allocatedBudgetYuan * 100)
      const team = await (prisma.team.findUnique as any)({
        where: { id: currentUser.teamId! },
      })

      // Calculate available pool
      const allocatedSum = await (prisma.user.aggregate as any)({
        where: { 
          teamId: currentUser.teamId!,
          id: { not: memberId }, // Exclude current member
        },
        _sum: { allocatedBudget: true },
      })
      
      const otherAllocated = Number(allocatedSum._sum.allocatedBudget || 0)
      const teamTotalBudget = Number(team?.totalBudget || 0)
      const availableForMember = teamTotalBudget - otherAllocated

      if (newAllocationCents > availableForMember) {
        return NextResponse.json({ 
          error: `无法分配更多预算。最大可用：¥${(availableForMember / 100).toFixed(2)}` 
        }, { status: 400 })
      }

      // Ensure allocation is not less than used budget
      const memberUsedBudget = Number(member.usedBudget || 0)
      if (newAllocationCents < memberUsedBudget) {
        return NextResponse.json({ 
          error: `不能低于已使用金额：¥${(memberUsedBudget / 100).toFixed(2)}` 
        }, { status: 400 })
      }

      updateData.allocatedBudget = BigInt(newAllocationCents)
    }
    
    // Handle token allocation change (兼容旧接口)
    if (allocatedTokens !== undefined) {
      const newAllocation = BigInt(allocatedTokens)
      const team = await (prisma.team.findUnique as any)({
        where: { id: currentUser.teamId! },
      })

      // Calculate available pool
      const allocatedSum = await (prisma.user.aggregate as any)({
        where: { 
          teamId: currentUser.teamId!,
          id: { not: memberId }, // Exclude current member
        },
        _sum: { allocatedTokens: true },
      })
      
      const otherAllocated = allocatedSum._sum.allocatedTokens || BigInt(0)
      const availableForMember = (team?.totalTokens || BigInt(0)) - otherAllocated

      if (newAllocation > availableForMember) {
        return NextResponse.json({ 
          error: `Cannot allocate more than available. Max: ${availableForMember.toString()}` 
        }, { status: 400 })
      }

      // Ensure allocation is not less than used tokens
      if (newAllocation < member.usedTokens) {
        return NextResponse.json({ 
          error: `Cannot reduce below used tokens: ${member.usedTokens.toString()}` 
        }, { status: 400 })
      }

      updateData.allocatedTokens = newAllocation
    }

    // Handle password reset
    if (password) {
      updateData.password = await hashPassword(password)
    }

    const updatedMember = await (prisma.user.update as any)({
      where: { id: memberId },
      data: updateData,
    })

    return NextResponse.json({
      member: {
        id: updatedMember.id,
        email: updatedMember.email,
        name: updatedMember.name,
        role: updatedMember.role,
        isActive: updatedMember.isActive,
        allocatedTokens: updatedMember.allocatedTokens?.toString() || '0',
        allocatedBudgetYuan: (Number(updatedMember.allocatedBudget || 0) / 100).toFixed(2),
        usedTokens: updatedMember.usedTokens?.toString() || '0',
        usedBudgetYuan: (Number(updatedMember.usedBudget || 0) / 100).toFixed(2),
      },
    })
  } catch (error) {
    console.error('Update member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Delete team member (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSessionUser(request)
    if ('response' in session) {
      return session.response
    }
    const currentUser = session.user

    const teamGuard = requireTeamMembership(currentUser)
    if (teamGuard) {
      return teamGuard.response
    }

    const adminGuard = requireAdminRole(currentUser)
    if (adminGuard) {
      return adminGuard.response
    }

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('id')

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID required' }, { status: 400 })
    }

    // Prevent admin from deleting themselves
    if (memberId === currentUser.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Verify member belongs to same team
    const member = await prisma.user.findFirst({
      where: {
        id: memberId,
        teamId: currentUser.teamId!,
      },
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Delete member (this will cascade delete their assets and tasks)
    await prisma.user.delete({
      where: { id: memberId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
