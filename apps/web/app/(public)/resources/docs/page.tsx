// app/(public)/resources/docs/page.tsx
'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { BookOpen, Sparkles, Video, Mic, Image as ImageIcon, Zap, Settings, HelpCircle, ArrowRight } from 'lucide-react'
import { PublicShell, DocTitle } from '@/components/public/PublicShell'

type Lang = 'en' | 'fr'

export default function DocsPage() {
  return (
    <PublicShell>
      {(lang) => <DocsBody lang={lang} />}
    </PublicShell>
  )
}

function DocsBody({ lang }: { lang: Lang }) {
  const t = lang === 'fr'
    ? {
        eyebrow: 'Documentation',
        title: 'Tout ce qu&rsquo;il faut savoir pour lancer ta première vidéo',
        intro: 'Des guides courts, concrets, et mis à jour à chaque release. Choisis une piste et commence.',
        startTitle: 'Démarrer en 5 minutes',
        start: [
          { icon: Sparkles, title: 'Créer ton compte', desc: 'Inscription, vérification e-mail, et premiers crédits offerts.' },
          { icon: BookOpen,  title: 'Comprendre les crédits', desc: 'Combien coûte chaque format, comment fonctionne le roll-over.' },
          { icon: Zap,       title: 'Ton premier script', desc: 'Les 4 règles pour obtenir un bon storyboard du premier coup.' },
        ],
        featuresTitle: 'Les 3 pipelines',
        features: [
          { icon: Video,    title: 'F1 · Vidéos faceless',      desc: 'Du script au MP4 final avec voix off, sous-titres et visuels animés.' },
          { icon: ImageIcon,title: 'F2 · Motion design',        desc: 'Templates dynamiques en deux passes : brouillon rapide, rendu HD.' },
          { icon: Mic,      title: 'F5 · Studio scène par scène', desc: 'Éditeur scène par scène pour reprendre la main sur chaque plan.' },
        ],
        advancedTitle: 'Aller plus loin',
        advanced: [
          { icon: Settings, title: 'Charte graphique', desc: 'Logo, polices, couleurs : toutes tes vidéos dans ton identité.' },
          { icon: Mic,      title: 'Voix &amp; doublage',   desc: 'Choisir la bonne voix ElevenLabs, cloner une voix, ajuster la prosodie.' },
          { icon: HelpCircle,title:'Dépannage',          desc: 'Les erreurs les plus fréquentes et comment les résoudre en 30 secondes.' },
        ],
        helpTitle: 'Tu bloques ?',
        helpBody: 'Écris-nous à',
        helpCta: 'Voir les exemples vidéo',
        helpCtaHref: '/resources/examples?lang=fr',
      }
    : {
        eyebrow: 'Documentation',
        title: 'Everything you need to ship your first video',
        intro: 'Short, concrete guides, updated every release. Pick a track and get started.',
        startTitle: 'Get started in 5 minutes',
        start: [
          { icon: Sparkles, title: 'Create your account',   desc: 'Signup, email verification, and your starter credits.' },
          { icon: BookOpen, title: 'Understand credits',    desc: 'What each format costs, and how roll-over works.' },
          { icon: Zap,      title: 'Your first script',     desc: 'The 4 rules for getting a great storyboard on the first try.' },
        ],
        featuresTitle: 'The three pipelines',
        features: [
          { icon: Video,    title: 'F1 · Faceless videos',  desc: 'From script to final MP4 with voice-over, captions, and animated visuals.' },
          { icon: ImageIcon,title: 'F2 · Motion design',    desc: 'Dynamic templates in two passes: fast draft, HD render.' },
          { icon: Mic,      title: 'F5 · Scene-by-scene studio', desc: 'Shot-level editor to take control of every frame.' },
        ],
        advancedTitle: 'Go further',
        advanced: [
          { icon: Settings, title: 'Brand kit',             desc: 'Logo, fonts, colours: every video on-brand.' },
          { icon: Mic,      title: 'Voices &amp; dubbing', desc: 'Pick the right ElevenLabs voice, clone a voice, tune prosody.' },
          { icon: HelpCircle,title:'Troubleshooting',       desc: 'The most common errors and how to fix them in 30 seconds.' },
        ],
        helpTitle: 'Stuck?',
        helpBody: 'Email us at',
        helpCta: 'Browse video examples',
        helpCtaHref: '/resources/examples',
      }

  function Group({ title, items }: { title: string; items: Array<{ icon: LucideIcon; title: string; desc: string }> }) {
    return (
      <section className="mb-12">
        <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground mb-5">{title}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.title} className="rounded-xl border border-border/50 bg-card/40 p-4 hover:bg-card/60 transition-colors">
              <div className="flex items-center gap-2.5 mb-1.5">
                <item.icon size={16} className="text-blue-500" />
                <h3
                  className="font-display font-semibold text-foreground text-sm"
                  dangerouslySetInnerHTML={{ __html: item.title }}
                />
              </div>
              <p
                className="font-body text-sm text-[--text-secondary]"
                dangerouslySetInnerHTML={{ __html: item.desc }}
              />
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      <DocTitle
        eyebrow={t.eyebrow}
        title={t.title.replace(/&rsquo;/g, '\u2019')}
      />
      <p className="font-body text-lg text-[--text-secondary] mb-10 leading-relaxed">{t.intro}</p>

      <Group title={t.startTitle} items={t.start} />
      <Group title={t.featuresTitle} items={t.features} />
      <Group title={t.advancedTitle} items={t.advanced} />

      <div className="rounded-2xl border border-border/50 bg-card/60 p-6 sm:p-8 mt-12">
        <h3 className="font-display text-lg font-semibold text-foreground mb-1.5">{t.helpTitle}</h3>
        <p className="font-body text-sm text-[--text-secondary]">
          {t.helpBody}{' '}
          <a
            href="mailto:{{CONTACT_EMAIL}}"
            className="font-mono text-blue-500 hover:underline underline-offset-2"
          >
            {'{{CONTACT_EMAIL}}'}
          </a>
          .
        </p>
        <Link
          href={t.helpCtaHref}
          className="inline-flex items-center gap-1.5 mt-4 text-sm font-display font-semibold text-blue-500 hover:text-blue-400 transition-colors"
        >
          {t.helpCta} <ArrowRight size={14} />
        </Link>
      </div>
    </>
  )
}
