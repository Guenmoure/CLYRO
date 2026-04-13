'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NewProjectCardProps {
  feature: 'faceless' | 'motion' | 'brand'
  className?: string
}

const FEATURE_ROUTES: Record<string, string> = {
  faceless: '/faceless/new',
  motion:   '/motion/new',
  brand:    '/brand',
}

export function NewProjectCard({ feature, className }: NewProjectCardProps) {
  const router = useRouter()
  const href = FEATURE_ROUTES[feature] ?? '/dashboard'

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={cn(
        'group flex flex-col items-center justify-center gap-2',
        'rounded-2xl border-2 border-dashed border-navy-600',
        'hover:border-blue-500/50 hover:bg-navy-800/50',
        'cursor-pointer transition-all duration-200',
        'aspect-[4/3] w-full',
        className,
      )}
    >
      <div className="rounded-full bg-navy-800 group-hover:bg-blue-500/10 p-3 transition-colors duration-200">
        <Plus
          size={20}
          className="text-[--text-muted] group-hover:text-blue-400 transition-colors duration-200"
        />
      </div>
      <p className="font-body text-xs text-[--text-muted] group-hover:text-[--text-secondary] transition-colors duration-200">
        Nouveau projet
      </p>
    </button>
  )
}
