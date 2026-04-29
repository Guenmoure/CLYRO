'use client'

/**
 * NewProjectDropdown — "+ New" button that expands into a 4-item dropdown.
 *
 * Project types:
 *   1. Faceless Video  → /faceless/new
 *   2. AI Avatar       → /studio/new
 *   3. Motion Design   → /motion/new
 *   4. Brand Kit       → /brand
 *
 * Closes on outside click, Escape, or item selection.
 */

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Video, Film, Sparkles, Palette, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProjectType {
  titleKey:    string
  descKey:     string
  href:        string
  icon:        React.ElementType
  iconColor:   string
  iconBg:      string
}

const PROJECT_TYPES: ProjectType[] = [
  {
    titleKey:    'npd_faceless_title',
    descKey:     'npd_faceless_desc',
    href:        '/faceless/new',
    icon:        Video,
    iconColor:   'text-blue-400',
    iconBg:      'bg-blue-500/10',
  },
  {
    titleKey:    'npd_avatar_title',
    descKey:     'npd_avatar_desc',
    href:        '/studio/new',
    icon:        Film,
    iconColor:   'text-rose-400',
    iconBg:      'bg-rose-500/10',
  },
  {
    titleKey:    'npd_motion_title',
    descKey:     'npd_motion_desc',
    href:        '/motion/new',
    icon:        Sparkles,
    iconColor:   'text-purple-400',
    iconBg:      'bg-purple-500/10',
  },
  {
    titleKey:    'npd_brand_title',
    descKey:     'npd_brand_desc',
    href:        '/brand',
    icon:        Palette,
    iconColor:   'text-cyan-400',
    iconBg:      'bg-cyan-400/10',
  },
]

// ── Component ──────────────────────────────────────────────────────────────────

export function NewProjectDropdown() {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const containerRef    = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-new-project
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl',
          'bg-blue-500 hover:bg-blue-400 active:bg-blue-600',
          'px-4 py-2 h-9',
          'font-display text-sm font-semibold text-white',
          'shadow-sm hover:shadow-md',
          'transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        <Plus size={15} />
        {t('npd_new')}
        <ChevronDown
          size={13}
          className={cn('transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 top-11 z-50 w-72',
            'bg-card border border-border rounded-2xl shadow-xl overflow-hidden',
            'animate-in fade-in-0 slide-in-from-top-2 duration-150',
          )}
        >
          <p className="px-4 py-2.5 border-b border-border font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">
            {t('npd_choose_type')}
          </p>

          <div className="p-1.5 space-y-0.5">
            {PROJECT_TYPES.map((type) => {
              const Icon = type.icon
              return (
                <Link
                  key={type.href}
                  href={type.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl',
                    'hover:bg-muted transition-colors duration-100',
                    'focus-visible:outline-none focus-visible:bg-muted',
                    'group',
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                    type.iconBg,
                  )}>
                    <Icon size={16} className={type.iconColor} />
                  </div>

                  {/* Text */}
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-foreground leading-tight">
                      {t(type.titleKey)}
                    </p>
                    <p className="font-mono text-xs text-[--text-muted] mt-0.5 truncate">
                      {t(type.descKey)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
