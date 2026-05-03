'use client'

import { useMemo, useState, type ReactNode } from 'react'

type DashboardSidebarProps = {
  activeTab: string
  isAdmin: boolean
  onTabChange: (tab: string) => void
  onOpenSettings: () => void
  onLogout: () => void
}

type NavItem = {
  id: string
  label: string
  icon: ReactNode
}

function BrandMark() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg">
      <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  )
}

function isAiTab(tab: string) {
  return tab === 'ai-video'
}

function getTabLabel(tab: string, isAdmin: boolean) {
  if (isAiTab(tab)) return 'AI 生成'
  if (tab === 'assets') return '资产库'
  if (tab === 'tasks') return '任务中心'
  if (tab === 'stats') return '统计概览'
  if (tab === 'team' && isAdmin) return '团队管理'
  return '控制台'
}

export function DashboardSidebar({
  activeTab,
  isAdmin,
  onTabChange,
  onOpenSettings,
  onLogout,
}: DashboardSidebarProps) {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)

  const primaryItems = useMemo<NavItem[]>(() => [
    {
      id: 'ai-video',
      label: 'AI生成',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: 'assets',
      label: '资产',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'tasks',
      label: '任务',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      id: 'stats',
      label: '统计',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    ...(isAdmin
      ? [{
          id: 'team',
          label: '团队',
          icon: (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
        }]
      : []),
  ], [isAdmin])

  const desktopItems = primaryItems
  const mobilePrimaryItems = primaryItems.filter((item) => ['ai-video', 'assets', 'tasks', 'stats'].includes(item.id))
  const mobileSecondaryItems = primaryItems.filter((item) => !['ai-video', 'assets', 'tasks', 'stats'].includes(item.id))

  const isMobilePrimaryActive = (id: string) => (id === 'ai-video' ? isAiTab(activeTab) : activeTab === id)

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#050505]/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-100">Open Creative Studio</div>
              <div className="truncate text-xs text-zinc-500">{getTabLabel(activeTab, isAdmin)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/70 text-zinc-400 transition-colors hover:text-zinc-200"
              aria-label="打开设置"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={() => setMobileMoreOpen((current) => !current)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                mobileMoreOpen
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                  : 'border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:text-zinc-200'
              }`}
              aria-label="打开更多菜单"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {mobileMoreOpen ? (
          <div className="border-t border-zinc-800 bg-zinc-950/95 px-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {mobileSecondaryItems.map((item) => {
                const active = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id)
                      setMobileMoreOpen(false)
                    }}
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm transition-all ${
                      active
                        ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                        : 'border-zinc-800 bg-zinc-900/70 text-zinc-300'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                )
              })}
              <button
                onClick={() => {
                  onOpenSettings()
                  setMobileMoreOpen(false)
                }}
                className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-3 py-3 text-sm text-zinc-300"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>设置</span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-300"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>退出登录</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="hidden h-screen w-20 shrink-0 flex-col items-center border-r border-zinc-800 py-4 glass-dark md:flex">
        <BrandMark />

        <nav className="flex w-full flex-1 flex-col gap-2 px-2 pt-6">
          {desktopItems.map((item) => {
            const active = item.id === 'ai-video' ? isAiTab(activeTab) : activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center gap-1 rounded-xl py-3 transition-all ${
                  active
                    ? 'border border-blue-500/30 bg-gradient-to-br from-blue-600/20 to-purple-600/20 text-blue-400'
                    : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                }`}
              >
                {item.icon}
                <span className="text-[10px]">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex w-full flex-col gap-2 px-2">
          <button
            onClick={onOpenSettings}
            className="flex flex-col items-center gap-1 rounded-xl py-3 text-zinc-500 transition-all hover:bg-zinc-800/50 hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px]">设置</span>
          </button>

          <button
            onClick={onLogout}
            className="flex flex-col items-center gap-1 rounded-xl py-3 text-zinc-500 transition-all hover:bg-red-500/10 hover:text-red-400"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-[10px]">退出</span>
          </button>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800/80 bg-[#050505]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobilePrimaryItems.map((item) => {
            const active = isMobilePrimaryActive(item.id)
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id)
                  setMobileMoreOpen(false)
                }}
                className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] transition-all ${
                  active
                    ? 'bg-gradient-to-br from-blue-600/20 to-purple-600/20 text-blue-400'
                    : 'text-zinc-500'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          })}

          <button
            onClick={() => setMobileMoreOpen((current) => !current)}
            className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] transition-all ${
              mobileMoreOpen || mobileSecondaryItems.some((item) => activeTab === item.id)
                ? 'bg-zinc-800/80 text-zinc-100'
                : 'text-zinc-500'
            }`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <span>更多</span>
          </button>
        </div>
      </nav>
    </>
  )
}
