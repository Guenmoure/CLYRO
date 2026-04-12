'use client'

import type { VideoStatus } from '@clyro/shared'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  /** Progress value: 0–100 */
  value: number
  /** Show "{value}%" label below the bar */
  showLabel?: boolean
  /** Optional status for color coding */
  status?: VideoStatus
  /** Optional custom message to display above the bar */
  message?: string
  className?: string
}

/**
 * Generic reusable progress bar component with status-aware color coding.
 * - Amber/yellow: processing (pending, processing)
 * - Green: done
 * - Red: error
 * - Brand-primary: default
 *
 * Smooth CSS transitions on progress changes.
 */
export function ProgressBar({
  value,
  showLabel = false,
  status,
  message,
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  // Minimum visible width so the bar is always visible even at 0%
  const width = Math.max(clamped, 5)

  // Determine bar color based on status
  const getBarColor = () => {
    if (status === 'error') return 'from-red-500 to-red-600'
    if (status === 'done') return 'from-emerald-500 to-emerald-600'
    if (status === 'pending' || status === 'processing') return 'from-amber-400 to-amber-500'
    return 'from-brand-primary to-purple-500'
  }

  const getContainerColor = () => {
    if (status === 'error') return 'bg-red-100'
    if (status === 'done') return 'bg-emerald-100'
    if (status === 'pending' || status === 'processing') return 'bg-amber-100'
    return 'bg-brand-bg'
  }

  return (
    <div className={cn('w-full space-y-2', className)}>
      {message && (
        <p className="font-body text-xs text-brand-muted">{message}</p>
      )}
      <div
        className={cn('h-1.5 rounded-full overflow-hidden transition-colors duration-300', getContainerColor())}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={message || `Progress: ${clamped}%`}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500 bg-gradient-to-r', getBarColor())}
          style={{ width: `${width}%` }}
        />
      </div>
      {showLabel && (
        <p className="font-mono text-xs text-brand-muted text-center">{clamped}%</p>
      )}
    </div>
  )
}
