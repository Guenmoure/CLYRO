'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Logo } from '@/components/ui/Logo'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`nav-slide-in fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
        scrolled ? 'glass-heavy glass-border-b' : ''
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="CLYRO home">
          {/* Unified wordmark — fixes the 'LYRO'-looks-isolated issue from
              the competitive audit. Using the shared gradient Logo ensures
              "CLYRO" reads as a single brand mark instead of "[C] LYRO". */}
          <Logo variant="full" size="sm" href={false} />
          <span className="font-mono text-[11px] uppercase tracking-wider glass-blue px-1.5 py-0.5 rounded-full text-clyro-blue">
            Beta
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {[
            { href: '#modules',      label: 'Modules' },
            { href: '#how-it-works', label: 'Comment ça marche' },
            { href: '#pricing',      label: 'Tarifs' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="font-body text-sm text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="font-body text-sm text-white/50 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 px-3 py-1.5"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="shimmer font-body text-sm font-medium bg-gradient-to-r from-clyro-blue to-clyro-purple text-white px-4 py-1.5 rounded-xl hover:opacity-90 transition-opacity duration-200 flex items-center gap-1.5"
          >
            Commencer gratuitement <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </header>
  )
}
