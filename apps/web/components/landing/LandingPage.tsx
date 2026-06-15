'use client'

import Link from 'next/link'
import {
  ArrowRight, Play, CheckCircle, Clock, DollarSign,
  Frown, FileText, Cpu, Download, ChevronDown,
  Twitter, Linkedin, Youtube, Instagram,
  Sparkles, Video, Palette, Users, Mic,
  Layers, Zap, Globe,
} from 'lucide-react'
import { Button }          from '@/components/ui/button'
import { Badge }           from '@/components/ui/badge'
import { Card }            from '@/components/ui/card'
import { Logo }            from '@/components/ui/Logo'
import { MobileMenu }      from '@/components/landing/mobile-menu'
import { PricingToggle }   from '@/components/landing/pricing-toggle'
import { ThemeToggle }     from '@/components/ui/theme-toggle'
import { HeroScript }      from '@/components/landing/HeroScript'
import { HeroVideo }       from '@/components/landing/HeroVideo'
import { VideoShowcase }   from '@/components/landing/VideoShowcase'
import { ScrollRevealInit } from '@/components/landing/ScrollRevealInit'
import { StickyMobileCta }  from '@/components/landing/StickyMobileCta'
import { LogoBar }          from '@/components/landing/LogoBar'
import { Testimonials }     from '@/components/landing/Testimonials'
import { StatsBar }         from '@/components/landing/StatsBar'
import { UseCases }         from '@/components/landing/UseCases'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

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

// ── NAV ──────────────────────────────────────────────────────────────────────

const NAV_LINK_KEYS = [
  { labelKey: 'lp_navFeatures',  href: '#features' },
  { labelKey: 'lp_navUseCases',  href: '#use-cases' },
  { labelKey: 'lp_navStyles',    href: '#styles' },
  { labelKey: 'lp_navPricing',   href: '/pricing' },
  { labelKey: 'lp_navFaq',       href: '#faq' },
]

// ── FEATURES CONFIG ─────────────────────────────────────────────────────────

interface FeatureConfig {
  icon: React.ReactNode
  iconGrad: string
  badge: { labelKey: string; variant: React.ComponentProps<typeof Badge>['variant'] } | null
  titleKey: string
  descKey: string
  featureKeys: string[]
  gradient: string
}

const FEATURES: FeatureConfig[] = [
  {
    icon:      <Video size={24} />,
    iconGrad:  'from-violet-500 to-blue-500',
    badge:     { labelKey: 'lp_featBadgePop', variant: 'purple' },
    titleKey:  'lp_feat1Title',
    descKey:   'lp_feat1Desc',
    featureKeys: ['lp_feat1F1', 'lp_feat1F2', 'lp_feat1F3', 'lp_feat1F4'],
    gradient:  'from-violet-500/20 to-blue-500/10',
  },
  {
    icon:      <Users size={24} />,
    iconGrad:  'from-emerald-500 to-teal-500',
    badge:     { labelKey: 'lp_featBadgeNew', variant: 'success' },
    titleKey:  'lp_feat2Title',
    descKey:   'lp_feat2Desc',
    featureKeys: ['lp_feat2F1', 'lp_feat2F2', 'lp_feat2F3', 'lp_feat2F4'],
    gradient:  'from-emerald-500/20 to-teal-500/10',
  },
  {
    icon:      <Layers size={24} />,
    iconGrad:  'from-orange-500 to-amber-500',
    badge:     null,
    titleKey:  'lp_feat3Title',
    descKey:   'lp_feat3Desc',
    featureKeys: ['lp_feat3F1', 'lp_feat3F2', 'lp_feat3F3', 'lp_feat3F4'],
    gradient:  'from-orange-500/20 to-amber-500/10',
  },
  {
    icon:      <Palette size={24} />,
    iconGrad:  'from-pink-500 to-rose-500',
    badge:     null,
    titleKey:  'lp_feat4Title',
    descKey:   'lp_feat4Desc',
    featureKeys: ['lp_feat4F1', 'lp_feat4F2', 'lp_feat4F3', 'lp_feat4F4'],
    gradient:  'from-pink-500/20 to-rose-500/10',
  },
]

// ── STEPS CONFIG ────────────────────────────────────────────────────────────

const STEPS = [
  { num: '01', icon: <FileText size={24} />, titleKey: 'lp_step1Title', textKey: 'lp_step1Text' },
  { num: '02', icon: <Cpu size={24} />,      titleKey: 'lp_step2Title', textKey: 'lp_step2Text' },
  { num: '03', icon: <Download size={24} />,  titleKey: 'lp_step3Title', textKey: 'lp_step3Text' },
]

// ── STYLES CONFIG ───────────────────────────────────────────────────────────

interface StyleConfig {
  nameKey: string
  descKey: string
  preview: React.ReactNode
}

const VIDEO_STYLES: StyleConfig[] = [
  {
    nameKey: 'lp_sty1Name', descKey: 'lp_sty1Desc',
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
    nameKey: 'lp_sty2Name', descKey: 'lp_sty2Desc',
    preview: (
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/50 to-zinc-900/80 flex items-center justify-center">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-300/70 blur-[3px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_40%_30%,rgba(251,191,36,0.12)_0%,transparent_60%)]" />
        <div className="absolute bottom-3 left-3 right-3 h-px bg-white/10" />
      </div>
    ),
  },
  {
    nameKey: 'lp_sty3Name', descKey: 'lp_sty3Desc',
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
    nameKey: 'lp_sty4Name', descKey: 'lp_sty4Desc',
    preview: (
      <div className="absolute inset-0 bg-gradient-to-br from-[#1A1F2E] to-[#2A1F3E] flex items-center justify-center">
        <div className="absolute top-1/3 left-1/3 w-3 h-3 rounded-full bg-[#F5A623]/50 blur-[4px]" />
        <div className="absolute bottom-1/3 right-1/3 w-2 h-2 rounded-full bg-[#7C5CFC]/50 blur-[3px]" />
        <div className="w-8 h-10 rounded-lg bg-[#F5A623]/20 border border-[#F5A623]/30" />
      </div>
    ),
  },
  {
    nameKey: 'lp_sty5Name', descKey: 'lp_sty5Desc',
    preview: (
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-pink-500/20 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-purple-400/30 border border-purple-300/40" />
        <div className="absolute bottom-3 right-3 w-5 h-5 rounded-full bg-pink-400/30" />
      </div>
    ),
  },
  {
    nameKey: 'lp_sty6Name', descKey: 'lp_sty6Desc',
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
    nameKey: 'lp_sty7Name', descKey: 'lp_sty7Desc',
    preview: (
      <div className="absolute inset-0 bg-white dark:bg-zinc-900 flex flex-col items-center justify-center gap-1.5 px-4">
        <div className="w-16 h-2 rounded bg-foreground/80" />
        <div className="w-10 h-1.5 rounded bg-foreground/30" />
        <div className="w-12 h-1.5 rounded bg-foreground/20 mt-1" />
      </div>
    ),
  },
  {
    nameKey: 'lp_sty8Name', descKey: 'lp_sty8Desc',
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
]

// ── FAQ CONFIG ──────────────────────────────────────────────────────────────

const FAQ_KEYS = [
  { qKey: 'lp_faq1Q', aKey: 'lp_faq1A' },
  { qKey: 'lp_faq2Q', aKey: 'lp_faq2A' },
  { qKey: 'lp_faq3Q', aKey: 'lp_faq3A' },
  { qKey: 'lp_faq4Q', aKey: 'lp_faq4A' },
  { qKey: 'lp_faq5Q', aKey: 'lp_faq5A' },
  { qKey: 'lp_faq6Q', aKey: 'lp_faq6A' },
  { qKey: 'lp_faq7Q', aKey: 'lp_faq7A' },
]

// ── FOOTER CONFIG ───────────────────────────────────────────────────────────

const FOOTER_COLS = [
  {
    titleKey: 'lp_footProduct',
    links: [
      { labelKey: 'lp_feat1Title',    href: '#features' },
      { labelKey: 'lp_feat2Title',    href: '#features' },
      { labelKey: 'lp_feat3Title',    href: '#features' },
      { labelKey: 'lp_feat4Title',    href: '#features' },
      { labelKey: 'lp_navPricing',    href: '/pricing' },
    ],
  },
  {
    titleKey: 'lp_footResources',
    links: [
      { labelKey: 'lp_footDocs',       href: '/resources/docs' },
      { labelKey: 'lp_footExamples',   href: '/resources/examples' },
      { labelKey: 'lp_footBlog',       href: '/resources/blog' },
      { labelKey: 'lp_footChangelog',  href: '/resources/changelog' },
      { labelKey: 'lp_footStatus',     href: '/resources/status' },
    ],
  },
  {
    titleKey: 'lp_footLegal',
    links: [
      { labelKey: 'lp_footPrivacy',  href: '/legal/privacy' },
      { labelKey: 'lp_footTerms',    href: '/legal/terms' },
      { labelKey: 'lp_footNotice',   href: '/legal/notice' },
      { labelKey: 'lp_footContact',  href: '/legal/contact' },
    ],
  },
]

// ── SECTIONS ────────────────────────────────────────────────────────────────

function Header({ t }: { t: (k: string) => string }) {
  return (
    <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Logo variant="full" size="sm" href="/" />

        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINK_KEYS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-body text-sm text-[--text-secondary] hover:text-foreground transition-colors"
            >
              {t(l.labelKey)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">{t('lp_signIn')}</Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm">{t('lp_getStartedFree')}</Button>
          </Link>
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}

function HeroSection({ t }: { t: (k: string) => string }) {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center pt-16 overflow-hidden"
    >
      <div className="pointer-events-none absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-[var(--primary)]/10 blur-[80px]" />
      <div className="pointer-events-none absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-[var(--secondary)]/10 blur-[80px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[100px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-12 w-full text-center">
        <div className="flex justify-center mb-6">
          <Badge variant="purple" dot className="inline-flex">
            {t('lp_heroBadge')}
          </Badge>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.08] text-foreground max-w-4xl mx-auto">
          {t('lp_heroTitle1')}{' '}
          <span className="gradient-text">{t('lp_heroTitleAccent')}</span>
          <br className="hidden sm:block" />
          {t('lp_heroTitle2')}
        </h1>

        <p className="font-body text-lg md:text-xl text-[--text-secondary] max-w-2xl mx-auto mt-6 leading-relaxed">
          {t('lp_heroSubtitle')}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <Link href="/signup">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>
              {t('lp_getStartedFree')}
            </Button>
          </Link>
          <a href="#showcase">
            <Button variant="secondary" size="lg" leftIcon={<Play size={16} />}>
              {t('lp_heroWatchExamples')}
            </Button>
          </a>
        </div>

        <p className="font-mono text-xs text-[--text-muted] mt-6">
          {t('lp_heroTrust1')} &nbsp;&middot;&nbsp; {t('lp_heroTrust2')} &nbsp;&middot;&nbsp; {t('lp_heroTrust3')}
        </p>

        <div className="relative mt-12 max-w-4xl mx-auto">
          <HeroVideo />
          <div className="absolute -bottom-6 inset-x-8 h-12 bg-blue-500/10 blur-2xl rounded-full" />
        </div>
      </div>
    </section>
  )
}

function FeaturesSection({ t }: { t: (k: string) => string }) {
  return (
    <section id="features" className="bg-background py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="reveal">
          <SectionHeader
            label={t('lp_featLabel')}
            title={<>{t('lp_featTitle1')} <span className="gradient-text">{t('lp_featTitleAccent')}</span></>}
            subtitle={t('lp_featSubtitle')}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6 stagger">
          {FEATURES.map((feat) => (
            <div key={feat.titleKey} className="reveal">
              <Card variant="elevated" hoverable className="h-full">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feat.iconGrad} text-white shrink-0`}>
                    {feat.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-xl font-bold text-foreground">{t(feat.titleKey)}</h3>
                      {feat.badge && <Badge variant={feat.badge.variant}>{t(feat.badge.labelKey)}</Badge>}
                    </div>
                    <p className="font-body text-sm text-[--text-secondary] mt-1 leading-relaxed">{t(feat.descKey)}</p>
                  </div>
                </div>

                <ul className="flex flex-col gap-2.5 mt-4">
                  {feat.featureKeys.map((fk) => (
                    <li key={fk} className="flex items-start gap-2.5">
                      <CheckCircle size={15} className="text-success shrink-0 mt-0.5" />
                      <span className="font-body text-sm text-[--text-secondary]">{t(fk)}</span>
                    </li>
                  ))}
                </ul>

                <div className={`mt-6 aspect-[21/9] rounded-xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center border border-border/30`}>
                  <span className="font-mono text-xs text-[--text-muted]">{t(feat.titleKey)} Preview</span>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks({ t }: { t: (k: string) => string }) {
  return (
    <section className="bg-card py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="reveal">
          <SectionHeader
            label={t('lp_hiwLabel')}
            labelVariant="neutral"
            title={t('lp_hiwTitle')}
            subtitle={t('lp_hiwSubtitle')}
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
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">{t(step.titleKey)}</h3>
              <p className="font-body text-sm text-[--text-secondary] leading-relaxed">{t(step.textKey)}</p>
            </div>
          ))}
        </div>

        <div className="reveal mt-16 max-w-xl mx-auto">
          <HeroScript />
        </div>
      </div>
    </section>
  )
}

function StylesSection({ t }: { t: (k: string) => string }) {
  return (
    <section id="styles" className="bg-background py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="reveal">
          <SectionHeader
            label={t('lp_styLabel')}
            title={<>{t('lp_styTitle1')} <span className="gradient-text">{t('lp_styTitleAccent')}</span></>}
            subtitle={t('lp_stySubtitle')}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
          {VIDEO_STYLES.map((style) => (
            <div key={style.nameKey} className="reveal group rounded-2xl overflow-hidden border border-border/60 bg-card hover:border-border hover:shadow-card-hover transition-all duration-200 cursor-pointer">
              <div className="relative aspect-video overflow-hidden">
                {style.preview}
                <div className="absolute inset-0 bg-[var(--primary)]/0 group-hover:bg-[var(--primary)]/5 transition-colors duration-200" />
              </div>
              <div className="p-3">
                <h3 className="font-display text-sm font-semibold text-foreground">{t(style.nameKey)}</h3>
                <p className="font-body text-xs text-[--text-muted] mt-0.5">{t(style.descKey)}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="reveal text-center font-mono text-xs text-[--text-muted] mt-6">
          {t('lp_styMore')}
        </p>
      </div>
    </section>
  )
}

function PricingSection({ t }: { t: (k: string) => string }) {
  return (
    <section id="pricing" className="bg-card py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="reveal">
          <SectionHeader
            label={t('lp_pricLabel')}
            labelVariant="neutral"
            title={<>{t('lp_pricTitle1')} <span className="gradient-text">{t('lp_pricTitleAccent')}</span></>}
            subtitle={t('lp_pricSubtitle')}
          />
        </div>
        <PricingToggle />
        <div className="mt-10 text-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 font-display text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            {t('lp_pricLink')}
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

function FaqSection({ t }: { t: (k: string) => string }) {
  return (
    <section id="faq" className="bg-background py-24 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="reveal">
          <SectionHeader
            label={t('lp_faqLabel')}
            labelVariant="neutral"
            title={t('lp_faqTitle')}
          />
        </div>

        <div className="flex flex-col gap-3">
          {FAQ_KEYS.map((faq) => (
            <details
              key={faq.qKey}
              className="group bg-card border border-border/50 rounded-xl overflow-hidden reveal"
            >
              <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer list-none select-none">
                <span className="font-display text-sm font-semibold text-foreground">{t(faq.qKey)}</span>
                <ChevronDown
                  size={16}
                  className="text-[--text-muted] shrink-0 transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <div className="px-6 pb-5">
                <p className="font-body text-sm text-[--text-secondary] leading-relaxed">{t(faq.aKey)}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaSection({ t }: { t: (k: string) => string }) {
  return (
    <section className="bg-card py-24 px-4 sm:px-6 relative overflow-hidden reveal">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <Badge variant="info" className="mb-6">{t('lp_ctaBadge')}</Badge>
        <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground">
          {t('lp_ctaTitle1')}{' '}
          <span className="gradient-text">{t('lp_ctaTitleAccent')}</span>
        </h2>
        <p className="font-body text-lg text-[--text-secondary] mt-4">
          {t('lp_ctaSubtitle')}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/signup">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>
              {t('lp_ctaPrimary')}
            </Button>
          </Link>
          <a href="#features">
            <Button variant="ghost" size="lg">{t('lp_ctaSecondary')}</Button>
          </a>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
          {['lp_ctaCheck1', 'lp_ctaCheck2', 'lp_ctaCheck3'].map((key) => (
            <div key={key} className="flex items-center gap-2">
              <CheckCircle size={14} className="text-success" />
              <span className="font-mono text-xs text-[--text-muted]">{t(key)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer({ t }: { t: (k: string) => string }) {
  return (
    <footer className="bg-background border-t border-border/50 py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Logo variant="full" size="sm" href="/" />
            <p className="font-body text-sm text-[--text-muted] mt-2 mb-5">
              {t('lp_footSlogan')}
            </p>
            <div className="flex items-center gap-3">
              {[Twitter, Instagram, Youtube, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[--text-muted] hover:text-foreground hover:bg-muted transition-colors"
                  aria-label={t('lp_footSocial')}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.titleKey}>
              <h4 className="font-mono text-xs uppercase tracking-wider text-[--text-muted] mb-4">
                {t(col.titleKey)}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      className="font-body text-sm text-[--text-secondary] hover:text-foreground transition-colors"
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border/30 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-mono text-xs text-[--text-muted]">
            {t('lp_footCopyright')}
          </p>
          <p className="font-mono text-xs text-[--text-muted]">
            {t('lp_footPowered')}
          </p>
        </div>
      </div>
    </footer>
  )
}

// ── MAIN EXPORT ─────────────────────────────────────────────────────────────

export function LandingPage() {
  const { t } = useLanguage()

  return (
    <main className="bg-background text-foreground min-h-screen">
      <ScrollRevealInit />
      <StickyMobileCta heroId="hero" />

      <Header t={t} />
      <HeroSection t={t} />

      <LogoBar />

      <div id="showcase">
        <VideoShowcase />
      </div>

      <StatsBar />

      <FeaturesSection t={t} />
      <HowItWorks t={t} />

      <section id="use-cases" className="bg-background py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="reveal">
            <SectionHeader
              label={t('lp_ucSectionLabel')}
              labelVariant="cyan"
              title={<>{t('lp_ucSectionTitle1')} <span className="gradient-text">{t('lp_ucSectionTitleAccent')}</span></>}
              subtitle={t('lp_ucSectionSubtitle')}
            />
          </div>
          <UseCases />
        </div>
      </section>

      <StylesSection t={t} />

      <section className="bg-card py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="reveal">
            <SectionHeader
              label={t('lp_testimLabel')}
              labelVariant="success"
              title={<>{t('lp_testimTitle1')} <span className="gradient-text">{t('lp_testimTitleAccent')}</span></>}
              subtitle={t('lp_testimSubtitle')}
            />
          </div>
          <Testimonials />
        </div>
      </section>

      <PricingSection t={t} />
      <FaqSection t={t} />
      <CtaSection t={t} />
      <Footer t={t} />
    </main>
  )
}
