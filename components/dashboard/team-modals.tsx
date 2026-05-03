'use client'

import { useEffect, useState } from 'react'
import { DashboardSelect } from '@/components/dashboard/dashboard-select'
import { getAllConfigurableGenerationProviders } from '@/lib/modules/provider/configurable-providers'

type TeamInfoLike = {
  totalBudgetYuan?: string
  unallocatedBudgetYuan?: string
  totalTokens?: string
}

type TeamMemberLike = {
  id: string
  name: string
  isActive?: boolean
  allocatedBudgetYuan?: string
  usedBudgetYuan?: string
  allocatedTokens?: string
}

type ActionResult = {
  success: boolean
  error?: string
}

type MemberUpdates = {
  name: FormDataEntryValue | null
  isActive: boolean
  password?: string
}

export function TeamSettingsModal(props: {
  open: boolean
  onClose: () => void
  isConfigAdmin: boolean
  apiKeyConfigured: boolean
  videoProviderId: string
  apiKey: string
  seedanceUrl: string
  storageProviderId: 'tos' | 'oss'
  storageProviders: Array<{ id: 'tos' | 'oss'; label: string; configured: boolean }>
  maxConcurrentTasks: number
  maxRequestsPerMinute: number
  memberCooldownSeconds: number
  savingConfig: boolean
  onVideoProviderIdChange: (value: string) => void
  onApiKeyChange: (value: string) => void
  onSeedanceUrlChange: (value: string) => void
  onStorageProviderIdChange: (value: 'tos' | 'oss') => void
  onMaxConcurrentTasksChange: (value: number) => void
  onMaxRequestsPerMinuteChange: (value: number) => void
  onMemberCooldownSecondsChange: (value: number) => void
  onSave: () => void
}) {
  const {
    open,
    onClose,
    isConfigAdmin,
    apiKeyConfigured,
    videoProviderId,
    apiKey,
    seedanceUrl,
    storageProviderId,
    storageProviders,
    maxConcurrentTasks,
    maxRequestsPerMinute,
    memberCooldownSeconds,
    savingConfig,
    onVideoProviderIdChange,
    onApiKeyChange,
    onSeedanceUrlChange,
    onStorageProviderIdChange,
    onMaxConcurrentTasksChange,
    onMaxRequestsPerMinuteChange,
    onMemberCooldownSecondsChange,
    onSave,
  } = props

  if (!open) return null

  const allProviders = getAllConfigurableGenerationProviders()
  const selectedProvider = allProviders.find((provider) => provider.id === videoProviderId) || allProviders[0]
  const formatProviderKinds = (kinds: string[]) => kinds
    .map((kind) => {
      if (kind === 'video') return '视频'
      if (kind === 'image') return '图片'
      if (kind === 'text') return '文本'
      return kind
    })
    .join(' / ')
  const effectiveStorageProviders = storageProviders.length > 0
    ? storageProviders
    : [
        { id: 'tos' as const, label: '火山 TOS', configured: true },
        { id: 'oss' as const, label: '阿里云 OSS', configured: false },
      ]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center px-3 py-4 sm:items-center sm:px-4">
        <div className="glass flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-700">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-4 backdrop-blur sm:px-6">
            <h3 className="text-lg font-semibold text-zinc-100">团队配置</h3>
            <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="max-h-[calc(100vh-9rem)] overflow-y-auto px-4 py-4 sm:px-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded ${isConfigAdmin ? 'bg-green-600/20 text-green-400' : 'bg-zinc-700 text-zinc-400'}`}>
                  {isConfigAdmin ? '管理员' : '成员'}
                </span>
                {!isConfigAdmin && <span className="text-zinc-500">只有管理员可以修改配置</span>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">Provider</label>
                <DashboardSelect
                  value={videoProviderId}
                  onChange={(value) => isConfigAdmin && onVideoProviderIdChange(value)}
                  disabled={!isConfigAdmin}
                  options={allProviders.map((provider) => ({
                    value: provider.id,
                    label: provider.label,
                    description: `已接入：${formatProviderKinds(provider.implementedKinds)}`,
                  }))}
                />
                <p className="mt-1 text-xs text-zinc-500">
                  {selectedProvider.label} 平台能力：{formatProviderKinds(selectedProvider.capabilities)}；当前系统已接入：{formatProviderKinds(selectedProvider.implementedKinds)}。
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">
                  {selectedProvider.label} API Key
                  {apiKeyConfigured && <span className="ml-2 text-xs text-green-400">✓ 已配置</span>}
                </label>
                <input
                  type={isConfigAdmin ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => isConfigAdmin && onApiKeyChange(e.target.value)}
                  placeholder={isConfigAdmin ? '留空表示保留当前密钥' : '出于安全考虑不显示'}
                  readOnly={!isConfigAdmin}
                  className={`w-full rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-zinc-100 placeholder-zinc-500 transition-all ${
                    isConfigAdmin ? 'focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20' : 'cursor-not-allowed opacity-70'
                  }`}
                />
                <p className="mt-1 text-xs text-zinc-500">
                  {isConfigAdmin ? '为降低密钥暴露风险，这里不回填当前值；留空保存会保留原密钥' : '出于安全考虑，不向成员展示团队密钥与上游地址'}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">Provider 服务器地址</label>
                <input
                  type="text"
                  value={seedanceUrl}
                  onChange={(e) => isConfigAdmin && onSeedanceUrlChange(e.target.value)}
                  placeholder={isConfigAdmin ? selectedProvider.defaultApiUrl : '出于安全考虑不显示'}
                  readOnly={!isConfigAdmin}
                  className={`w-full rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-zinc-100 placeholder-zinc-500 transition-all ${
                    isConfigAdmin ? 'focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20' : 'cursor-not-allowed opacity-70'
                  }`}
                />
                <p className="mt-1 text-xs text-zinc-500">{isConfigAdmin ? '如果你使用不同地域或专属接入点，可在这里覆盖默认地址。' : '成员无需感知上游地址配置'}</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">对象存储</label>
                <DashboardSelect
                  value={storageProviderId}
                  onChange={(value) => isConfigAdmin && onStorageProviderIdChange(value as 'tos' | 'oss')}
                  disabled={!isConfigAdmin}
                  options={effectiveStorageProviders.map((provider) => ({
                    value: provider.id,
                    label: provider.label,
                    description: provider.configured ? undefined : '未配置环境变量',
                    disabled: !provider.configured,
                  }))}
                />
                <p className="mt-1 text-xs text-zinc-500">
                  {isConfigAdmin
                    ? '上传素材和生成结果转存都会走这里选择的对象存储。AK/SK 只从服务端环境变量读取，不会暴露给前端。'
                    : '成员无需感知对象存储配置'}
                </p>
              </div>

              <div className="space-y-4 border-t border-zinc-800 pt-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-400">团队最大并发任务数</label>
                  <input
                    type="number"
                    min={1}
                    value={maxConcurrentTasks}
                    onChange={(e) => isConfigAdmin && onMaxConcurrentTasksChange(parseInt(e.target.value, 10) || 1)}
                    readOnly={!isConfigAdmin}
                    className={`w-full rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-zinc-100 transition-all ${
                      isConfigAdmin ? 'focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20' : 'cursor-not-allowed opacity-70'
                    }`}
                  />
                  <p className="mt-1 text-xs text-zinc-500">限制团队同时处于处理中或待确认状态的任务数量，适合控制培训班整体并发。</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-400">团队每分钟最大提交数</label>
                  <input
                    type="number"
                    min={1}
                    value={maxRequestsPerMinute}
                    onChange={(e) => isConfigAdmin && onMaxRequestsPerMinuteChange(parseInt(e.target.value, 10) || 1)}
                    readOnly={!isConfigAdmin}
                    className={`w-full rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-zinc-100 transition-all ${
                      isConfigAdmin ? 'focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20' : 'cursor-not-allowed opacity-70'
                    }`}
                  />
                  <p className="mt-1 text-xs text-zinc-500">控制一分钟内整队最多提交多少次，避免被上游判定为异常流量。</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-400">成员提交冷却秒数</label>
                  <input
                    type="number"
                    min={0}
                    value={memberCooldownSeconds}
                    onChange={(e) => isConfigAdmin && onMemberCooldownSecondsChange(parseInt(e.target.value, 10) || 0)}
                    readOnly={!isConfigAdmin}
                    className={`w-full rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-zinc-100 transition-all ${
                      isConfigAdmin ? 'focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20' : 'cursor-not-allowed opacity-70'
                    }`}
                  />
                  <p className="mt-1 text-xs text-zinc-500">限制单个成员两次提交之间的最短间隔。培训场景建议 10-30 秒。</p>
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 border-t border-zinc-800 bg-zinc-950/95 px-4 py-4 backdrop-blur sm:px-6">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-800"
              >
                关闭
              </button>
              {isConfigAdmin && (
                <button
                  onClick={onSave}
                  disabled={savingConfig}
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-medium text-white transition-all hover:from-blue-500 hover:to-purple-500 disabled:opacity-50"
                >
                  {savingConfig ? '保存中...' : '保存团队配置'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AddMemberModal(props: {
  open: boolean
  onClose: () => void
  onSubmit: (email: string, name: string, password: string) => Promise<ActionResult>
}) {
  const { open, onClose, onSubmit } = props
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl border border-zinc-700 w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-zinc-100">添加团队成员</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const result = await onSubmit(
              formData.get('email') as string,
              formData.get('name') as string,
              formData.get('password') as string,
            )
            if (!result.success) {
              alert(result.error)
            }
          }}
          className="p-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">姓名</label>
            <input name="name" required className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-zinc-100 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">邮箱</label>
            <input name="email" type="email" required className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-zinc-100 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">密码</label>
            <input name="password" type="password" required minLength={6} className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-zinc-100 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <button type="submit" className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90">
            添加成员
          </button>
        </form>
      </div>
    </div>
  )
}

export function EditMemberModal(props: {
  open: boolean
  member: TeamMemberLike | null
  onClose: () => void
  onSubmit: (memberId: string, updates: MemberUpdates) => Promise<ActionResult>
}) {
  const { open, member, onClose, onSubmit } = props
  const [isActiveValue, setIsActiveValue] = useState('true')

  useEffect(() => {
    if (member) {
      setIsActiveValue(member.isActive ? 'true' : 'false')
    }
  }, [member])

  if (!open || !member) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl border border-zinc-700 w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-zinc-100">编辑成员: {member.name}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const updates: MemberUpdates = {
              name: formData.get('name'),
              isActive: isActiveValue === 'true',
            }
            const newPassword = formData.get('password') as string
            if (newPassword) updates.password = newPassword
            const result = await onSubmit(member.id, updates)
            if (!result.success) {
              alert(result.error)
            }
          }}
          className="p-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">姓名</label>
            <input name="name" defaultValue={member.name} required className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-zinc-100 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">重置密码（留空不修改）</label>
            <input name="password" type="password" minLength={6} placeholder="输入新密码" className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">账号状态</label>
            <DashboardSelect
              value={isActiveValue}
              onChange={setIsActiveValue}
              options={[
                { value: 'true', label: '活跃' },
                { value: 'false', label: '禁用' },
              ]}
            />
          </div>
          <button type="submit" className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90">
            保存修改
          </button>
        </form>
      </div>
    </div>
  )
}

export function RechargeBudgetModal(props: {
  open: boolean
  teamInfo: TeamInfoLike | null
  onClose: () => void
  onSubmit: (amountYuan: number) => Promise<ActionResult>
}) {
  const { open, teamInfo, onClose, onSubmit } = props
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl border border-zinc-700 w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-zinc-100">💰 充值团队预算</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const amountYuan = parseFloat(formData.get('amountYuan') as string)
            if (amountYuan > 0) {
              const result = await onSubmit(amountYuan)
              if (!result.success) {
                alert(result.error)
              }
            }
          }}
          className="p-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">充值金额（元）</label>
            <input name="amountYuan" type="number" step="0.01" required min={0.01} placeholder="例如: 100.00" className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="p-3 bg-zinc-800/50 rounded-lg">
            <p className="text-sm text-zinc-400">当前团队预算池: <span className="text-green-400">¥{teamInfo?.totalBudgetYuan || '0.00'}</span></p>
          </div>
          <button type="submit" className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:opacity-90">
            确认充值
          </button>
        </form>
      </div>
    </div>
  )
}

export function AllocateBudgetModal(props: {
  open: boolean
  member: TeamMemberLike | null
  teamInfo: TeamInfoLike | null
  onClose: () => void
  onSubmit: (memberId: string, allocationYuan: number) => Promise<ActionResult>
}) {
  const { open, member, teamInfo, onClose, onSubmit } = props
  if (!open || !member) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl border border-zinc-700 w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-zinc-100">调整 {member.name} 的预算</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const newAllocationYuan = parseFloat(formData.get('allocationYuan') as string)
            const result = await onSubmit(member.id, newAllocationYuan)
            if (!result.success) {
              alert(result.error)
            }
          }}
          className="p-4 space-y-4"
        >
          <div className="p-3 bg-zinc-800/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">当前预算:</span>
              <span className="text-zinc-200">¥{member.allocatedBudgetYuan || '0.00'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">已用:</span>
              <span className="text-orange-400">¥{member.usedBudgetYuan || '0.00'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">团队未分配:</span>
              <span className="text-blue-400">¥{teamInfo?.unallocatedBudgetYuan || '0.00'}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">新预算（元）</label>
            <input
              name="allocationYuan"
              type="number"
              step="0.01"
              required
              min={parseFloat(member.usedBudgetYuan || '0')}
              defaultValue={member.allocatedBudgetYuan || '0.00'}
              className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-zinc-100 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="text-xs text-zinc-500 mt-1">最小值: ¥{member.usedBudgetYuan || '0.00'} (已使用量)</p>
          </div>
          <button type="submit" className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90">
            确认调整
          </button>
        </form>
      </div>
    </div>
  )
}
