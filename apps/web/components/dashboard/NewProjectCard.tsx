'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

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
  const { t } = useLanguage()
  const href = FEATURE_ROUTES[feature] ?? '/dashboard'

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={cn(
        'group flex flex-col items-center justify-center gap-2',
        'rounded-2xl border-2 border-dashed border-border',
        'hover:border-brand/50 hover:bg-muted/50',
        'cursor-pointer transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        'aspect-[4/3] w-full',
        className,
      )}
    >
      <div className="rounded-full bg-muted group-hover:bg-brand/10 p-3 transition-colors duration-200">
        <Plus
          size={20}
          className="text-[--text-muted] group-hover:text-primary transition-colors duration-200"
        />
      </div>
      <p className="font-body text-xs text-[--text-muted] group-hover:text-[--text-secondary] transition-colors duration-200">
        {t('newProject')}
      </p>
    </button>
  )
}
