import Link from 'next/link'
import { Video, Wand2, Mic2, Check, Play, ArrowRight, Zap, Layers, Globe } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '10 000+', label: 'videos generated' },
  { value: '500+',    label: 'active creators' },
  { value: '6',       label: 'visual styles' },
  { value: '< 5 min', label: 'per video' },
]

const MODULES = [
  {
    id: 'faceless',
    icon: Video,
    label: 'Faceless Video',
    headline: 'Viral content,\nzero camera.',
    desc: 'Write your script, pick a visual style. CLYRO generates the storyboard, images, and voiceover in minutes — ready for YouTube, TikTok, or Instagram.',
    accent: 'clyro-blue',
    from: 'from-clyro-blue/20',
    to: 'to-navy-900',
    border: 'border-clyro-blue/30',
    glow: 'hover:shadow-[0_0_48px_rgba(59,142,240,0.18)]',
    tag: 'Faceless',
    href: '/signup',
    styles: ['Animation 2D', 'Stock VO', 'Minimaliste', 'Cinématique'],
  },
  {
    id: 'motion',
    icon: Wand2,
    label: 'Motion Design',
    headline: 'Brand ads,\nin 5 minutes.',
    desc: 'Describe your product and brand identity. CLYRO creates a polished animated ad with your colors, logo, and voiceover — After Effects quality, no skills needed.',
    accent: 'clyro-purple',
    from: 'from-clyro-purple/20',
    to: 'to-navy-900',
    border: 'border-clyro-purple/40',
    glow: 'hover:shadow-[0_0_48px_rgba(155,92,246,0.22)]',
    tag: 'Motion',
    href: '/signup',
    styles: ['Corporate', 'Néon', 'Cinéma', 'Minimaliste'],
  },
  {
    id: 'voice',
    icon: Mic2,
    label: 'AI Voiceover',
    headline: 'Your voice.\nEvery video.',
    desc: 'Upload 30 seconds of audio. CLYRO clones your voice for every generation — or pick from 400+ voices in 30 languages with accents from around the world.',
    accent: 'clyro-cyan',
    from: 'from-clyro-cyan/15',
    to: 'to-navy-900',
    border: 'border-clyro-cyan/30',
    glow: 'hover:shadow-[0_0_48px_rgba(56,232,255,0.15)]',
    tag: 'Voiceover',
    href: '/signup',
    styles: ['French', 'English US', 'Español', '+397 more'],
  },
]

const STEPS = [
  {
    number: '01',
    icon: '✍️',
    title: 'Write or paste your script',
    desc: 'Enter your text directly or use one of our templates. CLYRO accepts up to 5,000 characters.',
  },
  {
    number: '02',
    icon: '🎨',
    title: 'Choose your style and voice',
    desc: 'Select from 6 visual styles and hundreds of voices — or use your cloned voice for a personal touch.',
  },
  {
    number: '03',
    icon: '⚡',
    title: 'Generate and download',
    desc: 'The AI pipeline builds your video in 2–5 minutes. Get an email notification and download your HD MP4.',
  },
]

const GALLERY = [
  { title: 'The Future of Renewable Energy',  module: 'faceless', style: 'Cinématique',  duration: '0:47', color: 'from-blue-900/60 to-navy-900' },
  { title: 'Xtend Protein — Product Launch',   module: 'motion',   style: 'Corporate',    duration: '0:30', color: 'from-purple-900/60 to-navy-900' },
  { title: 'Les Mystères de l\'Univers',        module: 'faceless', style: 'Animation 2D', duration: '1:12', color: 'from-indigo-900/60 to-navy-900' },
  { title: 'FitBoost App — App Store Ad',       module: 'motion',   style: 'Néon',         duration: '0:15', color: 'from-violet-900/60 to-navy-900' },
  { title: 'Comment Investir en Bourse',        module: 'faceless', style: 'Minimaliste',  duration: '2:03', color: 'from-sky-900/60 to-navy-900' },
  { title: 'Luxe Parfum — Brand Story',         module: 'motion',   style: 'Cinéma',       duration: '0:45', color: 'from-fuchsia-900/60 to-navy-900' },
]

const TESTIMONIALS = [
  {
    quote: [
      'We went from ',
      { text: '1 video per week', highlight: true },
      ' to ',
      { text: '1 per day', highlight: true },
      '. CLYRO has been the biggest help in our workflow for the faceless channel.',
    ],
    name: 'Marcus',
    role: 'YouTube Creator',
    sub: '120k subscribers',
    avatar: 'M',
    color: 'from-clyro-blue/10',
  },
  {
    quote: [
      'The voice cloning is ',
      { text: 'scary good', highlight: true },
      '. My audience literally ',
      { text: "can't tell it's AI", highlight: true },
      '. I use it for every video now.',
    ],
    name: 'Amara',
    role: 'Content Creator',
    sub: 'TikTok & Instagram',
    avatar: 'A',
    color: 'from-clyro-purple/10',
  },
  {
    quote: [
      'Motion Design in ',
      { text: 'under 5 minutes', highlight: true },
      '. I used to spend ',
      { text: '3 days', highlight: true },
      ' on what CLYRO does in a single coffee break.',
    ],
    name: 'Théo',
    role: 'Brand Designer',
    sub: 'Freelance, Paris',
    avatar: 'T',
    color: 'from-clyro-cyan/10',
  },
]

const PLANS = [
  {
    name: 'Free',
    price: '0€',
    period: '',
    highlight: false,
    tag: '3 free videos',
    features: ['3 credits on signup', '2 Faceless styles', 'SD MP4 export', 'Public voice library'],
    cta: 'Start for free',
    href: '/signup',
  },
  {
    name: 'Starter',
    price: '19€',
    period: '/mo',
    highlight: true,
    tag: '30 videos/month',
    features: ['30 credits/month', 'All 6 Faceless styles', '2 cloned voices', 'HD MP4 export', 'Priority support'],
    cta: 'Choose Starter',
    href: '/signup?plan=starter',
  },
  {
    name: 'Studio',
    price: '49€',
    period: '/mo',
    highlight: false,
    tag: 'Unlimited videos',
    features: ['Unlimited videos', 'Motion Design module', 'Unlimited voice clones', '9:16 · 1:1 · 16:9 formats', 'Enterprise SSO'],
    cta: 'Choose Studio',
    href: '/signup?plan=studio',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-navy-950/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display font-extrabold text-xl">
            <span className="text-clyro-cyan">C</span>
            <span className="text-white">LYRO</span>
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider bg-clyro-blue/15 text-clyro-blue border border-clyro-blue/25 px-1.5 py-0.5 rounded-full">
            Beta
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {[
            { href: '#modules',      label: 'Modules' },
            { href: '#how-it-works', label: 'How it works' },
            { href: '#pricing',      label: 'Pricing' },
          ].map(({ href, label }) => (
            <a key={href} href={href} className="font-body text-sm text-white/50 hover:text-white transition-colors">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="font-body text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="font-body text-sm font-medium bg-gradient-to-r from-clyro-blue to-clyro-purple text-white px-4 py-1.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Get started free
          </Link>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-6 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-navy-950 grid-bg" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-clyro-blue/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-clyro-purple/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[300px] bg-clyro-cyan/4 rounded-full blur-3xl pointer-events-none" />

      {/* Glassmorphism headline card */}
      <div className="relative z-10 max-w-3xl w-full mx-auto text-center">
        <div className="rounded-3xl bg-navy-900/70 border border-white/8 px-8 py-10 backdrop-blur-md shadow-[0_0_80px_rgba(0,0,0,0.5)] mb-8">

          {/* Announcement pill */}
          <div className="inline-flex items-center gap-2 bg-clyro-blue/10 border border-clyro-blue/25 text-clyro-blue px-3 py-1 rounded-full font-mono text-xs uppercase tracking-wider mb-6">
            <span className="w-1.5 h-1.5 bg-clyro-cyan rounded-full animate-pulse" />
            New · Motion Design module available
          </div>

          <h1 className="font-display font-extrabold leading-tight text-white mb-4">
            <span className="block text-3xl md:text-4xl text-white/70 font-semibold mb-2">
              Your script. Your brand. Your voice.
            </span>
            <span className="block text-5xl md:text-6xl lg:text-7xl bg-gradient-to-r from-clyro-cyan via-clyro-blue to-clyro-purple bg-clip-text text-transparent">
              Your AI video.
            </span>
          </h1>

          <p className="font-body text-base text-white/50 max-w-xl mx-auto leading-relaxed mb-8">
            CLYRO turns any script into a polished Faceless video or Motion Design ad in under 5 minutes.
            No camera. No editor. No agency.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="flex items-center gap-2 bg-gradient-to-r from-clyro-blue to-clyro-purple text-white font-body font-semibold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_24px_rgba(59,142,240,0.35)]"
            >
              Create my first video <ArrowRight size={16} />
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 text-white/50 hover:text-white font-body text-sm px-5 py-3 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
            >
              <Play size={14} /> See how it works
            </a>
          </div>

          <p className="font-mono text-xs text-white/25 mt-4">
            3 free videos on signup · No credit card required
          </p>
        </div>

        {/* App mockup */}
        <div className="relative">
          <div className="rounded-2xl border border-white/8 bg-navy-900/90 overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-navy-800/80">
              <span className="w-3 h-3 rounded-full bg-red-500/50" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/50" />
              <span className="ml-3 font-mono text-xs text-white/25">clyro.ai — Faceless Video</span>
            </div>
            <div className="p-6 grid grid-cols-3 gap-3">
              {[
                { label: 'Animation 2D', color: 'from-blue-900/80 to-navy-800'   },
                { label: 'Stock VO',     color: 'from-indigo-900/80 to-navy-800' },
                { label: 'Minimaliste', color: 'from-sky-900/80 to-navy-800'    },
                { label: 'Infographie', color: 'from-violet-900/80 to-navy-800' },
                { label: 'Whiteboard',  color: 'from-purple-900/80 to-navy-800' },
                { label: 'Cinématique', color: 'from-fuchsia-900/80 to-navy-800'},
              ].map((style) => (
                <div key={style.label} className={`bg-gradient-to-br ${style.color} border border-white/5 rounded-xl p-3 flex flex-col gap-2`}>
                  <div className="h-12 rounded-lg bg-white/5 flex items-center justify-center">
                    <Video size={18} className="text-white/20" />
                  </div>
                  <p className="font-mono text-[10px] text-white/40 text-center">{style.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -inset-8 bg-clyro-blue/5 blur-3xl rounded-3xl -z-10" />
        </div>
      </div>
    </section>
  )
}

function Stats() {
  return (
    <section className="py-14 px-6 border-y border-white/5 bg-navy-900/50">
      <div className="max-w-4xl mx-auto">
        <p className="text-center font-mono text-xs text-white/30 uppercase tracking-widest mb-8">
          Trusted by creators worldwide
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="font-display font-extrabold text-4xl md:text-5xl bg-gradient-to-r from-clyro-cyan to-clyro-blue bg-clip-text text-transparent">
                {value}
              </p>
              <p className="font-mono text-xs text-white/35 uppercase tracking-widest mt-2">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Modules() {
  return (
    <section id="modules" className="py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="font-mono text-xs text-clyro-blue uppercase tracking-widest mb-3">Modules</p>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl text-white mb-4">
            Three tools.{' '}
            <span className="bg-gradient-to-r from-clyro-cyan to-clyro-purple bg-clip-text text-transparent">
              One platform.
            </span>
          </h2>
          <p className="font-body text-white/40 max-w-lg mx-auto leading-relaxed">
            CLYRO combines the power of multiple AI tools into one interface built for speed and simplicity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MODULES.map((mod) => {
            const Icon = mod.icon
            return (
              <div
                key={mod.id}
                className={`group relative bg-navy-900 border ${mod.border} ${mod.glow} rounded-3xl overflow-hidden transition-all duration-300`}
              >
                {/* Gradient header */}
                <div className={`h-40 bg-gradient-to-br ${mod.from} ${mod.to} flex items-center justify-center relative`}>
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center backdrop-blur-sm">
                    <Icon size={30} strokeWidth={1.2} className="text-white/70" />
                  </div>
                  {/* Style chips */}
                  <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1">
                    {mod.styles.map((s) => (
                      <span key={s} className="font-mono text-[9px] bg-white/8 text-white/40 px-1.5 py-0.5 rounded-full border border-white/5">
                        {s}
                      </span>
                    ))}
                  </div>
                  <span className="absolute top-3 right-3 font-mono text-[9px] uppercase tracking-wider bg-white/8 text-white/50 border border-white/10 px-2 py-0.5 rounded-full">
                    {mod.tag}
                  </span>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="font-display font-bold text-xl text-white mb-2 whitespace-pre-line">
                    {mod.headline}
                  </h3>
                  <p className="font-body text-sm text-white/45 leading-relaxed mb-5">{mod.desc}</p>
                  <Link
                    href={mod.href}
                    className="inline-flex items-center gap-2 font-body text-sm font-medium text-white/60 hover:text-white transition-colors group-hover:text-white"
                  >
                    Start creating <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function VideoGallery() {
  return (
    <section className="py-20 px-6 bg-navy-900/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="font-mono text-xs text-clyro-purple uppercase tracking-widest mb-3">Gallery</p>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white">
            Hundreds of{' '}
            <span className="bg-gradient-to-r from-clyro-blue to-clyro-purple bg-clip-text text-transparent">
              high-quality videos
            </span>{' '}
            every day
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {GALLERY.map((item) => (
            <div
              key={item.title}
              className="group relative bg-navy-900 border border-white/5 rounded-2xl overflow-hidden hover:border-white/15 transition-all duration-200 cursor-pointer"
            >
              {/* Thumbnail */}
              <div className={`relative h-40 bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                {item.module === 'motion'
                  ? <Wand2 size={28} strokeWidth={1} className="text-white/20" />
                  : <Video  size={28} strokeWidth={1} className="text-white/20" />
                }
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play size={14} className="text-white ml-0.5" fill="white" />
                  </div>
                </div>
                {/* Duration */}
                <span className="absolute bottom-2 right-2 font-mono text-[10px] bg-black/60 text-white/70 px-1.5 py-0.5 rounded">
                  {item.duration}
                </span>
                {/* Module tag */}
                <span className={`absolute top-2 left-2 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                  item.module === 'motion'
                    ? 'bg-clyro-purple/20 text-clyro-purple border-clyro-purple/30'
                    : 'bg-clyro-blue/20 text-clyro-blue border-clyro-blue/30'
                }`}>
                  {item.module}
                </span>
              </div>
              {/* Info */}
              <div className="p-3">
                <p className="font-body text-sm text-white/70 truncate">{item.title}</p>
                <p className="font-mono text-[10px] text-white/30 mt-0.5">{item.style}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="font-mono text-xs text-clyro-cyan uppercase tracking-widest mb-3">How it works</p>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl text-white">
            Three steps.{' '}
            <span className="bg-gradient-to-r from-clyro-blue to-clyro-cyan bg-clip-text text-transparent">
              One video.
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div
            className="hidden md:block absolute top-8 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-gradient-to-r from-clyro-blue/30 via-clyro-purple/30 to-clyro-cyan/30"
            aria-hidden="true"
          />

          {STEPS.map(({ number, icon, title, desc }) => (
            <div key={number} className="flex flex-col items-center text-center gap-4">
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-clyro-blue to-clyro-purple flex items-center justify-center shadow-[0_0_24px_rgba(59,142,240,0.3)]">
                <span className="text-2xl">{icon}</span>
                <span className="absolute -top-1.5 -right-1.5 font-mono text-[9px] font-bold bg-navy-950 text-clyro-blue border border-clyro-blue/30 px-1 py-0.5 rounded-full">
                  {number}
                </span>
              </div>
              <h3 className="font-display font-semibold text-lg text-white">{title}</h3>
              <p className="font-body text-sm text-white/40 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  return (
    <section className="py-20 px-6 bg-navy-900/40">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="font-mono text-xs text-clyro-blue uppercase tracking-widest mb-3">Creators</p>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white">
            What creators are saying
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col gap-4 rounded-2xl p-5 bg-gradient-to-br ${t.color} to-navy-900/50 border border-white/8`}
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-clyro-blue text-xs">★</span>
                ))}
              </div>

              {/* Quote with highlights */}
              <p className="font-body text-sm text-white/60 leading-relaxed">
                {t.quote.map((part, i) =>
                  typeof part === 'string' ? (
                    <span key={i}>{part}</span>
                  ) : (
                    <span key={i} className="bg-clyro-blue/20 text-clyro-cyan font-semibold px-1 py-0.5 rounded">
                      {part.text}
                    </span>
                  )
                )}
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 mt-auto pt-2 border-t border-white/5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-clyro-blue to-clyro-purple flex items-center justify-center shrink-0">
                  <span className="font-display font-bold text-white text-sm">{t.avatar}</span>
                </div>
                <div>
                  <p className="font-body text-sm font-medium text-white">{t.name}</p>
                  <p className="font-mono text-[10px] text-white/30">{t.role} · {t.sub}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  const ITEMS = [
    { icon: Zap,    title: 'Pipeline in 2–5 min',    desc: 'Storyboard, visuals, voiceover and final edit run in parallel. Get an email when ready.' },
    { icon: Layers, title: 'All social formats',      desc: '9:16 for Stories & Reels, 1:1 for Instagram, 16:9 for YouTube. HD MP4 included.' },
    { icon: Globe,  title: '400+ voices, 30 languages', desc: 'African accents, French, US/UK English, Spanish. Filter by gender, accent, and use case.' },
  ]
  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {ITEMS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex gap-4 p-5 bg-navy-900 border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-clyro-blue/10 border border-clyro-blue/20 flex items-center justify-center shrink-0">
              <Icon size={18} className="text-clyro-blue" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-white text-sm mb-1">{title}</h4>
              <p className="font-body text-xs text-white/40 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="py-28 px-6 bg-navy-900/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="font-mono text-xs text-clyro-blue uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl text-white mb-4">
            Simple.{' '}
            <span className="bg-gradient-to-r from-clyro-blue to-clyro-cyan bg-clip-text text-transparent">
              Transparent.
            </span>
          </h2>
          <p className="font-body text-white/40 max-w-md mx-auto leading-relaxed">
            Start free with 3 videos. Upgrade when you need more.
            Pay by card or Mobile Money (Africa).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col bg-navy-900 rounded-2xl border p-6 transition-all duration-200 ${
                plan.highlight
                  ? 'border-clyro-blue/50 shadow-[0_0_40px_rgba(59,142,240,0.15)] ring-1 ring-clyro-blue/20'
                  : 'border-white/8 hover:border-white/15'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="font-mono text-[9px] uppercase tracking-wider bg-clyro-blue text-white px-3 py-1 rounded-full">
                    Most popular
                  </span>
                </div>
              )}

              <div className="mb-5">
                <p className="font-mono text-xs text-white/30 uppercase tracking-widest mb-2">{plan.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-display font-extrabold text-4xl text-white">{plan.price}</span>
                  {plan.period && <span className="font-body text-sm text-white/40">{plan.period}</span>}
                </div>
                <p className="font-mono text-xs text-clyro-blue mt-1">{plan.tag}</p>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 font-body text-sm text-white/50">
                    <Check size={13} className="text-clyro-blue shrink-0" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`text-center font-body font-medium text-sm py-2.5 rounded-xl transition-all ${
                  plan.highlight
                    ? 'bg-gradient-to-r from-clyro-blue to-clyro-purple text-white hover:opacity-90 shadow-[0_0_20px_rgba(59,142,240,0.3)]'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/8'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaBanner() {
  return (
    <section className="py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="relative rounded-3xl bg-navy-900 border border-clyro-blue/20 p-12 text-center overflow-hidden">
          {/* Radial glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(59,142,240,0.12),transparent)] pointer-events-none" />
          <div className="absolute -inset-1 bg-gradient-to-b from-clyro-blue/5 to-transparent pointer-events-none rounded-3xl" />

          <p className="font-mono text-xs text-clyro-blue uppercase tracking-widest mb-4">Ready to create?</p>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl text-white mb-4 leading-tight">
            Start creating{' '}
            <span className="bg-gradient-to-r from-clyro-cyan via-clyro-blue to-clyro-purple bg-clip-text text-transparent">
              for free
            </span>{' '}
            today.
          </h2>
          <p className="font-body text-white/40 mb-8 max-w-md mx-auto leading-relaxed">
            3 free videos on signup. No credit card. Results in under 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="flex items-center gap-2 bg-gradient-to-r from-clyro-blue to-clyro-purple text-white font-body font-semibold text-sm px-7 py-3 rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_28px_rgba(59,142,240,0.35)]"
            >
              Create my free account <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="font-body text-sm text-white/40 hover:text-white px-5 py-3 rounded-xl border border-white/8 hover:border-white/20 transition-colors"
            >
              Already have an account
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-1">
          <span className="font-display font-extrabold text-lg">
            <span className="text-clyro-cyan">C</span>
            <span className="text-white">LYRO</span>
          </span>
          <p className="font-body text-xs text-white/30">AI Video Generation Platform</p>
        </div>

        <nav className="flex flex-wrap justify-center gap-6">
          {[
            { href: '#modules',   label: 'Modules' },
            { href: '#pricing',   label: 'Pricing' },
            { href: '/login',     label: 'Sign in' },
            { href: '/signup',    label: 'Sign up' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="font-body text-xs text-white/30 hover:text-white transition-colors">
              {label}
            </Link>
          ))}
        </nav>

        <p className="font-mono text-xs text-white/20">
          © {new Date().getFullYear()} CLYRO · All rights reserved
        </p>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'CLYRO — Generate AI videos in 5 minutes',
  description:
    'From your script to your AI video in under 5 minutes. No camera, no editor, no agency. Faceless Videos and Motion Design powered by AI.',
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Modules />
        <VideoGallery />
        <HowItWorks />
        <Testimonials />
        <Features />
        <Pricing />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  )
}
