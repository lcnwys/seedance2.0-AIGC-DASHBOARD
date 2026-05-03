'use client'

type TeamInfo = {
  name?: string
  totalBudgetYuan?: string
  unallocatedBudgetYuan?: string
}

type TeamMember = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  allocatedBudgetYuan?: string
  usedBudgetYuan?: string
  reservedBudgetYuan?: string
  availableBudgetYuan?: string
  taskCount?: number
}

type TeamManagementPanelProps = {
  teamInfo: TeamInfo | null
  teamMembers: TeamMember[]
  currentUserId?: string
  onOpenRechargeModal: () => void
  onOpenAddMemberModal: () => void
  onOpenAllocateModal: (member: TeamMember) => void
  onOpenEditMemberModal: (member: TeamMember) => void
  onDeleteMember: (memberId: string) => Promise<{ success: boolean; error?: string }>
}

export function TeamManagementPanel({
  teamInfo,
  teamMembers,
  currentUserId,
  onOpenRechargeModal,
  onOpenAddMemberModal,
  onOpenAllocateModal,
  onOpenEditMemberModal,
  onDeleteMember,
}: TeamManagementPanelProps) {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-6 border border-zinc-800">
          <p className="text-sm text-zinc-400">团队名称</p>
          <p className="text-xl font-bold text-zinc-100 mt-2">{teamInfo?.name || '-'}</p>
        </div>
        <div className="glass rounded-2xl p-6 border border-zinc-800">
          <p className="text-sm text-zinc-400">团队预算池</p>
          <p className="text-2xl font-bold gradient-text mt-2">¥{teamInfo?.totalBudgetYuan || '0.00'}</p>
        </div>
        <div className="glass rounded-2xl p-6 border border-zinc-800">
          <p className="text-sm text-zinc-400">未分配预算</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">¥{teamInfo?.unallocatedBudgetYuan || '0.00'}</p>
        </div>
        <div className="glass rounded-2xl p-6 border border-zinc-800">
          <p className="text-sm text-zinc-400">团队成员</p>
          <p className="text-2xl font-bold text-zinc-100 mt-2">{teamMembers.length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onOpenRechargeModal}
          className="rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2 text-white font-medium transition-opacity hover:opacity-90"
        >
          💰 充值预算
        </button>
        <button
          onClick={onOpenAddMemberModal}
          className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-white font-medium transition-opacity hover:opacity-90"
        >
          ➕ 添加成员
        </button>
      </div>

      <div className="glass rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-zinc-100">团队成员列表</h3>
        </div>
        <div className="space-y-3 p-4 lg:hidden">
          {teamMembers.map((member) => (
            <div key={member.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-zinc-100">
                    {member.name}
                    {member.id === currentUserId ? <span className="ml-2 text-xs text-blue-400">(我)</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{member.email}</div>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs ${
                    member.role === 'admin'
                      ? 'border border-purple-500/30 bg-purple-500/10 text-purple-400'
                      : 'border border-zinc-600 bg-zinc-700/50 text-zinc-400'
                  }`}
                >
                  {member.role === 'admin' ? '管理员' : '成员'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-zinc-800/50 p-3">
                  <div className="text-xs text-zinc-500">状态</div>
                  <div className={`mt-1 ${member.isActive ? 'text-green-400' : 'text-red-400'}`}>
                    {member.isActive ? '活跃' : '禁用'}
                  </div>
                </div>
                <div className="rounded-xl bg-zinc-800/50 p-3">
                  <div className="text-xs text-zinc-500">分配预算</div>
                  <div className="mt-1 text-blue-400">¥{member.allocatedBudgetYuan || '0.00'}</div>
                </div>
                <div className="rounded-xl bg-zinc-800/50 p-3">
                  <div className="text-xs text-zinc-500">已用 / 预扣</div>
                  <div className="mt-1 text-orange-400">¥{member.usedBudgetYuan || '0.00'}</div>
                  <div className="text-xs text-yellow-400">预扣 ¥{member.reservedBudgetYuan || '0.00'}</div>
                </div>
                <div className="rounded-xl bg-zinc-800/50 p-3">
                  <div className="text-xs text-zinc-500">任务数</div>
                  <div className="mt-1 text-zinc-300">{member.taskCount || 0}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => onOpenAllocateModal(member)}
                  className="rounded bg-blue-600/20 px-2 py-1 text-xs text-blue-400 border border-blue-500/30 hover:bg-blue-600/30"
                >
                  调预算
                </button>
                <button
                  onClick={() => onOpenEditMemberModal(member)}
                  className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
                >
                  编辑
                </button>
                {member.id !== currentUserId ? (
                  <button
                    onClick={async () => {
                      if (!confirm(`确定删除成员 ${member.name} 吗？`)) return
                      const result = await onDeleteMember(member.id)
                      if (!result.success) {
                        alert(result.error)
                      }
                    }}
                    className="rounded border border-red-500/30 bg-red-600/20 px-2 py-1 text-xs text-red-400 hover:bg-red-600/30"
                  >
                    删除
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">姓名</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">邮箱</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">角色</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">状态</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">分配预算</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">已用/预扣</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">任务数</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((member) => (
                <tr key={member.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-sm text-zinc-100">
                    {member.name}
                    {member.id === currentUserId && <span className="ml-2 text-xs text-blue-400">(我)</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{member.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        member.role === 'admin'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                          : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600'
                      }`}
                    >
                      {member.role === 'admin' ? '管理员' : '成员'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        member.isActive
                          ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {member.isActive ? '活跃' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-blue-400">¥{member.allocatedBudgetYuan || '0.00'}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-orange-400">¥{member.usedBudgetYuan || '0.00'}</div>
                    <div className="text-xs text-yellow-400">预扣: ¥{member.reservedBudgetYuan || '0.00'}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{member.taskCount || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onOpenAllocateModal(member)}
                        className="px-2 py-1 text-xs rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30"
                      >
                        调预算
                      </button>
                      <button
                        onClick={() => onOpenEditMemberModal(member)}
                        className="px-2 py-1 text-xs rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                      >
                        编辑
                      </button>
                      {member.id !== currentUserId && (
                        <button
                          onClick={async () => {
                            if (!confirm(`确定删除成员 ${member.name} 吗？`)) return
                            const result = await onDeleteMember(member.id)
                            if (!result.success) {
                              alert(result.error)
                            }
                          }}
                          className="px-2 py-1 text-xs rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
