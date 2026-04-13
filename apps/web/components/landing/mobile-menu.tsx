'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { X, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Fonctionnalités', href: '#fonctionnalites' },
  { label: 'Styles', href: '#styles' },
  { label: 'Tarifs', href: '#tarifs' },
  { label: 'FAQ', href: '#faq' },
]

export function MobileMenu() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        className="flex items-center justify-center w-9 h-9 rounded-xl text-[--text-secondary] hover:text-foreground hover:bg-navy-800 transition-colors md:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-[60] flex md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className={cn(
            'relative ml-auto w-72 h-full bg-navy-900 border-l border-navy-700/50',
            'flex flex-col p-6 gap-6 animate-slide-in-right'
          )}>
            <div className="flex items-center justify-between">
              <span className="font-display text-lg">
                <span className="text-foreground">CLY</span>
                <span className="gradient-text">RO</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[--text-muted] hover:text-foreground hover:bg-navy-800 transition-colors"
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
                  className="font-body text-sm text-[--text-secondary] hover:text-foreground px-3 py-2.5 rounded-lg hover:bg-navy-800 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-3">
              <Link href="/login">
                <Button variant="secondary" fullWidth>Connexion</Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" fullWidth>Commencer gratuitement</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
