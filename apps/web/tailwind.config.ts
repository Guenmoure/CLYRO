import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],

  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],

  // Classes générées dynamiquement (composants de génération, spinners, etc.)
  safelist: ['animate-shimmer', 'animate-glow-pulse', 'animate-fade-up'],

  theme: {
    extend: {
      // ── Couleurs CLYRO ────────────────────────────────────────────────────
      colors: {
        // Backgrounds dark-first (inspiré HeyGen)
        navy: {
          950: '#060810',   // fond principal — le plus sombre
          900: '#0A0D1A',   // cards, panels, sidebar
          800: '#0F1427',   // inputs, éléments interactifs
          700: '#151C38',   // hover states, borders
          600: '#1E2A4A',   // dividers, séparateurs
        },

        // Accents IA — signature CLYRO
        blue: {
          300: '#7BB8F8',   // états disabled, accents légers
          400: '#5BA3F5',   // hover boutons primaires
          500: '#3B8EF0',   // accent principal — boutons CTA, liens actifs
        },
        purple: {
          400: '#AB74F8',   // hover purple
          500: '#9B5CF6',   // accent secondaire — badges, tags, gradients
        },
        cyan: {
          300: '#6AEDFF',   // glow effects, active states
          400: '#38E8FF',   // accent tertiaire — highlights, progress bars
        },

        // Sémantiques
        success: '#22C55E',
        warning: '#F59E0B',
        error:   '#EF4444',
        info:    '#3B8EF0',

        // ── Tokens shadcn/ui (CSS vars hex — no hsl() wrapper) ───────────
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

      // ── Typographie ───────────────────────────────────────────────────────
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        body:    ['var(--font-dm-sans)', 'sans-serif'],
        mono:    ['var(--font-jetbrains-mono)', 'monospace'],
      },

      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem',     { lineHeight: '1.6' }],
        'lg':   ['1.125rem', { lineHeight: '1.6' }],
        'xl':   ['1.25rem',  { lineHeight: '1.4' }],
        '2xl':  ['1.5rem',   { lineHeight: '1.3' }],
        '3xl':  ['1.875rem', { lineHeight: '1.25' }],
        '4xl':  ['2.25rem',  { lineHeight: '1.2' }],
        '5xl':  ['3rem',     { lineHeight: '1.1' }],
        '6xl':  ['3.75rem',  { lineHeight: '1.05' }],
        '7xl':  ['4.5rem',   { lineHeight: '1' }],
      },

      lineHeight: {
        body:    '1.6',
        heading: '1.2',
        tight:   '1.1',
        relaxed: '1.75',
      },

      fontWeight: {
        light:     '300',
        regular:   '400',
        medium:    '500',
        semibold:  '600',
        bold:      '700',
        extrabold: '800',
      },

      // ── Dégradés ──────────────────────────────────────────────────────────
      backgroundImage: {
        // Boutons CTA principaux, hero sections
        'grad-primary':      'linear-gradient(135deg, #3B8EF0, #9B5CF6)',
        // Éléments premium, feature highlights
        'grad-electric':     'linear-gradient(135deg, #38E8FF, #3B8EF0, #9B5CF6)',
        // Backgrounds de sections
        'grad-dark':         'linear-gradient(180deg, #0A0D1A, #060810)',
        // Cards avec effet depth
        'grad-card':         'linear-gradient(135deg, #0F1427, #151C38)',
        // Glow derrière les CTA
        'grad-glow-blue':    'radial-gradient(circle at center, rgba(59,142,240,0.13), transparent 70%)',
        // Glow derrière les sections features
        'grad-glow-purple':  'radial-gradient(circle at center, rgba(155,92,246,0.13), transparent 70%)',
        // Héritage
        'grad-cta':          'linear-gradient(135deg, #3B8EF0 0%, #9B5CF6 100%)',
        'grad-success':      'linear-gradient(135deg, #22C55E, #16A34A)',
        'grad-warning':      'linear-gradient(135deg, #F59E0B, #D97706)',
        'grad-error':        'linear-gradient(135deg, #EF4444, #DC2626)',
      },

      // ── Rayons ────────────────────────────────────────────────────────────
      borderRadius: {
        '2xl': '20px',
        lg:    'var(--radius)',
        md:    'calc(var(--radius) - 2px)',
        sm:    'calc(var(--radius) - 4px)',
      },

      // ── Ombres & Glows ────────────────────────────────────────────────────
      boxShadow: {
        'glow-blue':   '0 0 20px rgba(59, 142, 240, 0.35)',
        'glow-purple': '0 0 20px rgba(155, 92, 246, 0.35)',
        'glow-cyan':   '0 0 20px rgba(56, 232, 255, 0.35)',
        'card':        '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover':  '0 8px 40px rgba(0, 0, 0, 0.6)',
        'inner-dark':  'inset 0 1px 0 rgba(255,255,255,0.05)',
        // Héritage
        'glow-success': '0 0 24px rgba(34, 197, 94, 0.30)',
        'glow-warning': '0 0 24px rgba(245, 158, 11, 0.30)',
        'glow-error':   '0 0 24px rgba(239, 68, 68, 0.30)',
      },

      // ── Blur ──────────────────────────────────────────────────────────────
      backdropBlur: {
        xs: '2px',
      },

      // ── Border color par défaut ───────────────────────────────────────────
      borderColor: {
        DEFAULT: '#151C38',   // navy-700
      },

      // ── Animations ────────────────────────────────────────────────────────
      keyframes: {
        // shadcn/ui — accordéon (requis)
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        // Loading skeletons
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        // Glow pulsé sur CTA
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1' },
        },
        // Flottement hero elements
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        // Entrée depuis le bas
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Héritage
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%':   { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },

      animation: {
        'accordion-down':  'accordion-down 0.2s ease-out',
        'accordion-up':    'accordion-up 0.2s ease-out',
        shimmer:           'shimmer 2s linear infinite',
        'glow-pulse':      'glow-pulse 2.5s ease-in-out infinite',
        float:             'float 4s ease-in-out infinite',
        'fade-up':         'fade-up 0.4s ease-out forwards',
        'fade-in':         'fade-in 0.3s ease-out',
        'slide-in-right':  'slide-in-right 0.3s ease-out',
      },
    },
  },

  plugins: [require('tailwindcss-animate')],
}

export default config
