import * as React from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Small label above the title (e.g. "Workspace") */
  eyebrow?: string
  title: string
  description?: string
  /** Right-side CTA or controls */
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-8', className)}>
      <div>
        {eyebrow && (
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
        {description && (
          <p className="font-body text-sm text-[--text-secondary] mt-1">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
