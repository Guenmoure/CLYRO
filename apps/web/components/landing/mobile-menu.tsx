'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { X, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

const NAV_LINKS = [
  { labelKey: 'lp_navFeatures',  href: '#features' },
  { labelKey: 'lp_navUseCases',  href: '#use-cases' },
  { labelKey: 'lp_navStyles',    href: '#styles' },
  { labelKey: 'lp_navPricing',   href: '/pricing' },
  { labelKey: 'lp_navFaq',       href: '#faq' },
]

export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const { t } = useLanguage()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('lp_openMenu')}
        className="flex items-center justify-center w-9 h-9 rounded-xl text-[--text-secondary] hover:text-foreground hover:bg-muted transition-colors md:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-[60] flex md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className={cn(
            'relative ml-auto w-72 h-full bg-card border-l border-border/50',
            'flex flex-col p-6 gap-6 animate-fade-up'
          )}>
            <div className="flex items-center justify-between">
              <span className="font-display text-lg">
                <span className="text-foreground">CLY</span>
                <span className="gradient-text">RO</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('lp_closeMenu')}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[--text-muted] hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="font-body text-sm text-[--text-secondary] hover:text-foreground px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                >
                  {t(link.labelKey)}
                </a>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-body text-xs text-[--text-muted]">{t('lp_appearance')}</span>
                <ThemeToggle />
              </div>
              <Link href="/login">
                <Button variant="secondary" fullWidth>{t('lp_signIn')}</Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" fullWidth>{t('lp_getStartedFree')}</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
