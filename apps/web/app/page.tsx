import Link from 'next/link'
import { Video, Wand2, Palette, Check, Play, ArrowRight, Zap, Layers, Globe, Star, ChevronRight } from 'lucide-react'
import { Reveal } from '@/components/ui/reveal'
import { Navbar } from '@/components/shared/navbar'
import type { Metadata } from 'next'

// ─────────────────────────────────────────────────────────────────────────────
// Page — Server Component (no 'use client')
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-navy-950 font-body overflow-x-hidden transition-colors duration-300">
      {/* ── Fixed Navbar ─────────────────────────────────────────────────── */}
      <Navbar />

      {/* ================================================================
          HERO SECTION
          ================================================================ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-6 grid-bg overflow-hidden">
        {/* Floating glow blobs */}
        <div className="animate-float absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-clyro-blue/10 blur-[100px] pointer-events-none" />
        <div className="animate-float-2 absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-clyro-purple/10 blur-[80px] pointer-events-none" />
        <div className="animate-float-rev absolute bottom-1/4 left-1/2 w-[350px] h-[350px] rounded-full bg-clyro-cyan/[0.08] blur-[90px] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Badge pill */}
          <Reveal>
            <div className="inline-flex items-center gap-2 glass-pill px-4 py-2 rounded-full mb-8">
              <span className="text-clyro-cyan text-sm">✦</span>
              <span className="font-mono text-xs uppercase tracking-widest text-gray-500 dark:text-white/60">AI · Faceless · Motion · Voice</span>
            </div>
          </Reveal>

          {/* Main headline */}
          <Reveal delay={80}>
            <h1 className="font-display font-extrabold text-6xl md:text-7xl lg:text-8xl leading-tight mb-6">
              <span className="text-gray-900 dark:text-white block">Create videos</span>
              <span className="text-gradient-animated block">that go viral.</span>
            </h1>
          </Reveal>

          {/* Subtext */}
          <Reveal delay={160}>
            <p className="text-gray-500 dark:text-white/55 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              From your script to a polished YouTube, TikTok or Instagram video —{' '}
              <span className="text-gray-800 dark:text-white/80">in under 5 minutes.</span> No camera. No editor.
            </p>
          </Reveal>

          {/* CTA row */}
          <Reveal delay={240}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
              <Link
                href="/signup"
                className="shimmer animate-glow-cta inline-flex items-center gap-2 bg-gradient-to-r from-clyro-blue to-clyro-purple text-white font-semibold text-base px-8 py-4 rounded-2xl hover:opacity-90 transition-opacity duration-200"
              >
                Create my first video <ArrowRight size={18} />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 glass glass-hover text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white font-medium text-base px-7 py-4 rounded-2xl transition-colors duration-200"
              >
                <Play size={16} className="text-clyro-cyan" /> Watch how it works
              </a>
            </div>
            <p className="text-gray-400 dark:text-white/30 text-sm">Free · No credit card · 3 videos on signup</p>
          </Reveal>
        </div>

        {/* ── Big product mockup ──────────────────────────────────────── */}
        <Reveal className="relative z-10 w-full max-w-4xl mx-auto mt-16">
          <div className="glass rounded-3xl overflow-hidden shadow-2xl border border-black/[0.08] dark:border-white/10">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02]">
              <span className="w-3 h-3 rounded-full bg-red-400/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <span className="w-3 h-3 rounded-full bg-green-400/70" />
              <span className="ml-4 flex items-center gap-1 font-mono text-xs text-gray-400 dark:text-white/30">
                <span className="text-clyro-cyan">C</span>LYRO — Dashboard
              </span>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-1 px-5 pt-4 pb-0 border-b border-black/[0.06] dark:border-white/[0.06]">
              <button type="button" className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white border-b-2 border-clyro-blue -mb-px">
                Faceless
              </button>
              <button type="button" className="px-4 py-2.5 text-sm font-medium text-gray-400 dark:text-white/40 border-b-2 border-transparent -mb-px">
                Motion
              </button>
              <button type="button" className="px-4 py-2.5 text-sm font-medium text-gray-400 dark:text-white/40 border-b-2 border-transparent -mb-px">
                Voices
              </button>
            </div>

            {/* Faceless tab content */}
            <div className="p-6">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-400 dark:text-white/30 mb-4">Choose your style</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { emoji: '🎥', label: 'Cinématique', active: true },
                  { emoji: '🎬', label: 'Stock + VO',  active: false },
                  { emoji: '✏️', label: 'Whiteboard',  active: false },
                  { emoji: '🖊️', label: 'Stickman',    active: false },
                  { emoji: '⚡', label: 'Motion Graphics', active: false },
                  { emoji: '🎨', label: 'Animation 2D', active: false },
                ].map(({ emoji, label, active }) => (
                  <div
                    key={label}
                    className={`glass rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 ${
                      active
                        ? 'ring-2 ring-clyro-blue/70 bg-clyro-blue/10 border-clyro-blue/30'
                        : 'glass-hover'
                    }`}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span className="text-xs font-medium text-gray-600 dark:text-white/70 text-center">{label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex-1 glass rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400 dark:text-white/25 font-mono">Your script here…</p>
                </div>
                <button type="button" className="shimmer bg-gradient-to-r from-clyro-blue to-clyro-purple text-white text-sm font-semibold px-5 py-3 rounded-xl whitespace-nowrap">
                  Generate →
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================================================================
          STATS / TRUST BAR
          ================================================================ */}
      <div className="glass-heavy glass-border-t glass-border-b py-5 px-6">
        <Reveal>
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            <span className="text-gray-400 dark:text-white/35 text-sm font-medium">Trusted by creators</span>
            <span className="w-px h-4 bg-gray-200 dark:bg-white/10 hidden sm:block" />
            {[
              { value: '10,000+', label: 'videos generated' },
              { value: '500+',    label: 'active creators' },
              { value: '< 5 min', label: 'per video' },
              { value: '7',       label: 'visual styles' },
            ].map(({ value, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="font-display font-extrabold text-xl text-gray-900 dark:text-white">{value}</span>
                <span className="text-gray-400 dark:text-white/35 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* ================================================================
          FEATURE SECTIONS
          ================================================================ */}
      <div id="modules" className="max-w-6xl mx-auto px-6">

        {/* ── Feature 1: Faceless Video — Text LEFT, Mockup RIGHT ──── */}
        <section className="py-28 flex flex-col md:flex-row items-center gap-16">
          {/* Text side */}
          <Reveal className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 glass-pill px-3 py-1.5 rounded-full mb-6">
              <Video size={13} className="text-clyro-blue" />
              <span className="font-mono text-xs uppercase tracking-widest text-clyro-blue">Faceless Video</span>
            </div>
            <h2 className="font-display font-extrabold text-4xl md:text-5xl text-gray-900 dark:text-white mb-5 leading-tight">
              Go viral without<br />showing your face.
            </h2>
            <p className="text-gray-500 dark:text-white/50 text-lg leading-relaxed mb-8">
              Write your script. CLYRO storyboards, illustrates, and voices it — YouTube, TikTok, Instagram, all formats.
            </p>
            <ul className="space-y-3 mb-10">
              {[
                '7 visual styles',
                'HD MP4 export',
                'Voiceover included',
                '9:16 · 1:1 · 16:9 formats',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-600 dark:text-white/65 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-clyro-blue/20 flex items-center justify-center">
                    <Check size={11} className="text-clyro-blue" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 text-clyro-blue font-semibold hover:gap-3 transition-all duration-200"
            >
              Start creating Faceless videos <ArrowRight size={16} />
            </Link>
          </Reveal>

          {/* Mockup side */}
          <Reveal className="flex-1 min-w-0 w-full" delay={120}>
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                <span className="ml-3 text-xs text-gray-400 dark:text-white/25 font-mono">Nouvelle vidéo Faceless</span>
              </div>
              <div className="p-5">
                <p className="text-xs font-mono uppercase tracking-widest text-gray-400 dark:text-white/30 mb-4">Style visuel</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { emoji: '🎥', label: 'Cinématique', selected: true },
                    { emoji: '🎬', label: 'Stock+VO',     selected: false },
                    { emoji: '✏️', label: 'Whiteboard',   selected: false },
                    { emoji: '🖊️', label: 'Stickman',     selected: false },
                    { emoji: '⚡', label: 'Motion Gfx',   selected: false },
                    { emoji: '🎨', label: 'Anim. 2D',     selected: false },
                  ].map(({ emoji, label, selected }) => (
                    <div
                      key={label}
                      className={`rounded-xl p-3 flex flex-col items-center gap-1.5 ${
                        selected
                          ? 'ring-2 ring-clyro-blue/60 bg-clyro-blue/12'
                          : 'glass'
                      }`}
                    >
                      <span className="text-xl">{emoji}</span>
                      <span className="text-[10px] text-gray-500 dark:text-white/60 text-center font-medium">{label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 glass rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400 dark:text-white/20 font-mono">Votre script ici…</p>
                </div>
                <div className="mt-3 flex justify-end">
                  <span className="text-xs text-gray-400 dark:text-white/30 font-mono">Format: 9:16 · HD · FR</span>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Feature 2: Motion Design — Mockup LEFT, Text RIGHT ───── */}
        <section className="py-28 flex flex-col md:flex-row-reverse items-center gap-16">
          {/* Text side */}
          <Reveal className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 glass-pill px-3 py-1.5 rounded-full mb-6">
              <Zap size={13} className="text-clyro-purple" />
              <span className="font-mono text-xs uppercase tracking-widest text-clyro-purple">Motion Design</span>
            </div>
            <h2 className="font-display font-extrabold text-4xl md:text-5xl text-gray-900 dark:text-white mb-5 leading-tight">
              After Effects quality.<br />Zero experience needed.
            </h2>
            <p className="text-gray-500 dark:text-white/50 text-lg leading-relaxed mb-8">
              Describe your product. Add your brand colors. CLYRO generates a polished animated ad in minutes.
            </p>
            <ul className="space-y-3 mb-10">
              {[
                'Brand colors & logo',
                'Animated typography',
                'Voiceover sync',
                '9:16 · 16:9 formats',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-600 dark:text-white/65 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-clyro-purple/20 flex items-center justify-center">
                    <Check size={11} className="text-clyro-purple" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 text-clyro-purple font-semibold hover:gap-3 transition-all duration-200"
            >
              Create a Motion ad <ArrowRight size={16} />
            </Link>
          </Reveal>

          {/* Mockup side */}
          <Reveal className="flex-1 min-w-0 w-full" delay={120}>
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                <span className="ml-3 text-xs text-gray-400 dark:text-white/25 font-mono">Motion Design — Brief</span>
              </div>
              <div className="p-5 space-y-5">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-gray-400 dark:text-white/30 mb-2">Votre brief</p>
                  <div className="glass rounded-xl px-4 py-3 h-20 flex items-start">
                    <p className="text-sm text-gray-400 dark:text-white/30">Une pub dynamique pour mon application de productivité, style corporate moderne…</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-gray-400 dark:text-white/30 mb-3">Couleur principale</p>
                  <div className="flex items-center gap-2">
                    {[
                      { bg: 'bg-clyro-blue',   ring: true },
                      { bg: 'bg-clyro-purple', ring: false },
                      { bg: 'bg-red-500',      ring: false },
                      { bg: 'bg-yellow-400',   ring: false },
                    ].map(({ bg, ring }, i) => (
                      <span
                        key={i}
                        className={`w-7 h-7 rounded-full ${bg} cursor-pointer ${
                          ring ? 'ring-2 ring-white/40 ring-offset-2 ring-offset-transparent' : ''
                        }`}
                      />
                    ))}
                    <span className="ml-1 glass rounded-lg px-3 py-1.5 text-xs text-gray-500 dark:text-white/40 font-mono">#3B8EF0</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-gray-400 dark:text-white/30 mb-3">Style</p>
                  <div className="flex flex-wrap gap-2">
                    {['Corporate', 'Luxe', 'Dynamique', 'Fun'].map((style, i) => (
                      <span
                        key={style}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                          i === 0 ? 'bg-clyro-purple/20 text-clyro-purple ring-1 ring-clyro-purple/40' : 'glass text-gray-500 dark:text-white/50'
                        }`}
                      >
                        {style}
                      </span>
                    ))}
                  </div>
                </div>
                <button type="button" className="w-full shimmer bg-gradient-to-r from-clyro-purple to-clyro-blue text-white text-sm font-semibold py-3 rounded-xl">
                  Générer la pub →
                </button>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Feature 3: Brand Kit — Text LEFT, Mockup RIGHT ───── */}
        <section className="py-28 flex flex-col md:flex-row items-center gap-16">
          {/* Text side */}
          <Reveal className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 glass-pill px-3 py-1.5 rounded-full mb-6">
              <Palette size={13} className="text-clyro-accent" />
              <span className="font-mono text-xs uppercase tracking-widest text-clyro-accent">Brand Kit</span>
            </div>
            <h2 className="font-display font-extrabold text-4xl md:text-5xl text-gray-900 dark:text-white mb-5 leading-tight">
              Ta marque.<br />Tes visuels. Par l'IA.
            </h2>
            <p className="text-gray-500 dark:text-white/50 text-lg leading-relaxed mb-8">
              Définis ta charte graphique une fois. CLYRO l'applique à chaque génération — logos, posts réseaux sociaux, vidéos Faceless et Motion Design.
            </p>
            <ul className="space-y-3 mb-10">
              {[
                'Logo generation by AI',
                'Posts Instagram, LinkedIn, TikTok',
                'Couleurs appliquées à tous les modules',
                'Galerie d\'assets téléchargeables',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-600 dark:text-white/65 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-clyro-accent/20 flex items-center justify-center">
                    <Check size={11} className="text-clyro-accent" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/brand"
              className="inline-flex items-center gap-2 text-clyro-accent font-semibold hover:gap-3 transition-all duration-200"
            >
              Créer mon Brand Kit <ArrowRight size={16} />
            </Link>
          </Reveal>

          {/* Mockup side */}
          <Reveal className="flex-1 min-w-0 w-full" delay={120}>
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                <span className="ml-3 text-xs text-gray-400 dark:text-white/25 font-mono">Brand Kit — Générateur IA</span>
              </div>
              <div className="p-5 space-y-4">
                {/* Active brand */}
                <div className="glass rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-clyro-accent to-clyro-purple flex items-center justify-center">
                    <Palette size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">CLYRO Official</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-3 h-3 rounded-full bg-clyro-accent" />
                      <span className="w-3 h-3 rounded-full bg-clyro-purple" />
                      <span className="text-[10px] text-gray-400 dark:text-white/30 font-mono ml-1">Montserrat</span>
                    </div>
                  </div>
                  <span className="font-mono text-[9px] text-clyro-primary uppercase tracking-wider bg-clyro-primary/10 px-2 py-0.5 rounded-full">★ Défaut</span>
                </div>
                {/* Generated assets grid */}
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 dark:text-white/30">Assets générés</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Logo', color: 'from-clyro-accent/40 to-clyro-purple/40' },
                    { label: 'Instagram', color: 'from-pink-400/30 to-clyro-accent/30' },
                    { label: 'LinkedIn', color: 'from-blue-400/30 to-clyro-primary/30' },
                  ].map(({ label, color }) => (
                    <div key={label} className={`aspect-square rounded-lg bg-gradient-to-br ${color} flex flex-col items-center justify-center gap-1 glass`}>
                      <span className="text-lg">🎨</span>
                      <span className="font-mono text-[9px] text-gray-400 dark:text-white/30">{label}</span>
                    </div>
                  ))}
                </div>
                {/* Generate button */}
                <div className="glass rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-2 bg-gray-100 dark:bg-white/10 rounded w-3/4 mb-1.5" />
                    <div className="h-2 bg-gray-100 dark:bg-white/10 rounded w-1/2" />
                  </div>
                  <div className="bg-gradient-to-r from-clyro-accent to-clyro-purple text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1">
                    <Palette size={10} /> Générer
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </div>

      {/* ================================================================
          HOW IT WORKS
          ================================================================ */}
      <section id="how-it-works" className="py-28 px-6 bg-gray-50/80 dark:bg-navy-900/50">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="font-mono text-xs uppercase tracking-widest text-gray-400 dark:text-white/30 mb-3">Simple process</p>
            <h2 className="font-display font-extrabold text-4xl md:text-5xl text-gray-900 dark:text-white">
              From idea to video in 3 steps
            </h2>
          </Reveal>

          <Reveal stagger>
            <div className="relative">
              {/* Connector line — visible md+ */}
              <div className="hidden md:block absolute top-10 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    num: '01',
                    icon: '✍️',
                    title: 'Write your script',
                    desc: 'Type or paste your script. CLYRO handles storyboarding, pacing, and visuals automatically.',
                    color: 'text-clyro-blue',
                    ring: 'ring-clyro-blue/30',
                  },
                  {
                    num: '02',
                    icon: '🎨',
                    title: 'Choose style & voice',
                    desc: 'Pick from 7 visual styles and 400+ voices — or use your cloned voice for instant brand consistency.',
                    color: 'text-clyro-purple',
                    ring: 'ring-clyro-purple/30',
                  },
                  {
                    num: '03',
                    icon: '⚡',
                    title: 'Download your video',
                    desc: 'Your HD video is ready in minutes. Download MP4 in 9:16, 1:1, or 16:9 — ready to post.',
                    color: 'text-clyro-cyan',
                    ring: 'ring-clyro-cyan/30',
                  },
                ].map(({ num, icon, title, desc, color, ring }) => (
                  <div key={num} className="glass rounded-2xl p-7 card-hover relative">
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl glass ${ring} ring-1 text-2xl mb-5`}>
                      {icon}
                    </div>
                    <p className={`font-mono text-xs font-bold mb-1 ${color}`}>{num}</p>
                    <h3 className="font-display font-bold text-lg text-gray-900 dark:text-white mb-3">{title}</h3>
                    <p className="text-gray-500 dark:text-white/45 text-sm leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================================================================
          TESTIMONIALS
          ================================================================ */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-14">
            <p className="font-mono text-xs uppercase tracking-widest text-gray-400 dark:text-white/30 mb-3">Social proof</p>
            <h2 className="font-display font-extrabold text-4xl md:text-5xl text-gray-900 dark:text-white">
              Creators love CLYRO
            </h2>
          </Reveal>

          <Reveal stagger>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  quote: "We went from 1 video per week to 1 per day. The Cinématique style looks better than anything we produced manually.",
                  name: 'Marcus K.',
                  role: 'YouTube Creator · 320K subs',
                  avatar: 'MK',
                  gradient: 'from-clyro-blue to-clyro-purple',
                  stars: 5,
                },
                {
                  quote: "The voice cloning is scary good. My audience can't even tell it's AI — they just think I got a new mic.",
                  name: 'Amara D.',
                  role: 'Content Creator · TikTok',
                  avatar: 'AD',
                  gradient: 'from-yellow-400 to-orange-400',
                  stars: 5,
                },
                {
                  quote: "Motion Design in under 5 minutes. My clients are blown away every time. CLYRO replaced a tool that cost me 10x more.",
                  name: 'Théo M.',
                  role: 'Brand Designer · Freelance',
                  avatar: 'TM',
                  gradient: 'from-clyro-cyan to-clyro-blue',
                  stars: 5,
                },
              ].map(({ quote, name, role, avatar, gradient, stars }) => (
                <div key={name} className="glass rounded-2xl p-6 card-hover flex flex-col gap-5">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: stars }).map((_, i) => (
                      <Star key={i} size={13} className="fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-600 dark:text-white/65 text-sm leading-relaxed flex-1">"{quote}"</p>
                  <div className="flex items-center gap-3 pt-1 border-t border-gray-100 dark:border-white/[0.06]">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold text-white`}>
                      {avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
                      <p className="text-xs text-gray-400 dark:text-white/35">{role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================================================================
          PRICING
          ================================================================ */}
      <section id="pricing" className="py-28 px-6 bg-gray-50/80 dark:bg-navy-900/50">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-14">
            <p className="font-mono text-xs uppercase tracking-widest text-gray-400 dark:text-white/30 mb-3">Simple pricing</p>
            <h2 className="font-display font-extrabold text-4xl md:text-5xl text-gray-900 dark:text-white">
              Start free. Scale when ready.
            </h2>
            <p className="text-gray-400 dark:text-white/40 mt-4 max-w-md mx-auto">No hidden fees. Cancel anytime.</p>
          </Reveal>

          <Reveal stagger>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Free */}
              <div className="glass rounded-2xl p-7 card-hover flex flex-col">
                <p className="font-mono text-xs uppercase tracking-widest text-gray-400 dark:text-white/30 mb-4">Free</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="font-display font-extrabold text-5xl text-gray-900 dark:text-white">0€</span>
                </div>
                <p className="text-gray-400 dark:text-white/35 text-sm mb-8">Forever free — no card needed</p>
                <ul className="space-y-3 flex-1 mb-8">
                  {['3 generation credits', '2 visual styles', 'SD export (720p)', 'Standard voices'].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-500 dark:text-white/55">
                      <Check size={13} className="text-gray-300 dark:text-white/25 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="glass glass-hover text-center py-3 rounded-xl text-sm font-semibold text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition-colors">
                  Get started free
                </Link>
              </div>

              {/* Starter — highlighted */}
              <div className="glass glass-blue rounded-2xl p-7 card-hover flex flex-col relative overflow-hidden">
                <div className="absolute top-4 right-4 glass-blue px-2.5 py-1 rounded-full">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-clyro-blue font-bold">Popular</span>
                </div>
                <p className="font-mono text-xs uppercase tracking-widest text-clyro-blue mb-4">Starter</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="font-display font-extrabold text-5xl text-gray-900 dark:text-white">19€</span>
                  <span className="text-gray-400 dark:text-white/35 text-sm mb-2">/mo</span>
                </div>
                <p className="text-gray-400 dark:text-white/35 text-sm mb-8">For active content creators</p>
                <ul className="space-y-3 flex-1 mb-8">
                  {['30 credits per month', 'All 7 visual styles', '2 voice clones', 'HD export (1080p)', 'Priority generation'].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-white/70">
                      <Check size={13} className="text-clyro-blue flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="shimmer bg-gradient-to-r from-clyro-blue to-clyro-purple text-center py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity">
                  Start Starter plan
                </Link>
              </div>

              {/* Studio */}
              <div className="glass glass-purple rounded-2xl p-7 card-hover flex flex-col">
                <p className="font-mono text-xs uppercase tracking-widest text-clyro-purple mb-4">Studio</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="font-display font-extrabold text-5xl text-gray-900 dark:text-white">49€</span>
                  <span className="text-gray-400 dark:text-white/35 text-sm mb-2">/mo</span>
                </div>
                <p className="text-gray-400 dark:text-white/35 text-sm mb-8">For agencies &amp; power users</p>
                <ul className="space-y-3 flex-1 mb-8">
                  {['Unlimited credits', 'Motion Design module', 'Unlimited voice clones', 'All formats (9:16, 1:1, 16:9)', 'API access', 'White-label export'].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-white/70">
                      <Check size={13} className="text-clyro-purple flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="glass-hover text-center py-3 rounded-xl text-sm font-semibold text-clyro-purple border border-clyro-purple/30 hover:bg-clyro-purple/10 transition-colors">
                  Start Studio plan
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================================================================
          CTA BANNER
          ================================================================ */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="glass glass-heavy rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
              {/* Background blobs */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-clyro-blue/10 blur-[60px]" />
                <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-clyro-purple/10 blur-[60px]" />
              </div>
              <div className="relative z-10">
                <p className="font-mono text-xs uppercase tracking-widest text-gray-400 dark:text-white/30 mb-5">Ready to create?</p>
                <h2 className="font-display font-extrabold text-4xl md:text-5xl text-gray-900 dark:text-white mb-5 leading-tight">
                  Start creating for free today.
                </h2>
                <p className="text-gray-500 dark:text-white/45 text-lg mb-10">
                  3 videos free · No credit card · Results in under 5 minutes.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/signup"
                    className="shimmer animate-glow-cta inline-flex items-center gap-2 bg-gradient-to-r from-clyro-blue to-clyro-purple text-white font-semibold text-base px-8 py-4 rounded-2xl hover:opacity-90 transition-opacity duration-200"
                  >
                    Create my free account <ArrowRight size={18} />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 text-sm transition-colors duration-200"
                  >
                    Already have an account <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================================================================
          FOOTER
          ================================================================ */}
      <footer className="glass-heavy glass-border-t py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-10">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <span className="font-display font-extrabold text-xl">
                <span className="text-clyro-cyan">C</span>
                <span className="text-gray-900 dark:text-white">LYRO</span>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider glass-blue px-1.5 py-0.5 rounded-full text-clyro-blue">
                Beta
              </span>
            </Link>

            {/* Nav links */}
            <nav className="flex flex-wrap items-center gap-x-8 gap-y-3">
              {[
                { href: '#modules',      label: 'Modules' },
                { href: '#how-it-works', label: 'How it works' },
                { href: '#pricing',      label: 'Pricing' },
                { href: '/login',        label: 'Sign in' },
                { href: '/signup',       label: 'Sign up' },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="text-sm text-gray-400 dark:text-white/35 hover:text-gray-700 dark:hover:text-white/70 transition-colors duration-200"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>

          <div className="border-t border-gray-100 dark:border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400 dark:text-white/25 font-mono">
              © 2026 CLYRO · AI Video Generation Platform
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-xs text-gray-400 dark:text-white/25 hover:text-gray-600 dark:hover:text-white/50 transition-colors">Privacy</a>
              <a href="#" className="text-xs text-gray-400 dark:text-white/25 hover:text-gray-600 dark:hover:text-white/50 transition-colors">Terms</a>
              <a href="#" className="text-xs text-gray-400 dark:text-white/25 hover:text-gray-600 dark:hover:text-white/50 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata (server component pattern)
// ─────────────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'CLYRO — AI Video Generation in Under 5 Minutes',
  description:
    'Create faceless YouTube, TikTok and Instagram videos with AI. 7 visual styles, 400+ voices, voice cloning. No camera. No editor. Results in under 5 minutes.',
  openGraph: {
    title: 'CLYRO — AI Video Generation in Under 5 Minutes',
    description:
      'From your script to a polished video in under 5 minutes. Faceless, Motion Design & AI Voiceover.',
    type: 'website',
  },
}
