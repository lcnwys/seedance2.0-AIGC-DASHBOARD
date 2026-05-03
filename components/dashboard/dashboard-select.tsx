'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type DashboardSelectOption = {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

type DashboardSelectProps = {
  value: string
  options: DashboardSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function DashboardSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = '请选择',
  className = '',
}: DashboardSelectProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuStyle, setMenuStyle] = useState({ left: 0, top: 0, width: 0 })
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    setMenuStyle({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    })
  }, [])

  useEffect(() => {
    if (!open) return

    updateMenuPosition()

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      const clickedTrigger = rootRef.current?.contains(target)
      const clickedMenu = menuRef.current?.contains(target)

      if (!clickedTrigger && !clickedMenu) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  const menu = open && !disabled ? (
    <div
      ref={menuRef}
      className="fixed z-[9999] max-h-72 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950/95 shadow-2xl shadow-black/50 backdrop-blur"
      style={{
        left: menuStyle.left,
        top: menuStyle.top,
        width: menuStyle.width,
      }}
    >
      <div className="max-h-72 overflow-y-auto p-1">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={option.disabled}
              onClick={() => {
                if (option.disabled) return
                onChange(option.value)
                setOpen(false)
              }}
              className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                option.disabled
                  ? 'cursor-not-allowed text-zinc-700'
                  : selected
                    ? 'bg-blue-500/15 text-blue-100'
                    : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100'
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate">{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block truncate text-xs text-zinc-500">{option.description}</span>
                ) : null}
              </span>
              {selected ? (
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  ) : null

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`group flex min-h-[42px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-all ${
          disabled
            ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/30 text-zinc-600'
            : open
              ? 'border-blue-500/50 bg-zinc-900 text-zinc-100 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]'
              : 'border-zinc-700 bg-zinc-900/60 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedOption?.label || placeholder}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180 text-blue-300' : 'group-hover:text-zinc-300'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
