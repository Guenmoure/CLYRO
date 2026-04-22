// app/page.tsx — Landing Page CLYRO (public)
// Server Component — pas de 'use client'

import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRight, Play, CheckCircle, Clock, DollarSign,
  Frown, FileText, Cpu, Download, ChevronDown,
  Twitter, Linkedin, Youtube, Instagram,
} from 'lucide-react'
import { Button }        from '@/components/ui/button'
import { Badge }         from '@/components/ui/badge'
import { Card }          from '@/components/ui/card'
import { Logo }          from '@/components/ui/Logo'
import { MobileMenu }    from '@/components/landing/mobile-menu'
import { PricingToggle } from '@/components/landing/pricing-toggle'
import { ThemeToggle }   from '@/components/ui/theme-toggle'
import { HeroScript }      from '@/components/landing/HeroScript'
import { HeroVideo }       from '@/components/landing/HeroVideo'
import { VideoShowcase }   from '@/components/landing/VideoShowcase'
import { ScrollRevealInit } from '@/components/landing/ScrollRevealInit'
import { StickyMobileCta }  from '@/components/landing/StickyMobileCta'

export const metadata: Metadata = {
  title: 'CLYRO — AI Video Generation in Less Than 5 Minutes',
  description:
    'Paste your script. Choose a style. Your video is ready. Faceless videos, AI avatars, motion design — entirely AI-powered.',
  keywords: ['AI video', 'faceless videos', 'motion graphics', 'brand kit', 'video generation'],
  openGraph: {
    title: 'CLYRO — AI Video Generation',
    description: 'Paste your script. Choose a style. Your video is ready in under 5 minutes.',
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

function SectionHeader({ label, labelVariant, title, subtitle }: {
  label: string
  labelVariant?: React.ComponentProps<typeof Badge>['variant']
  title: React.ReactNode
  subtitle?: string
}) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-12">
      <SectionLabel variant={labelVariant}>{label}</SectionLabel>
      <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
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
  { label: 'Features',      href: '#features' },
  { label: 'Avatar Studio', href: '#avatar-studio' },
  { label: 'Styles',        href: '#styles' },
  { label: 'Pricing',       href: '/pricing' },
  { label: 'FAQ',           href: '#faq' },
]

function Header() {
  return (
    <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Logo variant="full" size="sm" href="/" />

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

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm">Get started free</Button>
          </Link>
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}

// ── 2. HERO — split layout ────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center pt-16 overflow-hidden noise-overlay"
    >
      {/* Glow blobs */}
      <div className="pointer-events-none absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-[var(--primary)]/10 blur-[80px]" />
      <div className="pointer-events-none absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-[var(--secondary)]/10 blur-[80px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 w-full
                      grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

        {/* ══ LEFT — Text + CTA + Textarea ══ */}
        <div className="space-y-6 order-last lg:order-first">
          <Badge variant="info" dot className="inline-flex">
            AI Video Generation
          </Badge>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] text-foreground">
            Paste your script.{' '}
            <br className="hidden sm:block" />
            <span className="gradient-text">Choose a style.</span>
            <br />
            Your video is ready.
          </h1>

          <p className="font-body text-lg text-[--text-secondary] max-w-lg leading-relaxed">
            CLYRO turns your text into a publish-ready video — AI voice,
            animated scenes, karaoke subtitles — in under 5 minutes.
            No editor. No agency.
          </p>

          {/* Textarea client island */}
          <HeroScript />

          <p className="font-mono text-xs text-[--text-muted]">
            ✓ 250 free credits on signup &nbsp;·&nbsp; ✓ No credit card required &nbsp;·&nbsp; ✓ Results in under 5 min
          </p>
        </div>

        {/* ══ RIGHT — Video preview ══ */}
        <div className="relative order-first lg:order-last">
          {/* HeroVideo gère l'état chargé/erreur : placeholder masqué dès que la vidéo joue */}
          <HeroVideo />
          {/* Depth shadow */}
          <div className="absolute -bottom-6 inset-x-8 h-12 bg-blue-500/10 blur-2xl rounded-full" />
        </div>
      </div>
    </section>
  )
}

// ── 4. PROBLEM ────────────────────────────────────────────────────────────────

const PROBLEMS = [
  {
    icon:      <Clock size={22} />,
    iconColor: 'text-error',
    iconBg:    'bg-error/10',
    title:     'Hours of editing',
    text:      'Finding visuals, cutting, color grading, exporting... A 2-minute video = a full day of work.',
  },
  {
    icon:      <DollarSign size={22} />,
    iconColor: 'text-warning',
    iconBg:    'bg-warning/10',
    title:     'Agency costs are sky-high',
    text:      'A professional video costs $500–$5,000. Unaffordable for scaling content production.',
  },
  {
    icon:      <Frown size={22} />,
    iconColor: 'text-purple-400',
    iconBg:    'bg-purple-500/10',
    title:     'Inconsistent results',
    text:      "Switching freelancers, tools, and styles with every video. No brand consistency over time.",
  },
]

function ProblemSection() {
  return (
    <section id="features" className="bg-background py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="reveal">
          <SectionHeader
            label="The problem"
            labelVariant="error"
            title="Video creation takes too much time"
            subtitle="Creators spend 80% of their time producing, not creating."
          />
        </div>
        <div className="grid md:grid-cols-3 gap-6 stagger">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="reveal">
              <Card variant="elevated" hoverable>
                <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${p.iconBg} ${p.iconColor} mb-4`}>
                  {p.icon}
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">{p.title}</h3>
                <p className="font-body text-sm text-[--text-secondary] leading-relaxed">{p.text}</p>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 5. SOLUTION ───────────────────────────────────────────────────────────────

const MODULES = [
  {
    badge:       { label: 'Module 1', variant: 'purple' as const },
    title:       'Animated faceless videos',
    desc:        "Paste your script, choose from 6 visual styles, pick a voice — CLYRO generates your complete video with animated scenes, voiceover, and karaoke subtitles.",
    features:    [
      '6 styles: 2D Animation, Cinematic, Whiteboard, and more',
      'Karaoke subtitles auto-synced to the voiceover',
      'Regenerate individual scenes without restarting',
    ],
    reverse:     false,
    previewGradient: 'from-violet-500/30 to-blue-500/20',
    previewLabel:    'Faceless Video · 6 scenes',
  },
  {
    badge:       { label: 'New · AI Avatar Studio', variant: 'purple' as const, dot: true },
    title:       'AI avatars that speak your script',
    desc:        "Pick a photorealistic presenter from hundreds of avatars — Professional, UGC, Lifestyle — or paste a YouTube URL and let CLYRO re-voice it. Each avatar ships with multiple looks.",
    features:    [
      'Hundreds of avatars across Professional, UGC, Lifestyle categories',
      'Narration in 12 languages with cloned or premade voices',
      'Script or YouTube URL → publish-ready video',
    ],
    reverse:     true,
    previewGradient: 'from-emerald-500/30 to-teal-500/20',
    previewLabel:    'Avatar Studio · 4 looks',
  },
  {
    badge:       { label: 'Module 3', variant: 'info' as const },
    title:       'After Effects–style motion design',
    desc:        "Create ads, product launches, and animated teasers. Define your brief, CLYRO generates a structured storyboard and renders your video with professional animations.",
    features:    [
      '9:16, 1:1, 16:9 — ready for every platform',
      'Visual assets generated to match your brand feel',
      'Auto-generated thumbnails for ads',
    ],
    reverse:     false,
    previewGradient: 'from-orange-500/30 to-amber-500/20',
    previewLabel:    'Motion Design · 4 slides',
  },
  {
    badge:       { label: 'Module 4', variant: 'info' as const },
    title:       'Complete brand identity in 15 minutes',
    desc:        "CLYRO generates your logo, color palette, typefaces, mockups, and professional brand guidelines PDF — from a simple text brief.",
    features:    [
      '3 creative directions to choose from',
      'Automatic WCAG color compliance check',
      'Brand kit ZIP export (PNG/SVG logos, ASE palette, brand PDF)',
    ],
    reverse:     true,
    previewGradient: 'from-pink-500/30 to-rose-500/20',
    previewLabel:    'Brand Kit · 3 directions',
  },
]

function SolutionSection() {
  return (
    <section className="bg-card py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="reveal">
          <SectionHeader
            label="The CLYRO solution"
            title={<>Four tools. <span className="gradient-text">One workflow.</span></>}
          />
        </div>

        <div className="flex flex-col gap-20">
          {MODULES.map((mod, i) => (
            <div
              key={i}
              id={mod.badge.label.includes('Avatar Studio') ? 'avatar-studio' : undefined}
              className={`reveal flex flex-col ${mod.reverse ? 'md:flex-row-reverse' : 'md:flex-row'} gap-12 items-center scroll-mt-24`}
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
                <Link href="/signup">
                  <Button variant="secondary" size="md">Try it free →</Button>
                </Link>
              </div>

              {/* Preview card */}
              <div className="flex-1 w-full">
                <Card variant="glass" padding="md" className="w-full">
                  <div className={`aspect-video rounded-xl bg-gradient-to-br ${mod.previewGradient} flex items-center justify-center`}>
                    <span className="font-mono text-xs text-white/60">{mod.previewLabel}</span>
                  </div>
                </Card>
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
    title: 'Write or paste your script',
    text:  'A few words or 10,000 characters. CLYRO intelligently breaks it into coherent visual scenes.',
  },
  {
    num:   '02',
    icon:  <Cpu size={24} />,
    title: 'AI generates everything',
    text:  'Images, animations, voiceover, karaoke subtitles — all in parallel, in minutes.',
  },
  {
    num:   '03',
    icon:  <Download size={24} />,
    title: 'Download and publish',
    text:  "MP4 ready to upload to YouTube, TikTok, or Instagram. No additional editing needed.",
  },
]

function HowItWorks() {
  return (
    <section className="bg-background py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="reveal">
          <SectionHeader
            label="How it works"
            labelVariant="neutral"
            title="Ready in 3 steps"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative stagger">
          <div
            className="hidden md:block absolute top-[28px] left-[calc(33.33%-1px)] right-[calc(33.33%-1px)] h-px border-t border-dashed border-border z-0"
            aria-hidden="true"
          />

          {STEPS.map((step) => (
            <div key={step.num} className="reveal flex flex-col items-center text-center relative z-10">
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
    name: '2D Animation',
    desc: 'Animated cartoon characters',
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
    name: 'Stock + Voiceover',
    desc: 'Professional realistic images',
    preview: (
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/60 to-slate-900/70">
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
    name: 'Minimalist',
    desc: 'Clean and impactful typography',
    preview: (
      <div className="absolute inset-0 bg-white dark:bg-zinc-900 flex flex-col items-center justify-center gap-1.5 px-4">
        <div className="w-16 h-2 rounded bg-foreground/80" />
        <div className="w-10 h-1.5 rounded bg-foreground/30" />
        <div className="w-12 h-1.5 rounded bg-foreground/20 mt-1" />
      </div>
    ),
  },
  {
    name: 'Infographics',
    desc: 'Data visualized in motion',
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
    desc: 'Live drawing explanations',
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
    name: 'Cinematic',
    desc: 'Epic shots, premium feel',
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
        <div className="reveal">
          <SectionHeader
            label="6 styles available"
            title="A style for every type of content"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 stagger">
          {VIDEO_STYLES.map((style) => (
            <div key={style.name} className="reveal group rounded-2xl overflow-hidden border border-border/60 bg-card hover:border-border hover:shadow-card-hover transition-all duration-200 cursor-pointer">
              <div className="relative aspect-video overflow-hidden">
                {style.preview}
                <div className="absolute inset-0 bg-[var(--primary)]/0 group-hover:bg-[var(--primary)]/5 transition-colors duration-200" />
              </div>
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
    <section id="pricing" className="bg-background py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="reveal">
          <SectionHeader
            label="Pricing"
            labelVariant="neutral"
            title="Simple. Transparent. No surprises."
          />
        </div>
        <PricingToggle />
        <div className="mt-10 text-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 font-display text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            View full pricing details
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── 9. FAQ ────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "How long does it take to generate a video?",
    a: "For a 30-second Faceless video (5–6 scenes), expect 3 to 5 minutes of generation time. Motion Design is slightly faster since it doesn't use image-to-video animation.",
  },
  {
    q: "Can I edit scenes after generation?",
    a: "Yes. CLYRO lets you regenerate each scene individually without re-running the entire video. You can edit the prompt, ask for AI improvements, or compare up to 3 versions of the same scene.",
  },
  {
    q: "Do I own the generated videos?",
    a: "Yes, completely. You own all rights to your generated videos. CLYRO doesn't use your creations to train its models.",
  },
  {
    q: "Can I use my own voice?",
    a: "Yes, with voice cloning. Upload a 30-second sample minimum, and CLYRO generates all your voiceovers with your own voice. Available in the Pro plan and above.",
  },
  {
    q: "What AI avatars are available in the Avatar Studio?",
    a: "CLYRO ships with hundreds of photorealistic avatars grouped by category — Professional, Lifestyle, UGC, and Community. Each avatar has several looks so you can stay on-brand across videos.",
  },
]

function FaqSection() {
  return (
    <section id="faq" className="bg-card py-24 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="reveal">
          <SectionHeader
            label="Frequently asked questions"
            labelVariant="neutral"
            title="Everything you need to know"
          />
        </div>

        <div className="flex flex-col gap-3">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group bg-muted border border-border/50 rounded-xl overflow-hidden reveal"
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
    <section className="bg-background py-24 px-4 sm:px-6 relative overflow-hidden reveal">
      <div className="pointer-events-none absolute inset-0 bg-grad-glow-blue opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-grad-glow-purple opacity-40" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground">
          Create your first video{' '}
          <span className="gradient-text">now.</span>
        </h2>
        <p className="font-body text-lg text-[--text-secondary] mt-4">
          250 free credits. No credit card. Results in under 5 minutes.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/signup">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>
              Create free account
            </Button>
          </Link>
          <a href="#features">
            <Button variant="ghost" size="lg">See examples →</Button>
          </a>
        </div>
      </div>
    </section>
  )
}

// ── 11. FOOTER ────────────────────────────────────────────────────────────────

// Each link is a [label, href] tuple. `#` placeholders are kept for Product
// entries that anchor to sections still in flux on the landing page; the
// Resources and Legal columns point to real pages under /resources/* and
// /legal/*. Keep this list in sync with the files under app/(public)/.
const FOOTER_COLS: Array<{ title: string; links: Array<[string, string]> }> = [
  {
    title: 'Product',
    links: [
      ['Faceless Videos',   '#features'],
      ['AI Avatar Studio',  '#avatar-studio'],
      ['Motion Design',     '#styles'],
      ['Brand Kit',         '#features'],
      ['Pricing',           '/pricing'],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['Documentation',   '/resources/docs'],
      ['Video examples',  '/resources/examples'],
      ['Blog',            '/resources/blog'],
      ['Changelog',       '/resources/changelog'],
      ['Status',          '/resources/status'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['Privacy policy',    '/legal/privacy'],
      ['Terms of service',  '/legal/terms'],
      ['Legal notice',      '/legal/notice'],
      ['Contact',           '/legal/contact'],
    ],
  },
]

function Footer() {
  return (
    <footer className="bg-card border-t border-border/50 py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Logo variant="full" size="sm" href="/" />
            <p className="font-body text-sm text-[--text-muted] mt-2 mb-5">
              From script to video in 5 minutes.
            </p>
            <div className="flex items-center gap-3">
              {[Twitter, Instagram, Youtube, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[--text-muted] hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Social network"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <h4 className="font-mono text-xs uppercase tracking-wider text-[--text-muted] mb-4">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="font-body text-sm text-[--text-secondary] hover:text-foreground transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border/30 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-mono text-xs text-[--text-muted]">
            © 2026 CLYRO. All rights reserved.
          </p>
          <p className="font-mono text-xs text-[--text-muted]">
            Powered by AI · Hosted in Europe
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
      {/* Client-side scroll reveal observer + sticky CTA */}
      <ScrollRevealInit />
      <StickyMobileCta heroId="hero" />

      <Header />
      <HeroSection />

      {/* "Made with CLYRO" carousel — replaces fake stats */}
      <VideoShowcase />

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
