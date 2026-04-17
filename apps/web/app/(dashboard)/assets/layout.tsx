'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Mic, Package } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export default function AssetsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useLanguage()

  const TABS = [
    { href: '/assets/avatars', label: t('assets') + ' — ' + t('avatarLabel'), icon: User },
    { href: '/assets/voices',  label: t('voices'),                             icon: Mic  },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Section header */}
      <div className="bg-card border-b border-border/50 px-6 pt-6 pb-0 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Package size={16} className="text-blue-500" />
          </div>
          <h1 className="font-body text-2xl font-bold text-foreground">{t('assets')}</h1>
        </div>
        <p className="font-body text-sm text-[--text-muted] mb-4">
          {t('assets')}
        </p>

        {/* Tab navigation */}
        <div className="flex gap-1">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 font-body text-sm rounded-t-xl',
                  'border-b-2 transition-all duration-150',
                  active
                    ? 'text-blue-400 border-blue-500 bg-blue-500/8'
                    : 'text-[--text-secondary] border-transparent hover:text-foreground hover:bg-muted',
                )}
              >
                <Icon size={14} />
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
