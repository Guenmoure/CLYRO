'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'

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
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display font-extrabold text-xl">
            <span className="text-clyro-cyan">C</span>
            <span className="text-gray-900 dark:text-white">LYRO</span>
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider glass-blue px-1.5 py-0.5 rounded-full text-clyro-blue">
            Beta
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {[
            { href: '#modules',      label: 'Modules' },
            { href: '#how-it-works', label: 'How it works' },
            { href: '#pricing',      label: 'Pricing' },
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
            Sign in
          </Link>
          <Link
            href="/signup"
            className="shimmer font-body text-sm font-medium bg-gradient-to-r from-clyro-blue to-clyro-purple text-white px-4 py-1.5 rounded-xl hover:opacity-90 transition-opacity duration-200 flex items-center gap-1.5"
          >
            Get started free <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </header>
  )
}
