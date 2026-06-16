'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  Search,
  LayoutDashboard,
  FolderOpen,
  Image,
  Settings,
  CreditCard,
  Video,
  Sparkles,
  UserSquare2,
  Palette,
  SunMoon,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandItem {
  id: string
  label: string
  category: string
  icon: React.ReactNode
  shortcut?: string
  href?: string
  action?: () => void
}

// ---------------------------------------------------------------------------
// Static command list (built inside the component so hooks are available)
// ---------------------------------------------------------------------------

function useCommandItems(): CommandItem[] {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { t } = useLanguage()

  return [
    // Navigation
    {
      id: 'nav-dashboard',
      label: t('cp_dashboard'),
      category: t('cp_catNavigation'),
      icon: <LayoutDashboard size={16} strokeWidth={1.5} />,
      shortcut: 'G D',
      href: '/dashboard',
    },
    {
      id: 'nav-projects',
      label: t('cp_projects'),
      category: t('cp_catNavigation'),
      icon: <FolderOpen size={16} strokeWidth={1.5} />,
      shortcut: 'G P',
      href: '/projects',
    },
    {
      id: 'nav-assets',
      label: t('cp_assets'),
      category: t('cp_catNavigation'),
      icon: <Image size={16} strokeWidth={1.5} />,
      href: '/assets',
    },
    {
      id: 'nav-settings',
      label: t('cp_settings'),
      category: t('cp_catNavigation'),
      icon: <Settings size={16} strokeWidth={1.5} />,
      shortcut: 'G S',
      href: '/settings',
    },
    {
      id: 'nav-billing',
      label: t('cp_billing'),
      category: t('cp_catNavigation'),
      icon: <CreditCard size={16} strokeWidth={1.5} />,
      href: '/settings/billing',
    },
    // Create
    {
      id: 'create-faceless',
      label: t('cp_newFaceless'),
      category: t('cp_catCreate'),
      icon: <Video size={16} strokeWidth={1.5} />,
      shortcut: 'N F',
      href: '/faceless/new',
    },
    {
      id: 'create-motion',
      label: t('cp_newMotion'),
      category: t('cp_catCreate'),
      icon: <Sparkles size={16} strokeWidth={1.5} />,
      shortcut: 'N M',
      href: '/motion/new',
    },
    {
      id: 'create-avatar',
      label: t('cp_newAvatar'),
      category: t('cp_catCreate'),
      icon: <UserSquare2 size={16} strokeWidth={1.5} />,
      shortcut: 'N A',
      href: '/studio/new',
    },
    {
      id: 'create-brand',
      label: t('cp_newBrand'),
      category: t('cp_catCreate'),
      icon: <Palette size={16} strokeWidth={1.5} />,
      shortcut: 'N B',
      href: '/brand/new',
    },
    // Quick
    {
      id: 'quick-theme',
      label: t('cp_toggleTheme'),
      category: t('cp_catQuick'),
      icon: <SunMoon size={16} strokeWidth={1.5} />,
      action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    },
    {
      id: 'quick-analytics',
      label: t('cp_viewAnalytics'),
      category: t('cp_catQuick'),
      icon: <BarChart3 size={16} strokeWidth={1.5} />,
      href: '/analytics',
    },
  ]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByCategory(items: CommandItem[]): Map<string, CommandItem[]> {
  const map = new Map<string, CommandItem[]>()
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, [])
    map.get(item.category)!.push(item)
  }
  return map
}

// Flatten grouped map to an ordered flat list (preserving visual order)
function flattenGroups(groups: Map<string, CommandItem[]>): CommandItem[] {
  return Array.from(groups.values()).flat()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const router = useRouter()
  const { t } = useLanguage()
  const allItems = useCommandItems()

  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const [active, setActive] = useState(0)

  const inputRef    = useRef<HTMLInputElement>(null)
  const listRef     = useRef<HTMLUListElement>(null)
  const activeRef   = useRef<HTMLLIElement>(null)

  // Filtered + grouped items
  const filtered = query.trim()
    ? allItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()),
      )
    : allItems

  const groups  = groupByCategory(filtered)
  const flatList = flattenGroups(groups)

  // Clamp active index whenever filtered list changes
  useEffect(() => {
    setActive(prev => Math.min(prev, Math.max(0, flatList.length - 1)))
  }, [flatList.length])

  // Scroll active item into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  // Global keyboard shortcut to open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Auto-focus input when palette opens; reset state when it closes
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // rAF so the DOM is visible before focus
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  function runItem(item: CommandItem) {
    close()
    if (item.action) {
      item.action()
    } else if (item.href) {
      router.push(item.href)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive(prev => (prev + 1) % flatList.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive(prev => (prev - 1 + flatList.length) % flatList.length)
        break
      case 'Enter':
        e.preventDefault()
        if (flatList[active]) runItem(flatList[active])
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
    }
  }

  if (!open) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Close when clicking the backdrop, not the modal
        if (e.target === e.currentTarget) close()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Modal */}
      <div
        className={cn(
          'w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl',
          'flex flex-col overflow-hidden',
        )}
        onKeyDown={onKeyDown}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-[--text-muted]"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder={t('cp_search')}
            className={cn(
              'flex-1 bg-transparent outline-none',
              'font-body text-sm text-foreground placeholder:text-[--text-muted]',
            )}
            aria-label="Search commands"
            autoComplete="off"
            spellCheck={false}
          />
          {/* Esc hint */}
          <kbd className="font-mono text-[11px] text-[--text-muted] bg-muted px-1.5 py-0.5 rounded hidden sm:block">
            esc
          </kbd>
        </div>

        {/* Results */}
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          className="overflow-y-auto max-h-[min(60vh,380px)] py-2"
        >
          {flatList.length === 0 ? (
            <li className="px-4 py-8 text-center font-body text-sm text-[--text-muted]">
              {t('cp_noResults')} &ldquo;{query}&rdquo;
            </li>
          ) : (
            Array.from(groups.entries()).map(([category, items]) => {
              // Track offset of first item in this group within the flatList
              const groupStartIndex = flatList.indexOf(items[0])

              return (
                <li key={category} role="presentation">
                  {/* Category header */}
                  <div className="px-4 pt-3 pb-1">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">
                      {category}
                    </span>
                  </div>

                  {/* Items */}
                  <ul role="group" aria-label={category}>
                    {items.map((item, i) => {
                      const flatIndex = groupStartIndex + i
                      const isActive  = flatIndex === active

                      return (
                        <li
                          key={item.id}
                          ref={isActive ? activeRef : undefined}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActive(flatIndex)}
                          onMouseDown={(e) => {
                            e.preventDefault() // prevent input blur
                            runItem(item)
                          }}
                          className={cn(
                            'flex items-center gap-3 mx-2 px-3 py-2 rounded-xl cursor-pointer select-none',
                            'transition-colors duration-100',
                            isActive
                              ? 'bg-accent text-accent-foreground'
                              : 'text-foreground hover:bg-accent/40',
                          )}
                        >
                          {/* Icon */}
                          <span
                            className={cn(
                              'shrink-0',
                              isActive ? 'text-accent-foreground' : 'text-[--text-secondary]',
                            )}
                          >
                            {item.icon}
                          </span>

                          {/* Label */}
                          <span className="flex-1 font-body text-sm truncate">
                            {item.label}
                          </span>

                          {/* Shortcut hint */}
                          {item.shortcut && (
                            <span className="font-mono text-[11px] text-[--text-muted] bg-muted px-1.5 py-0.5 rounded shrink-0">
                              {item.shortcut}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            })
          )}
        </ul>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border">
          <span className="font-mono text-[10px] text-[--text-muted]">
            <kbd className="bg-muted px-1 py-0.5 rounded mr-1">↑↓</kbd>
            {t('cp_navigate')}
          </span>
          <span className="font-mono text-[10px] text-[--text-muted]">
            <kbd className="bg-muted px-1 py-0.5 rounded mr-1">↵</kbd>
            {t('cp_select')}
          </span>
          <span className="font-mono text-[10px] text-[--text-muted] ml-auto">
            <kbd className="bg-muted px-1 py-0.5 rounded mr-1">⌘K</kbd>
            {t('cp_toggle')}
          </span>
        </div>
      </div>
    </div>
  )
}
