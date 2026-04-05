import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],

  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],

  theme: {
    extend: {
      // ── Couleurs ──────────────────────────────────────────────────────────
      colors: {
        // ── Charte graphique officielle CLYRO ────────────────────────────
        'clyro-primary':      '#8A57EA',   // Violet Royal     — boutons, barres
        'clyro-primary-dark': '#6D39D1',   // Violet Profond   — hover, actifs
        'clyro-secondary':    '#2C2C2E',   // Anthracite       — cartes, conteneurs
        'clyro-accent':       '#4D9FFF',   // Bleu Électrique  — liens, sélections
        'clyro-muted':        '#A1A1A6',   // Gris Acier       — texte secondaire
        'clyro-bg':           '#0A0A0A',   // Noir Profond     — fond principal

        // ── Alias utiles (rétro-compat glass/animations) ─────────────────
        // clyro-blue  → accent bleu
        // clyro-purple → primary violet
        'clyro-blue':   '#4D9FFF',   // = clyro-accent
        'clyro-purple': '#8A57EA',   // = clyro-primary
        'clyro-cyan':   '#38E8FF',   // conservé pour effets glass/glow

        // ── Fonds sombres (dark mode surfaces) ───────────────────────────
        'navy-950': '#0A0A0A',   // fond racine
        'navy-900': '#111111',   // cartes, panels
        'navy-800': '#1A1A1A',   // inputs, hover
        'navy-700': '#242424',   // bordures & surbrillances

        // ── États sémantiques ─────────────────────────────────────────────
        success: '#00D084',   // Vert Menthe  — validation
        warning: '#FFAB00',   // Ambre        — quota, traitement
        error:   '#FF4D4D',   // Rouge Corail — erreurs

        // ── Light mode surfaces ───────────────────────────────────────────
        'surface-light': '#FFFFFF',
        'bg-light':      '#F5F5F7',
        'border-light':  '#E5E5EA',
        'muted-light':   '#6B7280',

        // ── Brand aliases (compat composants existants) ───────────────────
        'brand-primary':       '#8A57EA',
        'brand-primary-dark':  '#6D39D1',
        'brand-primary-light': '#f0ebfd',
        'brand-secondary':     '#2C2C2E',
        'brand-accent':        '#4D9FFF',
        'brand-accent-light':  '#e8f3ff',
        'brand-text':          '#111111',
        'brand-muted':         '#A1A1A6',
        'brand-surface':       '#FFFFFF',
        'brand-bg':            '#F5F5F7',
        'brand-border':        '#E5E5EA',
        'brand-border-light':  '#F0F0F0',

        // ── shadcn/ui tokens (CSS vars) ────────────────────────────────────
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',
      },

      // ── Typographie ───────────────────────────────────────────────────────
      fontFamily: {
        display: ['var(--font-plus-jakarta)', 'sans-serif'],
        body:    ['var(--font-inter)', 'sans-serif'],
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
        'body':    '1.6',
        'heading': '1.2',
        'tight':   '1.1',
        'relaxed': '1.75',
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
        // Charte CLYRO officielle
        'grad-primary':  'linear-gradient(135deg, #8A57EA 0%, #6D39D1 100%)',
        'grad-cta':      'linear-gradient(135deg, #8A57EA 0%, #4D9FFF 100%)',
        'grad-hero':     'linear-gradient(135deg, #8A57EA 0%, #6D39D1 50%, #4D9FFF 100%)',
        'grad-soft':     'linear-gradient(135deg, rgba(138,87,234,0.08) 0%, rgba(77,159,255,0.08) 100%)',
        // États
        'grad-success':  'linear-gradient(135deg, #00D084, #00B87A)',
        'grad-warning':  'linear-gradient(135deg, #FFAB00, #FF8C00)',
        'grad-error':    'linear-gradient(135deg, #FF4D4D, #E53535)',
        // Fond sombre
        'grad-dark':     'linear-gradient(180deg, #0A0A0A, #111111)',
        // Effet électrique (glass hero)
        'grad-electric': 'linear-gradient(135deg, #38E8FF, #4D9FFF, #8A57EA)',
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
        // Glows — charte officielle
        'glow-primary': '0 0 40px rgba(138, 87, 234, 0.35)',
        'glow-accent':  '0 0 40px rgba(77, 159, 255, 0.30)',
        'glow-cyan':    '0 0 40px rgba(56, 232, 255, 0.30)',
        'glow-success': '0 0 24px rgba(0, 208, 132, 0.30)',
        'glow-warning': '0 0 24px rgba(255, 171, 0, 0.30)',
        'glow-error':   '0 0 24px rgba(255, 77, 77, 0.30)',
        // Ombres douces (light mode)
        'soft-sm':  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'soft-md':  '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        'soft-lg':  '0 12px 40px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.04)',
        'soft-xl':  '0 24px 64px rgba(138,87,234,0.15)',
      },

      // ── Animations ────────────────────────────────────────────────────────
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
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
        'pulse-glow':      'pulse-glow 2s ease-in-out infinite',
        'fade-in':         'fade-in 0.3s ease-out',
        'slide-in-right':  'slide-in-right 0.3s ease-out',
      },
    },
  },

  plugins: [require('tailwindcss-animate')],
}

export default config
