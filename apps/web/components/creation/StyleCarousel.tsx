'use client'

import { useRef } from 'react'
import { CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StyleConfig {
  id: string
  name: string
  description?: string
  thumbnailUrl?: string
  previewUrl?: string
  pro: boolean
}

interface StyleCarouselProps {
  styles: StyleConfig[]
  selected: string
  onChange: (styleId: string) => void
  userPlan: 'free' | 'pro' | 'studio'
  onProRequired?: () => void
}

// ── StyleCard ──────────────────────────────────────────────────────────────────

function StyleCard({
  style,
  selected,
  locked,
  onChange,
  onLockedClick,
}: {
  style: StyleConfig
  selected: boolean
  locked: boolean
  onChange: (id: string) => void
  onLockedClick: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  function handleMouseEnter() {
    videoRef.current?.play().catch(() => {})
  }
  function handleMouseLeave() {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  return (
    <button
      type="button"
      onClick={() => locked ? onLockedClick() : onChange(style.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 transition-all duration-200 shrink-0 w-56 snap-center text-left',
        selected
          ? 'border-blue-500 shadow-glow-blue'
          : 'border-navy-700 hover:border-navy-500',
      )}
    >
      {/* Thumbnail / Video */}
      <div className="aspect-video bg-navy-800 overflow-hidden relative">
        {style.previewUrl ? (
          <video
            ref={videoRef}
            src={style.previewUrl}
            poster={style.thumbnailUrl}
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : style.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={style.thumbnailUrl} alt={style.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-display text-2xl text-navy-600">
              {style.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-navy-900/90 to-transparent" />

        {/* Name */}
        <p className="absolute bottom-0 left-0 right-0 pb-3 px-3 font-display text-sm text-foreground">
          {style.name}
        </p>

        {/* Selected check */}
        {selected && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
            <CheckCircle size={14} className="text-white" />
          </div>
        )}

        {/* Pro badge */}
        {style.pro && (
          <div className="absolute top-2 left-2">
            <Badge variant="purple">Pro</Badge>
          </div>
        )}

        {/* Locked overlay */}
        {locked && (
          <div className="absolute inset-0 bg-navy-950/60 flex items-center justify-center">
            <span className="font-mono text-xs text-[--text-muted]">Plan Pro requis</span>
          </div>
        )}
      </div>

      {/* Description */}
      {style.description && (
        <div className="px-3 py-2 bg-navy-900">
          <p className="font-body text-xs text-[--text-muted]">{style.description}</p>
        </div>
      )}
    </button>
  )
}

// ── StyleCarousel ──────────────────────────────────────────────────────────────

export function StyleCarousel({
  styles,
  selected,
  onChange,
  userPlan,
  onProRequired,
}: StyleCarouselProps) {
  const isPro = userPlan === 'pro' || userPlan === 'studio'

  return (
    <div className="overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 -mx-1 px-1">
      <div className="flex gap-4 w-max">
        {styles.map((style) => (
          <StyleCard
            key={style.id}
            style={style}
            selected={selected === style.id}
            locked={style.pro && !isPro}
            onChange={onChange}
            onLockedClick={onProRequired ?? (() => {})}
          />
        ))}
      </div>
    </div>
  )
}
