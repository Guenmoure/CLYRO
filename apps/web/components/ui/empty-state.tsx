import * as React from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Lucide icon component */
  icon: React.ElementType
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-20 px-8 text-center',
        'bg-muted/50 border border-dashed border-border rounded-2xl',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4">
        <Icon size={22} className="text-[--text-muted]" />
      </div>
      <p className="font-display text-sm font-semibold text-foreground mb-1">{title}</p>
      {description && (
        <p className="text-xs text-[--text-muted] max-w-xs">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
