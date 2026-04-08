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
    return <div className={cn('h-10 glass rounded-xl animate-pulse', className)} />
  }

  if (kits.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 text-sm font-body text-gray-400 dark:text-white/30', className)}>
        <Palette size={14} />
        Aucun brand kit —{' '}
        <Link href="/settings/brand" className="text-clyro-primary hover:underline">
          en créer un
        </Link>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {/* "Aucun" option */}
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'px-3 py-2 rounded-xl border text-xs font-mono transition-all',
          !value
            ? 'bg-gray-100 dark:bg-white/[0.08] border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/70'
            : 'glass glass-hover border-transparent text-gray-400 dark:text-white/30'
        )}
      >
        Aucun
      </button>

      {kits.map((kit) => (
        <button
          key={kit.id}
          type="button"
          onClick={() => onChange(kit.id)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-body transition-all',
            value === kit.id
              ? 'ring-2 ring-clyro-primary/40 border-clyro-primary/30 bg-clyro-primary/5 text-gray-800 dark:text-white/80'
              : 'glass glass-hover border-transparent text-gray-600 dark:text-white/50'
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
            <span className="font-mono text-[9px] text-clyro-primary uppercase tracking-wider">★</span>
          )}
        </button>
      ))}

      <Link
        href="/settings/brand"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass glass-hover text-xs font-body text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/60 transition-all border border-dashed border-gray-200 dark:border-white/[0.06]"
      >
        <Plus size={11} />
        Nouveau
      </Link>
    </div>
  )
}
