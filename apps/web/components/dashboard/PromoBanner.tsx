'use client'

/**
 * PromoBanner — compact 48px dismissable banner at the top of the dashboard.
 * Replaces the heavy 300px HeroBanner carousel.
 *
 * Dismiss is stored in localStorage so it doesn't re-appear after a refresh.
 * The banner rotates among a set of messages on each page load.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Zap, ArrowRight, Mic2, Video, Palette, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Config ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'clyro_promo_dismissed'

interface PromoMessage {
  icon:    React.ElementType
  accent:  string
  text:    string
  cta:     string
  href:    string
}

const MESSAGES: PromoMessage[] = [
  {
    icon:   Mic2,
    accent: 'text-blue-400',
    text:   'Clone your voice once — use it across all your videos.',
    cta:    'Try Voice Clone',
    href:   '/voices',
  },
  {
    icon:   Video,
    accent: 'text-cyan-400',
    text:   'Script to video in 5 steps. Fully automated.',
    cta:    'Start a Faceless video',
    href:   '/faceless/new',
  },
  {
    icon:   Palette,
    accent: 'text-purple-400',
    text:   'Build your brand identity in one click — logo, colors, guidelines.',
    cta:    'Create Brand Kit',
    href:   '/brand',
  },
  {
    icon:   Sparkles,
    accent: 'text-pink-400',
    text:   'Animate any image into a dynamic video clip.',
    cta:    'Try Motion Design',
    href:   '/motion/new',
  },
]

// Pick a deterministic message index based on the day so it feels fresh daily
function getTodayMessageIndex() {
  const day = Math.floor(Date.now() / 86_400_000)
  return day % MESSAGES.length
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PromoBanner() {
  const [visible, setVisible] = useState(false) // start hidden to avoid SSR mismatch

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY)
      if (!dismissed) setVisible(true)
    } catch {
      // localStorage unavailable (e.g. SSR or privacy mode) — just hide banner
    }
  }, [])

  function dismiss() {
    setVisible(false)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* noop */ }
  }

  if (!visible) return null

  const msg  = MESSAGES[getTodayMessageIndex()]
  const Icon = msg.icon

  return (
    <div
      role="banner"
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-border/60 bg-card',
        'px-4 h-12 overflow-hidden',
      )}
    >
      {/* Icon */}
      <Icon size={15} className={cn('shrink-0', msg.accent)} />

      {/* Text */}
      <p className="font-body text-sm text-[--text-secondary] truncate flex-1 min-w-0">
        {msg.text}
      </p>

      {/* CTA */}
      <Link
        href={msg.href}
        className={cn(
          'shrink-0 inline-flex items-center gap-1',
          'font-mono text-xs font-medium',
          msg.accent,
          'hover:opacity-80 transition-opacity',
        )}
      >
        {msg.cta}
        <ArrowRight size={11} />
      </Link>

      {/* Divider */}
      <div className="shrink-0 h-4 w-px bg-border/60" />

      {/* Dismiss */}
      <button
        type="button"
        aria-label="Dismiss banner"
        onClick={dismiss}
        className="shrink-0 -mr-1 p-1 rounded-md text-[--text-muted] hover:text-foreground hover:bg-muted transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  )
}
