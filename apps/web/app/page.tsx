import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'

// ─────────────────────────────────────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '🎬',
    label: 'Faceless Videos',
    title: 'Du script à la vidéo en 5 min',
    desc: 'Écris ton script, choisis un style parmi 6 ambiances, CLYRO génère le storyboard, les visuels et la voix off automatiquement.',
    badge: { text: 'Faceless', variant: 'info' as const },
  },
  {
    icon: '✨',
    label: 'Motion Graphics',
    title: 'Pubs IA pour ta marque',
    desc: 'Décris ton produit et ta charte graphique. CLYRO crée une publicité animée prête pour Instagram, TikTok ou YouTube.',
    badge: { text: 'Motion', variant: 'purple' as const },
  },
  {
    icon: '🎙️',
    label: 'Voice Cloning',
    title: 'Ta voix, pour toutes tes vidéos',
    desc: 'Upload 30 secondes de ta voix. CLYRO la clone pour que chaque vidéo sonne comme toi — sans micro, sans studio.',
    badge: { text: 'Beta', variant: 'warning' as const },
  },
  {
    icon: '⚡',
    label: 'Pipeline IA',
    title: 'Génération en 2 à 5 minutes',
    desc: 'Storyboard, visuels, voix off et montage final. Tout le pipeline tourne en parallèle. Reçois un email dès que ta vidéo est prête.',
    badge: { text: 'Fast', variant: 'success' as const },
  },
  {
    icon: '📱',
    label: 'Multi-format',
    title: 'Tous les formats réseaux sociaux',
    desc: '9:16 pour Stories et Reels, 1:1 pour Instagram, 16:9 pour YouTube. Export MP4 HD inclus dans tous les plans.',
    badge: { text: 'Export', variant: 'info' as const },
  },
  {
    icon: '🌍',
    label: 'Bibliothèque de voix',
    title: '+400 voix en 30 langues',
    desc: 'Accents africains, français, anglais US/UK, espagnol. Filtre par genre, accent et usage pour trouver la voix parfaite.',
    badge: { text: 'Library', variant: 'purple' as const },
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Écris ou colle ton script',
    desc: 'Saisis ton texte directement ou importe un fichier. CLYRO accepte jusqu\'à 5 000 caractères.',
  },
  {
    number: '02',
    title: 'Choisis ton style et ta voix',
    desc: 'Sélectionne parmi 6 styles visuels et des centaines de voix off. Ou utilise ta propre voix clonée.',
  },
  {
    number: '03',
    title: 'Lance et télécharge',
    desc: 'Le pipeline IA génère ta vidéo en 2–5 minutes. Tu reçois un email et peux télécharger ton MP4 HD.',
  },
]

const PLANS = [
  {
    name: 'Gratuit',
    price: '0€',
    period: '',
    highlight: false,
    credits: '3 vidéos offertes',
    features: ['3 crédits à l\'inscription', '2 styles Faceless', 'Export MP4 SD', 'Bibliothèque de voix publique'],
    cta: 'Commencer gratuitement',
    href: '/signup',
    variant: 'secondary' as const,
  },
  {
    name: 'Starter',
    price: '19€',
    period: '/mois',
    highlight: true,
    credits: '30 vidéos/mois',
    features: ['30 crédits par mois', '6 styles Faceless', '2 voix clonées', 'Export MP4 HD', 'Support prioritaire'],
    cta: 'Choisir Starter',
    href: '/signup?plan=starter',
    variant: 'primary' as const,
  },
  {
    name: 'Studio',
    price: '49€',
    period: '/mois',
    highlight: false,
    credits: 'Vidéos illimitées',
    features: ['Vidéos illimitées', 'Module Motion Graphics', 'Voix clonées illimitées', 'Formats 9:16, 1:1, 16:9', 'SSO Entreprise'],
    cta: 'Choisir Studio',
    href: '/signup?plan=studio',
    variant: 'outline' as const,
  },
]

const STATS = [
  { value: '500+', label: 'créateurs actifs' },
  { value: '10 000+', label: 'vidéos générées' },
  { value: '6', label: 'styles visuels' },
  { value: '2–5 min', label: 'par vidéo' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  COMPOSANTS SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/40 bg-navy-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display font-extrabold text-xl text-gradient-primary">
            CLYRO
          </span>
          <Badge variant="muted" size="sm">Beta</Badge>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            { href: '#features',    label: 'Fonctionnalités' },
            { href: '#how-it-works', label: 'Comment ça marche' },
            { href: '#pricing',     label: 'Tarifs' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Connexion</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Commencer gratuitement</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="pt-32 pb-24 px-6 text-center">
      <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">

        {/* Badge annonce */}
        <Badge variant="info" dot>
          Nouveau · Module Motion Graphics disponible
        </Badge>

        {/* Headline */}
        <h1 className="font-display font-extrabold text-5xl md:text-6xl lg:text-7xl text-foreground leading-tight">
          De ton script à{' '}
          <span className="text-gradient-electric">
            ta vidéo IA
          </span>
          <br />
          en 5 minutes.
        </h1>

        {/* Subtitle */}
        <p className="font-body text-lg text-muted-foreground max-w-xl leading-body">
          Sans caméra. Sans monteur. Sans agence.
          CLYRO génère tes vidéos Faceless et tes publicités Motion Graphics
          avec l&apos;IA — tu n&apos;as besoin que d&apos;un script.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
          <Button size="lg" asChild>
            <Link href="/signup">Créer ma première vidéo →</Link>
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <a href="#how-it-works">Voir comment ça marche</a>
          </Button>
        </div>

        {/* Micro-proof */}
        <p className="font-mono text-xs text-muted-foreground">
          3 vidéos gratuites à l&apos;inscription · Aucune carte bancaire requise
        </p>
      </div>

      {/* Faux écran / visual placeholder */}
      <div className="mt-16 max-w-4xl mx-auto relative">
        <div className="rounded-2xl border border-border bg-navy-900 overflow-hidden shadow-glow-blue">
          {/* Barre de titre macOS-style */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-navy-800">
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
            <span className="ml-3 font-mono text-xs text-muted-foreground">
              clyro.ai/faceless/new
            </span>
          </div>
          {/* Contenu simulé */}
          <div className="p-8 grid grid-cols-3 gap-4">
            {['animation-2d', 'stock-vo', 'minimaliste', 'infographie', 'whiteboard', 'cinematique'].map((style) => (
              <div
                key={style}
                className="bg-navy-800 border border-border rounded-xl p-4 flex flex-col gap-2"
              >
                <div className="h-16 bg-navy-700 rounded-lg animate-pulse" />
                <div className="h-3 bg-navy-700 rounded w-3/4" />
                <div className="h-2 bg-navy-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
        {/* Glow derrière */}
        <div className="absolute -inset-4 bg-clyro-blue/5 blur-3xl rounded-3xl -z-10" />
      </div>
    </section>
  )
}

function Stats() {
  return (
    <section className="py-12 px-6 border-y border-border">
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {STATS.map(({ value, label }) => (
          <div key={label} className="text-center">
            <p className="font-display font-extrabold text-3xl text-gradient-primary">
              {value}
            </p>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-1">
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">

        {/* Header section */}
        <div className="text-center mb-14">
          <Badge variant="info" dot className="mb-4">
            Fonctionnalités
          </Badge>
          <h2 className="font-display font-bold text-4xl text-foreground">
            Tout ce dont tu as besoin pour créer,{' '}
            <span className="text-gradient-primary">rien de superflu.</span>
          </h2>
          <p className="font-body text-muted-foreground mt-4 max-w-xl mx-auto leading-body">
            CLYRO concentre la puissance de plusieurs outils IA dans une interface
            pensée pour la vitesse et la simplicité.
          </p>
        </div>

        {/* Grille de features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon, title, desc, badge }) => (
            <Card key={title} variant="default" interactive>
              <CardHeader>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{icon}</span>
                  <Badge variant={badge.variant} size="sm">{badge.text}</Badge>
                </div>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-body">{desc}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-navy-900/40">
      <div className="max-w-4xl mx-auto">

        <div className="text-center mb-14">
          <Badge variant="purple" dot className="mb-4">
            Comment ça marche
          </Badge>
          <h2 className="font-display font-bold text-4xl text-foreground">
            Trois étapes.{' '}
            <span className="text-gradient-primary">Une vidéo.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Ligne connectrice (desktop) */}
          <div
            className="hidden md:block absolute top-8 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-gradient-to-r from-clyro-blue/30 via-clyro-purple/30 to-clyro-cyan/30"
            aria-hidden="true"
          />

          {STEPS.map(({ number, title, desc }) => (
            <div key={number} className="flex flex-col items-center text-center gap-4">
              {/* Numéro */}
              <div className="w-16 h-16 rounded-2xl bg-grad-primary flex items-center justify-center shrink-0 shadow-glow-blue">
                <span className="font-display font-extrabold text-xl text-white">
                  {number}
                </span>
              </div>
              <h3 className="font-display font-semibold text-lg text-foreground">
                {title}
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-body">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">

        <div className="text-center mb-14">
          <Badge variant="success" dot className="mb-4">
            Tarifs
          </Badge>
          <h2 className="font-display font-bold text-4xl text-foreground">
            Simple, transparent,{' '}
            <span className="text-gradient-primary">sans surprise.</span>
          </h2>
          <p className="font-body text-muted-foreground mt-4 max-w-lg mx-auto leading-body">
            Commence gratuitement avec 3 vidéos offertes.
            Passe au plan suivant quand tu en as besoin.
            Paiement par carte ou Mobile Money (Afrique).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              variant={plan.highlight ? 'glow' : 'default'}
              className={plan.highlight ? 'ring-1 ring-clyro-blue/30 relative' : ''}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="info" size="sm">Le plus populaire</Badge>
                </div>
              )}

              <CardHeader>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="font-display font-extrabold text-4xl text-foreground">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="font-body text-sm text-muted-foreground">{plan.period}</span>
                  )}
                </div>
                <p className="font-mono text-xs text-clyro-blue mt-1">{plan.credits}</p>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 font-body text-sm text-muted-foreground">
                      <span className="text-clyro-blue shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant={plan.variant} className="w-full" asChild>
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaBanner() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="rounded-2xl bg-navy-900 border border-clyro-blue/20 p-12 relative overflow-hidden">
          {/* Radial glow */}
          <div className="absolute inset-0 glow-radial-blue pointer-events-none" />

          <Badge variant="info" dot className="mb-6">
            Prêt à créer ?
          </Badge>
          <h2 className="font-display font-extrabold text-4xl text-foreground mb-4">
            Commence à créer{' '}
            <span className="text-gradient-electric">gratuitement</span>{' '}
            aujourd&apos;hui.
          </h2>
          <p className="font-body text-muted-foreground leading-body mb-8 max-w-md mx-auto">
            3 vidéos offertes. Aucune carte bancaire. Résultats en moins de 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">Créer mon compte gratuit →</Link>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link href="/login">J&apos;ai déjà un compte</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">

        <div className="flex flex-col items-center md:items-start gap-1">
          <span className="font-display font-extrabold text-lg text-gradient-primary">CLYRO</span>
          <p className="font-body text-xs text-muted-foreground">
            AI Video Generation Platform
          </p>
        </div>

        <nav className="flex flex-wrap justify-center gap-6">
          {[
            { href: '#features',     label: 'Fonctionnalités' },
            { href: '#pricing',      label: 'Tarifs' },
            { href: '/login',        label: 'Connexion' },
            { href: '/signup',       label: 'Inscription' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        <p className="font-mono text-xs text-muted-foreground">
          © {new Date().getFullYear()} CLYRO · Tous droits réservés
        </p>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'CLYRO — Génère des vidéos IA en 5 minutes',
  description:
    'De ton script à ta vidéo en moins de 5 minutes. Sans caméra, sans monteur, sans agence. Faceless Videos et Motion Graphics propulsés par l\'IA.',
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-navy-950 text-foreground grid-bg">
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <Pricing />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  )
}
