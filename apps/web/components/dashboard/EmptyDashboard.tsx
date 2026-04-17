'use client'

/**
 * EmptyDashboard — shown on first login or when the user has no projects.
 *
 * Contains:
 *   • Floating-shape illustration
 *   • Textarea to paste a script
 *   • "Generate my video" CTA (⌘+Enter shortcut)
 *   • Secondary links to other project types
 */

import { Video, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface EmptyDashboardProps {
  firstName?: string
}

export function EmptyDashboard({ firstName }: EmptyDashboardProps) {
  const router = useRouter()

  function handleGenerate() {
    const textarea = document.querySelector<HTMLTextAreaElement>('[data-empty-script]')
    const text     = textarea?.value?.trim() ?? ''
    if (text.length > 10) {
      router.push(`/faceless/new?script=${encodeURIComponent(text)}`)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">

      {/* ── Floating shapes illustration ── */}
      <div className="relative w-32 h-32 mb-6">
        <div className="absolute w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 top-0 left-4 animate-float" />
        <div className="absolute w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 bottom-2 right-2 animate-float-delayed" />
        <div className="absolute w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 bottom-0 left-0 animate-float-slow" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Video size={28} className="text-[--text-muted]" />
        </div>
      </div>

      {/* ── Heading ── */}
      <h3 className="font-display text-xl font-bold text-foreground">
        {firstName ? `Welcome, ${firstName}!` : 'Create your first video'}
      </h3>
      <p className="font-body text-sm text-[--text-secondary] max-w-sm mt-2 leading-relaxed">
        Paste a script, choose a style, and CLYRO generates your complete video in under 5 minutes.
      </p>

      {/* ── Script textarea ── */}
      <div className="mt-6 w-full max-w-md">
        <textarea
          data-empty-script
          placeholder="Paste your script here to get started..."
          rows={3}
          className={cn(
            'w-full px-4 py-3 rounded-xl font-body text-sm resize-none',
            'bg-muted border border-border',
            'focus:border-blue-500 focus:outline-none',
            'text-foreground placeholder:text-[--text-muted]',
            'transition-colors duration-150',
          )}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleGenerate()
            }
          }}
        />

        <div className="flex items-center justify-between mt-2">
          <span className="font-mono text-[10px] text-[--text-muted]">
            ⌘ + Enter to generate
          </span>
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 hover:shadow-lg transition-all"
          >
            <Zap size={12} />
            Generate my video
          </button>
        </div>
      </div>

      {/* ── Secondary options ── */}
      <p className="font-mono text-xs text-[--text-muted] mt-8">
        or choose directly:
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-3">
        {[
          { label: 'Avatar Studio', href: '/studio/new'  },
          { label: 'Motion Design', href: '/motion/new'  },
          { label: 'Brand Kit',     href: '/brand'       },
        ].map(opt => (
          <button
            key={opt.label}
            type="button"
            onClick={() => router.push(opt.href)}
            className="px-3 py-1.5 rounded-xl text-xs font-body border border-border text-[--text-secondary] hover:border-border/80 hover:text-foreground hover:bg-muted transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
