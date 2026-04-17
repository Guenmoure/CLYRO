'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Sticky bottom CTA — visible sur mobile uniquement (lg:hidden).
 * Apparaît dès que le hero sort du viewport (via IntersectionObserver).
 * Disparaît si l'utilisateur scroll jusqu'au footer (évite overlap).
 *
 * Usage : <StickyMobileCta heroId="hero" />
 */
export function StickyMobileCta({ heroId = 'hero' }: { heroId?: string }) {
  const router             = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hero = document.getElementById(heroId)
    if (!hero) return

    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0.1 },
    )
    io.observe(hero)
    return () => io.disconnect()
  }, [heroId])

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'fixed bottom-0 inset-x-0 z-40 p-3',
        'bg-background/95 backdrop-blur-md',
        'border-t border-border/50',
        'lg:hidden',
        'transition-transform duration-300 ease-out',
        visible ? 'translate-y-0' : 'translate-y-full',
      )}
    >
      <Button
        variant="primary"
        size="md"
        fullWidth
        rightIcon={<ArrowRight size={14} />}
        onClick={() => router.push('/signup')}
        aria-label="Get started free — 250 credits included"
      >
        Get started free — 250 credits included
      </Button>
    </div>
  )
}
