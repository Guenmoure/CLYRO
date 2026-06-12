'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Palette, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getBrandKits } from '@/lib/api'
import type { BrandKit } from '@clyro/shared'

interface BrandKitPickerProps {
  value: string | null
  onChange: (id: string | null) => void
  className?: string
}

export function BrandKitPicker({ value, onChange, className }: BrandKitPickerProps) {
  const [kits,    setKits]    = useState<BrandKit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadKits() {
      try {
        const { data } = await getBrandKits()
        setKits(data)
        // Auto-sélectionner le kit par défaut si rien n'est sélectionné
        if (!value) {
          const def = data.find((k) => k.is_default)
          if (def) onChange(def.id)
        }
      } catch {
        // Backend unavailable — brand kits optional
      } finally {
        setLoading(false)
      }
    }
    loadKits()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return <div className={cn('h-10 rounded-xl border border-border bg-muted animate-pulse', className)} />
  }

  if (kits.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 text-sm font-body text-[--text-muted]', className)}>
        <Palette size={14} />
        No brand kits —{' '}
        <Link href="/settings/brand" className="text-primary hover:underline">
          create one
        </Link>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {/* "None" option */}
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'px-3 py-2 rounded-xl border text-xs font-mono transition-all',
          !value
            ? 'bg-accent border-brand/40 text-accent-foreground'
            : 'bg-muted hover:bg-muted/80 border border-border text-[--text-muted]'
        )}
      >
        None
      </button>

      {kits.map((kit) => (
        <button
          key={kit.id}
          type="button"
          onClick={() => onChange(kit.id)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-body transition-all',
            value === kit.id
              ? 'ring-2 ring-brand/40 border-brand/30 bg-brand/5 text-foreground'
              : 'bg-muted hover:bg-muted/80 border border-border text-[--text-secondary]'
          )}
        >
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/10"
            style={{ background: kit.primary_color }}
          />
          {kit.secondary_color && (
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/10 -ml-1"
              style={{ background: kit.secondary_color }}
            />
          )}
          {kit.name}
          {kit.is_default && (
            <span className="font-mono text-[11px] text-primary uppercase tracking-wider">★</span>
          )}
        </button>
      ))}

      <Link
        href="/settings/brand"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 border border-border text-xs font-body text-[--text-muted] hover:text-foreground transition-all border-dashed"
      >
        <Plus size={11} />
        New
      </Link>
    </div>
  )
}
