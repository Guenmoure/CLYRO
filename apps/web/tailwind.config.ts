import type { Config } from 'tailwindcss'

const config: Config = {
  // Dark mode contrôlé via la classe `.dark` sur <html>
  // (layout.tsx applique `className="dark"` par défaut)
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
        // CLYRO Navy — fonds & surfaces
        'navy-950': '#060810',   // fond racine (body)
        'navy-900': '#0A0D1A',   // cards, panels
        'navy-800': '#0F1427',   // inputs, hover léger
        'navy-700': '#151C38',   // bordures & surbrillances

        // CLYRO Accents — couleurs principales de la marque
        'clyro-blue':      '#3B8EF0',   // primary — CTA, liens actifs
        'clyro-blue-dark': '#2d7de0',   // primary hover
        'clyro-purple':    '#9B5CF6',   // secondary — accents Motion module
        'clyro-cyan':      '#38E8FF',   // tertiary — effets électriques

        // Couleurs sémantiques — feedback & états
        success: '#27ae60',   // confirmations, succès
        warning: '#f39c12',   // alertes, avertissements
        error:   '#e74c3c',   // erreurs, destructif

        // shadcn/ui tokens (mappés sur la palette CLYRO via CSS vars)
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
      // Polices chargées via next/font dans layout.tsx :
      //   Syne          → display  (titres h1/h2/h3, équivalent Poppins Bold)
      //   DM Sans       → body     (corps de texte, équivalent Inter Regular)
      //   JetBrains Mono → mono    (code, données, badges)
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        body:    ['var(--font-dm-sans)', 'sans-serif'],
        mono:    ['var(--font-jetbrains-mono)', 'monospace'],
      },

      // Échelle de tailles — base 16px (1rem), line-height 1.6 pour le corps
      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem',     { lineHeight: '1.6' }],    // 16px — corps principal
        'lg':   ['1.125rem', { lineHeight: '1.6' }],
        'xl':   ['1.25rem',  { lineHeight: '1.4' }],
        '2xl':  ['1.5rem',   { lineHeight: '1.3' }],    // h3
        '3xl':  ['1.875rem', { lineHeight: '1.25' }],   // h2
        '4xl':  ['2.25rem',  { lineHeight: '1.2' }],    // h1 mobile
        '5xl':  ['3rem',     { lineHeight: '1.1' }],    // h1 desktop
        '6xl':  ['3.75rem',  { lineHeight: '1.05' }],   // hero
        '7xl':  ['4.5rem',   { lineHeight: '1' }],      // hero xl
      },

      // Hauteurs de ligne nommées
      lineHeight: {
        'body':    '1.6',   // corps de texte — facilite la lecture
        'heading': '1.2',   // titres compacts
        'tight':   '1.1',   // gros display
        'relaxed': '1.75',  // longues descriptions
      },

      // Graisses nommées (utilisables comme font-bold, font-semibold, etc.)
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
        'grad-primary':  'linear-gradient(135deg, #3B8EF0, #9B5CF6)',
        'grad-electric': 'linear-gradient(135deg, #38E8FF, #3B8EF0, #9B5CF6)',
        'grad-navy':     'linear-gradient(180deg, #060810, #0A0D1A)',
        'grad-success':  'linear-gradient(135deg, #27ae60, #2ecc71)',
        'grad-warning':  'linear-gradient(135deg, #f39c12, #f1c40f)',
      },

      // ── Rayons ────────────────────────────────────────────────────────────
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      // ── Ombres lumineuses ─────────────────────────────────────────────────
      boxShadow: {
        'glow-blue':    '0 0 40px rgba(59, 142, 240, 0.3)',
        'glow-purple':  '0 0 40px rgba(155, 92, 246, 0.3)',
        'glow-cyan':    '0 0 40px rgba(56, 232, 255, 0.3)',
        'glow-success': '0 0 24px rgba(39, 174, 96, 0.3)',
        'glow-error':   '0 0 24px rgba(231, 76, 60, 0.3)',
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
        'accordion-down':   'accordion-down 0.2s ease-out',
        'accordion-up':     'accordion-up 0.2s ease-out',
        'pulse-glow':       'pulse-glow 2s ease-in-out infinite',
        'fade-in':          'fade-in 0.3s ease-out',
        'slide-in-right':   'slide-in-right 0.3s ease-out',
      },
    },
  },

  plugins: [require('tailwindcss-animate')],
}

export default config
