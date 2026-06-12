import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],

  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],

  safelist: ['animate-shimmer', 'animate-fade-up'],

  theme: {
    extend: {
      // ── Colors — HeyGen inspired, light-first, violet primary ───────────
      colors: {
        // Brand CLYRO — violet signature
        brand: {
          DEFAULT: '#6D4AFF',
          hover:   '#5B3BE0',
          soft:    '#F0EDFF',
          50:      '#F5F3FF',
        },

        // Feature accent colors
        feature: {
          faceless:  '#3B82F6',
          avatar:    '#EC4899',
          motion:    '#8B5CF6',
          brand:     '#14B8A6',
          autopilot: '#F59E0B',
        },

        // Semantic status
        success: '#10B981',
        warning: '#F59E0B',
        error:   '#EF4444',
        info:    '#3B82F6',

        // ── shadcn/ui tokens (CSS custom properties) ──────────────────────
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT:    'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT:    'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT:    'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT:    'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT:    'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT:    'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT:    'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input:  'var(--input)',
        ring:   'var(--ring)',
      },

      // ── Typography — Inter as primary ───────────────────────────────────
      fontFamily: {
        display: ['var(--font-inter)', 'sans-serif'],
        body:    ['var(--font-inter)', 'sans-serif'],
        mono:    ['var(--font-jetbrains-mono)', 'monospace'],
      },

      fontSize: {
        'xs':   ['0.75rem',   { lineHeight: '1rem' }],
        'sm':   ['0.8125rem', { lineHeight: '1.25rem' }],   // 13px
        'base': ['0.875rem',  { lineHeight: '1.5' }],       // 14px
        'md':   ['0.9375rem', { lineHeight: '1.5' }],       // 15px
        'lg':   ['1.125rem',  { lineHeight: '1.4' }],       // 18px
        'xl':   ['1.375rem',  { lineHeight: '1.3' }],       // 22px
        '2xl':  ['1.75rem',   { lineHeight: '1.25' }],      // 28px
        '3xl':  ['2.25rem',   { lineHeight: '1.2' }],       // 36px
        '4xl':  ['2.5rem',    { lineHeight: '1.15' }],
        '5xl':  ['3rem',      { lineHeight: '1.1' }],
      },

      lineHeight: {
        tight:   '1.25',
        normal:  '1.5',
        relaxed: '1.65',
      },

      // ── Gradients ───────────────────────────────────────────────────────
      backgroundImage: {
        'grad-primary':  'linear-gradient(135deg, #6D4AFF 0%, #8B5CF6 50%, #A855F7 100%)',
        'grad-cta':      'linear-gradient(135deg, #6D4AFF 0%, #8B5CF6 100%)',
        'grad-dark':     'linear-gradient(180deg, #0F1117, #1A1D27)',
        'grad-success':  'linear-gradient(135deg, #10B981, #059669)',
        'grad-warning':  'linear-gradient(135deg, #F59E0B, #D97706)',
        'grad-error':    'linear-gradient(135deg, #EF4444, #DC2626)',
      },

      // ── Border radius — rounder like HeyGen ────────────────────────────
      borderRadius: {
        '2xl': '20px',
        xl:    '14px',
        lg:    '10px',
        md:    '8px',
        sm:    '6px',
      },

      // ── Shadows — subtle, light-mode optimized ─────────────────────────
      boxShadow: {
        'sm':         '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        'card':       '0 1px 3px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        'md':         '0 4px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03)',
        'lg':         '0 10px 25px rgba(0,0,0,0.07), 0 4px 10px rgba(0,0,0,0.04)',
        'xl':         '0 20px 40px rgba(0,0,0,0.08)',
        'dropdown':   '0 10px 30px rgba(0,0,0,0.12)',
        'glow-brand': '0 4px 12px rgba(109,74,255,0.3)',
      },

      // ── Animations — fast and subtle ───────────────────────────────────
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'ken-burns': {
          '0%':   { transform: 'scale(1) translate(0, 0)' },
          '100%': { transform: 'scale(1.12) translate(-2%, -1%)' },
        },
        'pulse-fast': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.02) translateX(0.5%)' },
        },
        'pulse-slow': {
          '0%':   { transform: 'scale(1.02) translateX(0)' },
          '100%': { transform: 'scale(1.08) translateX(-2%)' },
        },
        waveform: {
          '0%, 100%': { height: '4px' },
          '50%':      { height: '20px' },
        },
      },

      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        shimmer:          'shimmer 1.5s linear infinite',
        'fade-up':        'fade-up 0.2s ease-out forwards',
        'fade-in':        'fade-in 0.2s ease-out',
        'slide-up':       'slide-up 0.2s ease-out',
        'ken-burns':      'ken-burns 3s ease-in-out infinite alternate',
        'pulse-fast':     'pulse-fast 1.2s ease-in-out infinite',
        'pulse-slow':     'pulse-slow 2.5s ease-in-out infinite alternate',
        waveform:         'waveform 0.8s ease-in-out infinite',
      },
    },
  },

  plugins: [require('tailwindcss-animate')],
}

export default config
