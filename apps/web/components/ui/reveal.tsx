'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface RevealProps {
  children: React.ReactNode
  className?: string
  /** Stagger mode: animates direct children one by one */
  stagger?: boolean
  /** Delay in ms before this element reveals (non-stagger mode only) */
  delay?: number
  /** IntersectionObserver rootMargin bottom offset (default -40px) */
  offset?: number
}

/**
 * Wraps children in a div that fades + slides up when it enters the viewport.
 * Uses IntersectionObserver to add the `.is-visible` class once, then disconnects.
 *
 * CSS classes used (defined in globals.css):
 *   .reveal            — single-element reveal
 *   .stagger           — parent: children reveal in sequence
 *   .is-visible        — toggled on by JS when element enters viewport
 */
export function Reveal({ children, className, stagger = false, delay = 0, offset = 40 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible')
          observer.disconnect()
        }
      },
      { threshold: 0.08, rootMargin: `0px 0px -${offset}px 0px` }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [offset])

  return (
    <div
      ref={ref}
      className={cn(stagger ? 'stagger' : 'reveal', className)}
      style={!stagger && delay > 0 ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  )
}
