'use client'

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  href?: string   // last crumb omits href (current page)
}

interface BreadcrumbsProps {
  items: Crumb[]
  className?: string
  /** Show a home icon as the first crumb link to /dashboard */
  homeLink?: boolean
}

/**
 * Accessible breadcrumb navigation for nested pages (e.g. /faceless/new).
 *
 * Usage:
 *   <Breadcrumbs items={[
 *     { label: 'Faceless Videos', href: '/faceless' },
 *     { label: 'Nouvelle vidéo' },
 *   ]} />
 */
export function Breadcrumbs({ items, className, homeLink = true }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Fil d'Ariane"
      className={cn('flex items-center gap-1 text-xs font-mono text-[--text-secondary]', className)}
    >
      {homeLink && (
        <>
          <Link
            href="/dashboard"
            aria-label="Retour au dashboard"
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-muted hover:text-foreground transition-colors"
          >
            <Home size={13} />
          </Link>
          <ChevronRight size={12} className="text-[--text-muted] shrink-0" />
        </>
      )}
      {items.map((crumb, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-[--text-muted] shrink-0" />}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className={cn(isLast && 'text-foreground font-semibold')} aria-current={isLast ? 'page' : undefined}>
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
