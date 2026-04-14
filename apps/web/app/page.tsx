// app/page.tsx — Landing Page CLYRO (public)
// Server Component — pas de 'use client'

import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRight, Play, CheckCircle, Clock, DollarSign,
  Frown, FileText, Cpu, Download, ChevronDown,
  Twitter, Linkedin, Youtube, Instagram,
} from 'lucide-react'
import { Button }   from '@/components/ui/button'
import { Badge }    from '@/components/ui/badge'
import { Card }     from '@/components/ui/card'
import { SpinnerAI } from '@/components/ui/spinner'
import { MobileMenu }     from '@/components/landing/mobile-menu'
import { PricingToggle }  from '@/components/landing/pricing-toggle'
import { ThemeToggle }    from '@/components/ui/theme-toggle'

export const metadata: Metadata = {
  title: 'CLYRO — Génération vidéo par IA en moins de 10 minutes',
  description:
    'De ton script à ta vidéo en moins de 10 minutes. Sans caméra, sans monteur, sans agence. Faceless videos, motion design et brand kit — entièrement par IA.',
  keywords: ['AI video', 'faceless videos', 'motion graphics', 'brand kit', 'video generation'],
  openGraph: {
    title: 'CLYRO — Génération vidéo par IA',
    description: 'De ton script à ta vidéo en moins de 10 minutes.',
    type: 'website',
  },
}

// ── Shared layout helpers ──────────────────────────────────────────────────────

function SectionLabel({ children, variant = 'info' }: { children: React.ReactNode; variant?: React.ComponentProps<typeof Badge>['variant'] }) {
  return (
    <div className="flex justify-center mb-4">
      <Badge variant={variant}>{children}</Badge>
    </div>
  )
}

function SectionHeader({ label, labelVariant, title, subtitle, titleGradient }: {
  label: string
  labelVariant?: React.ComponentProps<typeof Badge>['variant']
  title: React.ReactNode
  subtitle?: string
  titleGradient?: boolean
}) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-12">
      <SectionLabel variant={labelVariant}>{label}</SectionLabel>
      <h2 className={`font-display text-3xl md:text-4xl font-bold text-foreground ${titleGradient ? '' : ''}`}>
        {title}
      </h2>
      {subtitle && (
        <p className="font-body text-lg text-[--text-secondary] mt-4 leading-relaxed">{subtitle}</p>
      )}
    </div>
  )
}

// ── 1. HEADER ─────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Fonctionnalités', href: '#fonctionnalites' },
  { label: 'Styles',          href: '#styles' },
  { label: 'Tarifs',          href: '#tarifs' },
  { label: 'FAQ',             href: '#faq' },
]

function Header() {
  return (
    <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="font-display text-xl font-bold shrink-0">
          <span className="text-foreground">CLY</span>
          <span className="gradient-text">RO</span>
        </Link>

        {/* Nav — desktop */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-body text-sm text-[--text-secondary] hover:text-foreground transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">Connexion</Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm">Commencer gratuitement</Button>
          </Link>
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}

// ── 2. HERO ───────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden noise-overlay">
      {/* Glow blobs */}
      <div className="pointer-events-none absolute top-1/4 -left-24 w-96 h-96 rounded-full bg-[var(--primary)]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 -right-24 w-96 h-96 rounded-full bg-[var(--secondary)]/10 blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-24 text-center w-full">
        <Badge variant="info" dot className="mb-8 inline-flex">
          Génération vidéo par IA
        </Badge>

        <h1 className="font-display text-5xl md:text-7xl font-bold leading-tight text-foreground">
          De ton{' '}
          <span className="gradient-text">script à ta vidéo</span>
          <br />
          en moins de 10 minutes.
        </h1>

        <p className="font-body text-lg md:text-xl text-[--text-secondary] max-w-2xl mx-auto mt-6 leading-relaxed">
          Sans caméra. Sans monteur. Sans agence.
          <br />
          CLYRO génère tes vidéos faceless, tes motion designs
          et ton identité visuelle — entièrement par IA.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/signup">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>
              Créer ma première vidéo gratuitement
            </Button>
          </Link>
          <a href="#fonctionnalites">
            <Button variant="secondary" size="lg" leftIcon={<Play size={16} />}>
              Voir une démo
            </Button>
          </a>
        </div>

        <p className="font-mono text-xs text-[--text-muted] mt-5">
          ✓ 3 vidéos gratuites à l'inscription · ✓ Sans carte bancaire · ✓ Résultat en moins de 5 minutes
        </p>

        {/* Hero mockup */}
        <div className="mt-16 perspective-[1000px]">
          <div className="[transform:rotateX(4deg)] hover:[transform:rotateX(0deg)] transition-transform duration-500">
            <Card variant="glass" padding="md" className="max-w-3xl mx-auto shadow-card-hover">
              {/* Generation bar */}
              <div className="flex items-center gap-4 mb-5">
                <SpinnerAI size="md" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-body text-sm text-[--text-secondary]">Génération en cours...</span>
                    <span className="font-mono text-xs text-[--text-muted]">Scène 3 / 6</span>
                  </div>
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <div className="h-full w-1/2 bg-grad-primary rounded-full" />
                  </div>
                </div>
              </div>

              {/* Scene thumbnails */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Scène 1', done: true },
                  { label: 'Scène 2', done: true },
                  { label: 'Scène 3', active: true },
                ].map((scene) => (
                  <div
                    key={scene.label}
                    className="relative aspect-video bg-border rounded-xl overflow-hidden flex items-center justify-center"
                  >
                    {scene.done && (
                      <div className="absolute inset-0 bg-muted/60 flex items-center justify-center">
                        <Play size={20} className="text-foreground/60" />
                      </div>
                    )}
                    {scene.active && (
                      <div className="absolute inset-0 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center">
                        <SpinnerAI size="sm" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge variant={scene.done ? 'success' : scene.active ? 'info' : 'neutral'} dot={!!scene.active}>
                        {scene.done ? 'HD' : scene.active ? 'IA' : '—'}
                      </Badge>
                    </div>
                    <span className="absolute bottom-2 left-2 font-mono text-xs text-[--text-muted]">{scene.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── 3. SOCIAL PROOF ───────────────────────────────────────────────────────────

const STATS = [
  { value: '2 000+', label: 'vidéos générées' },
  { value: '500+',   label: 'créateurs actifs' },
  { value: '<5 min', label: 'temps de génération moyen' },
  { value: '4.8/5',  label: 'note moyenne' },
]

function SocialProof() {
  return (
    <section className="bg-card border-y border-border/50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x md:divide-border/50">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-center px-4 py-2">
              <div className="font-display text-2xl font-bold gradient-text">{stat.value}</div>
              <div className="font-body text-sm text-[--text-muted] mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 4. PROBLEM ────────────────────────────────────────────────────────────────

const PROBLEMS = [
  {
    icon: <Clock size={22} />,
    iconColor: 'text-error',
    iconBg:    'bg-error/10',
    title:     'Des heures de montage',
    text:      'Trouver les visuels, monter, ajuster, exporter... Une vidéo de 2 minutes = une journée de travail.',
  },
  {
    icon: <DollarSign size={22} />,
    iconColor: 'text-warning',
    iconBg:    'bg-warning/10',
    title:     'Des agences hors de prix',
    text:      'Une vidéo professionnelle coûte entre 500€ et 5 000€. Inatteignable pour scaler sa production de contenu.',
  },
  {
    icon: <Frown size={22} />,
    iconColor: 'text-purple-400',
    iconBg:    'bg-purple-500/10',
    title:     'Des résultats inconsistants',
    text:      "Changer de freelance, d'outil ou de style à chaque vidéo. Aucune cohérence de marque sur la durée.",
  },
]

function ProblemSection() {
  return (
    <section id="fonctionnalites" className="bg-background py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          label="Le problème"
          labelVariant="error"
          title="La création vidéo prend trop de temps"
          subtitle="Les créateurs passent 80% de leur temps à produire, pas à créer."
        />

        <div className="grid md:grid-cols-3 gap-6">
          {PROBLEMS.map((p) => (
            <Card key={p.title} variant="elevated" hoverable>
              <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${p.iconBg} ${p.iconColor} mb-4`}>
                {p.icon}
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">{p.title}</h3>
              <p className="font-body text-sm text-[--text-secondary] leading-relaxed">{p.text}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 5. SOLUTION ───────────────────────────────────────────────────────────────

function ModuleMockup({ slots }: { slots: string[] }) {
  return (
    <Card variant="glass" padding="md" className="w-full">
      <div className="grid grid-cols-2 gap-2">
        {slots.map((label, i) => (
          <div key={i} className="aspect-video bg-border rounded-lg flex items-center justify-center">
            <span className="font-mono text-xs text-[--text-muted]">{label}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

const MODULES = [
  {
    badge:       { label: 'Module 1', variant: 'purple' as const },
    title:       'Vidéos faceless animées',
    desc:        "Colle ton script, choisis ton style parmi 6 univers visuels, sélectionne une voix — CLYRO génère ta vidéo complète avec scènes animées, voix off et sous-titres karaoke.",
    features:    [
      '6 styles : Animation 2D, Cinématique, Whiteboard...',
      'Sous-titres karaoke synchronisés automatiquement',
      'Re-génération scène par scène si besoin',
    ],
    reverse:     false,
    mockupSlots: ['Scène 1', 'Scène 2', 'Scène 3', 'Scène 4'],
  },
  {
    badge:       { label: 'Module 2', variant: 'info' as const },
    title:       'Motion design style After Effects',
    desc:        "Crée des ads, des présentations produit et des teasers animés. Définis ton brief, CLYRO génère un storyboard structuré et rend ta vidéo avec animations pro.",
    features:    [
      'Formats 9:16, 1:1, 16:9 — prêts pour toutes les plateformes',
      "Assets visuels générés selon l'ambiance de ta marque",
      'Thumbnail auto-généré pour les ads',
    ],
    reverse:     true,
    mockupSlots: ['Intro', 'Slide 1', 'Slide 2', 'Outro'],
  },
  {
    badge:       { label: 'Nouveau', variant: 'purple' as const, dot: true },
    title:       'Identité visuelle complète',
    desc:        "En 15 minutes, CLYRO génère ton logo, ta palette, tes typographies, tes mockups et une charte graphique PDF professionnelle — depuis un simple brief textuel.",
    features:    [
      '3 directions créatives au choix avec hybridation possible',
      'Vérification WCAG automatique de tes couleurs',
      'Export brand kit ZIP (logos PNG/SVG, palette ASE, PDF charte)',
    ],
    reverse:     false,
    mockupSlots: ['Direction A', 'Direction B', 'Direction C', 'Export'],
  },
]

function SolutionSection() {
  return (
    <section className="bg-card py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          label="La solution CLYRO"
          title={<>Trois outils. <span className="gradient-text">Un seul workflow.</span></>}
        />

        <div className="flex flex-col gap-20">
          {MODULES.map((mod, i) => (
            <div
              key={i}
              className={`flex flex-col ${mod.reverse ? 'md:flex-row-reverse' : 'md:flex-row'} gap-12 items-center`}
            >
              {/* Text */}
              <div className="flex-1">
                <Badge variant={mod.badge.variant} dot={mod.badge.dot} className="mb-4">
                  {mod.badge.label}
                </Badge>
                <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                  {mod.title}
                </h3>
                <p className="font-body text-[--text-secondary] leading-relaxed mb-6">{mod.desc}</p>
                <ul className="flex flex-col gap-3 mb-8">
                  {mod.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle size={16} className="text-success shrink-0 mt-0.5" />
                      <span className="font-body text-sm text-[--text-secondary]">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" size="md">Voir un exemple →</Button>
              </div>

              {/* Mockup */}
              <div className="flex-1 w-full">
                <ModuleMockup slots={mod.mockupSlots} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 6. HOW IT WORKS ───────────────────────────────────────────────────────────

const STEPS = [
  {
    num:   '01',
    icon:  <FileText size={24} />,
    title: 'Écris ou colle ton script',
    text:  'Quelques mots ou 10 000 caractères. CLYRO découpe intelligemment en scènes visuelles cohérentes.',
  },
  {
    num:   '02',
    icon:  <Cpu size={24} />,
    title: "L'IA génère tout",
    text:  'Images, animations, voix off, sous-titres karaoke. En parallèle, en quelques minutes.',
  },
  {
    num:   '03',
    icon:  <Download size={24} />,
    title: 'Télécharge et publie',
    text:  "MP4 prêt à être uploadé sur YouTube, TikTok ou Instagram. Sans aucun montage supplémentaire.",
  },
]

function HowItWorks() {
  return (
    <section className="bg-background py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <SectionHeader
          label="Comment ça marche"
          labelVariant="neutral"
          title="Prêt en 3 étapes"
        />

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line — spans columns, sits behind content */}
          <div
            className="hidden md:block absolute top-[28px] left-[calc(33.33%-1px)] right-[calc(33.33%-1px)] h-px border-t border-dashed border-border z-0"
            aria-hidden="true"
          />

          {STEPS.map((step) => (
            <div key={step.num} className="flex flex-col items-center text-center relative z-10">
              {/* Step number circle */}
              <div className="w-14 h-14 rounded-full bg-muted border border-border flex items-center justify-center mb-4 shrink-0">
                <span className="font-mono text-lg font-bold gradient-text">{step.num}</span>
              </div>
              <div className="w-12 h-12 flex items-center justify-center bg-card rounded-2xl text-[--text-secondary] mb-4 border border-border/60">
                {step.icon}
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="font-body text-sm text-[--text-secondary] leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 7. STYLES SECTION ─────────────────────────────────────────────────────────

const VIDEO_STYLES = [
  {
    name: 'Animation 2D',
    desc: 'Personnages cartoon animés',
    preview: (
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/30 to-yellow-500/15 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-orange-400/60 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-orange-400/40" />
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex gap-1">
          <div className="h-1 rounded-full bg-orange-400/30 w-[40%]" />
          <div className="h-1 rounded-full bg-orange-400/30 w-[60%]" />
          <div className="h-1 rounded-full bg-orange-400/30 w-[35%]" />
          <div className="h-1 rounded-full bg-orange-400/30 w-[50%]" />
        </div>
      </div>
    ),
  },
  {
    name: 'Stock + Voix Off',
    desc: 'Images réalistes professionnelles',
    preview: (
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/60 to-slate-900/70">
        {/* Cinematic bars */}
        <div className="absolute top-0 left-0 right-0 h-[14%] bg-black/70" />
        <div className="absolute bottom-0 left-0 right-0 h-[14%] bg-black/70" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/30 flex items-center justify-center">
            <Play size={12} className="text-white/60 ml-0.5" />
          </div>
        </div>
      </div>
    ),
  },
  {
    name: 'Minimaliste',
    desc: 'Typographie épurée et impactante',
    preview: (
      <div className="absolute inset-0 bg-white dark:bg-zinc-900 flex flex-col items-center justify-center gap-1.5 px-4">
        <div className="w-16 h-2 rounded bg-foreground/80" />
        <div className="w-10 h-1.5 rounded bg-foreground/30" />
        <div className="w-12 h-1.5 rounded bg-foreground/20 mt-1" />
      </div>
    ),
  },
  {
    name: 'Infographie',
    desc: 'Données visualisées en mouvement',
    preview: (
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/50 to-teal-900/40 flex items-end justify-center gap-1.5 pb-4 px-4">
        <div className="flex-1 rounded-t bg-emerald-400/30 h-[55%]" />
        <div className="flex-1 rounded-t bg-emerald-400/40 h-[80%]" />
        <div className="flex-1 rounded-t bg-emerald-400/50 h-[40%]" />
        <div className="flex-1 rounded-t bg-emerald-400/60 h-[95%]" />
        <div className="flex-1 rounded-t bg-emerald-400/70 h-[65%]" />
      </div>
    ),
  },
  {
    name: 'Whiteboard',
    desc: 'Explication dessinée en direct',
    preview: (
      <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-100 flex items-center justify-center p-4">
        <svg viewBox="0 0 80 50" className="w-full h-full opacity-50" stroke="#374151" fill="none" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="15" cy="25" r="8" />
          <line x1="23" y1="25" x2="35" y2="25" />
          <rect x="35" y="18" width="14" height="14" rx="2" />
          <line x1="49" y1="25" x2="60" y2="25" />
          <circle cx="65" cy="25" r="6" />
        </svg>
      </div>
    ),
  },
  {
    name: 'Cinématique',
    desc: 'Plans épiques, ambiance premium',
    preview: (
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/50 to-zinc-900/80 flex items-center justify-center">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-300/70 blur-[3px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_40%_30%,rgba(251,191,36,0.12)_0%,transparent_60%)]" />
        <div className="absolute bottom-3 left-3 right-3 h-px bg-white/10" />
      </div>
    ),
  },
]

function StylesSection() {
  return (
    <section id="styles" className="bg-card py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          label="6 styles disponibles"
          title="Un style pour chaque contenu"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {VIDEO_STYLES.map((style) => (
            <div
              key={style.name}
              className="group rounded-2xl overflow-hidden border border-border/60 bg-card hover:border-border hover:shadow-card-hover transition-all duration-200 cursor-pointer"
            >
              {/* Distinct CSS art thumbnail */}
              <div className="relative aspect-video overflow-hidden">
                {style.preview}
                <div className="absolute inset-0 bg-[var(--primary)]/0 group-hover:bg-[var(--primary)]/5 transition-colors duration-200" />
              </div>
              {/* Info */}
              <div className="p-4">
                <h3 className="font-display text-sm font-semibold text-foreground">{style.name}</h3>
                <p className="font-body text-xs text-[--text-muted] mt-0.5">{style.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 8. PRICING ────────────────────────────────────────────────────────────────

function PricingSection() {
  return (
    <section id="tarifs" className="bg-background py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          label="Tarifs"
          labelVariant="neutral"
          title="Simple. Transparent. Sans surprise."
        />
        <PricingToggle />
      </div>
    </section>
  )
}

// ── 9. FAQ ────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "Combien de temps prend la génération d'une vidéo ?",
    a: "Pour une vidéo Faceless de 30 secondes (5–6 scènes), comptez 3 à 5 minutes de génération. Le Motion Design est légèrement plus rapide car il n'utilise pas d'animation image-to-video.",
  },
  {
    q: "Est-ce que je peux modifier les scènes après génération ?",
    a: "Oui. CLYRO permet de régénérer chaque scène individuellement sans relancer toute la vidéo. Tu peux éditer le prompt, demander une amélioration par l'IA, ou comparer jusqu'à 3 versions d'une même scène.",
  },
  {
    q: "Les vidéos générées m'appartiennent-elles ?",
    a: "Oui, entièrement. Tous les droits sur les vidéos générées t'appartiennent. CLYRO n'utilise pas tes créations pour entraîner ses modèles.",
  },
  {
    q: "Puis-je utiliser ma propre voix ?",
    a: "Oui, avec le clonage vocal. Upload un échantillon de 30 secondes minimum, et CLYRO génère toutes tes voix off avec ta propre voix. Disponible à partir du plan Pro.",
  },
]

function FaqSection() {
  return (
    <section id="faq" className="bg-card py-24 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <SectionHeader
          label="Questions fréquentes"
          labelVariant="neutral"
          title="Tout ce que tu dois savoir"
        />

        <div className="flex flex-col gap-3">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group bg-muted border border-border/50 rounded-xl overflow-hidden"
            >
              <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer list-none select-none">
                <span className="font-display text-sm font-semibold text-foreground">{faq.q}</span>
                <ChevronDown
                  size={16}
                  className="text-[--text-muted] shrink-0 transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <div className="px-6 pb-5">
                <p className="font-body text-sm text-[--text-secondary] leading-relaxed">{faq.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 10. CTA FINAL ─────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <section className="bg-background py-24 px-4 sm:px-6 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grad-glow-blue opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-grad-glow-purple opacity-40" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground">
          Crée ta première vidéo{' '}
          <span className="gradient-text">maintenant.</span>
        </h2>
        <p className="font-body text-lg text-[--text-secondary] mt-4">
          3 vidéos gratuites. Sans carte bancaire. Résultat en moins de 5 minutes.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/signup">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>
              Créer mon compte gratuitement
            </Button>
          </Link>
          <a href="#fonctionnalites">
            <Button variant="ghost" size="lg">Voir une démo →</Button>
          </a>
        </div>
      </div>
    </section>
  )
}

// ── 11. FOOTER ────────────────────────────────────────────────────────────────

const FOOTER_COLS = [
  {
    title: 'Produit',
    links: ['Faceless Videos', 'Motion Design', 'Brand Kit', 'Tarifs', 'API'],
  },
  {
    title: 'Ressources',
    links: ['Documentation', 'Exemples vidéos', 'Blog', 'Changelog', 'Status'],
  },
  {
    title: 'Légal',
    links: ['Politique de confidentialité', 'CGU', 'Mentions légales', 'Contact'],
  },
]

function Footer() {
  return (
    <footer className="bg-card border-t border-border/50 py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Col 1 — Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="font-display text-xl font-bold">
              <span className="text-foreground">CLY</span>
              <span className="gradient-text">RO</span>
            </Link>
            <p className="font-body text-sm text-[--text-muted] mt-2 mb-5">
              De ton script à ta vidéo en 10 minutes.
            </p>
            <div className="flex items-center gap-3">
              {[Twitter, Instagram, Youtube, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[--text-muted] hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Réseau social"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Cols 2–4 */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <h4 className="font-mono text-xs uppercase tracking-wider text-[--text-muted] mb-4">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="font-body text-sm text-[--text-secondary] hover:text-foreground transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border/30 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-mono text-xs text-[--text-muted]">
            © 2026 CLYRO. Tous droits réservés.
          </p>
          <p className="font-mono text-xs text-[--text-muted]">
            Fait avec IA · Hébergé en Europe
          </p>
        </div>
      </div>
    </footer>
  )
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main className="bg-background text-foreground min-h-screen">
      <Header />
      <HeroSection />
      <SocialProof />
      <ProblemSection />
      <SolutionSection />
      <HowItWorks />
      <StylesSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
      <Footer />
    </main>
  )
}
