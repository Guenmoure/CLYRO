// app/(public)/resources/examples/page.tsx
'use client'

import Link from 'next/link'
import { Play, Sparkles, Layers, Scissors, ArrowRight } from 'lucide-react'
import { PublicShell, DocTitle } from '@/components/public/PublicShell'

type Lang = 'en' | 'fr'

export default function ExamplesPage() {
  return (
    <PublicShell>
      {(lang) => <ExamplesBody lang={lang} />}
    </PublicShell>
  )
}

type Example = {
  title: string
  pipeline: 'F1' | 'F2' | 'F5'
  duration: string
  format: string
  summary: string
}

function ExamplesBody({ lang }: { lang: Lang }) {
  const t = lang === 'fr'
    ? {
        eyebrow: 'Exemples',
        title: 'Des vidéos concrètes faites sur CLYRO',
        intro: 'Une sélection représentative des trois pipelines : faceless éditoriale, motion design produit, et studio scène par scène. Les fichiers sources et briefs sont disponibles sur demande.',
        pipelineTitles: { F1: 'F1 · Faceless', F2: 'F2 · Motion', F5: 'F5 · Studio' },
        details: 'Voir le détail',
        requestCta: 'Demander un exemple adapté à ton secteur',
        requestHref: '/legal/contact?lang=fr',
      }
    : {
        eyebrow: 'Examples',
        title: 'Real videos produced with CLYRO',
        intro: 'A curated selection across the three pipelines: editorial faceless, product motion design, and scene-by-scene studio. Source briefs and project files available on request.',
        pipelineTitles: { F1: 'F1 · Faceless', F2: 'F2 · Motion', F5: 'F5 · Studio' },
        details: 'See details',
        requestCta: 'Ask for an example in your industry',
        requestHref: '/legal/contact',
      }

  const examples: Example[] = lang === 'fr'
    ? [
        { title: 'Résumé actu tech du matin',  pipeline: 'F1', duration: '1:12', format: '9:16', summary: 'Voix off française, coupe rythmée, B-roll Pexels, sous-titres burn-in.' },
        { title: 'Fiche produit SaaS B2B',     pipeline: 'F2', duration: '0:45', format: '16:9', summary: 'Motion design en deux passes, logo animé, texte dynamique à la charte.' },
        { title: 'Témoignage client',          pipeline: 'F5', duration: '1:30', format: '9:16', summary: 'Découpe scène par scène, voix clonée, incrustations texte contextuelles.' },
        { title: 'Explainer « Comment ça marche »', pipeline: 'F1', duration: '0:58', format: '1:1', summary: 'Narration calme, visuels minimalistes, rythme pédagogique.' },
        { title: 'Teaser lancement produit',   pipeline: 'F2', duration: '0:20', format: '9:16', summary: 'Ouverture flash, animations kinetic typography, CTA final.' },
        { title: 'Annonce recrutement',        pipeline: 'F5', duration: '1:05', format: '9:16', summary: 'Scènes sélectionnées à la main, sous-titres bilingues, musique libre de droits.' },
      ]
    : [
        { title: 'Morning tech news recap',    pipeline: 'F1', duration: '1:12', format: '9:16', summary: 'English voice-over, punchy cuts, Pexels B-roll, burned-in captions.' },
        { title: 'B2B SaaS product sheet',     pipeline: 'F2', duration: '0:45', format: '16:9', summary: 'Two-pass motion design, animated logo, dynamic on-brand typography.' },
        { title: 'Customer testimonial',       pipeline: 'F5', duration: '1:30', format: '9:16', summary: 'Scene-by-scene edit, cloned voice, contextual text overlays.' },
        { title: '&ldquo;How it works&rdquo; explainer', pipeline: 'F1', duration: '0:58', format: '1:1', summary: 'Calm narration, minimalist visuals, pedagogical pacing.' },
        { title: 'Product launch teaser',      pipeline: 'F2', duration: '0:20', format: '9:16', summary: 'Flash opener, kinetic typography animations, final CTA.' },
        { title: 'Hiring announcement',        pipeline: 'F5', duration: '1:05', format: '9:16', summary: 'Hand-picked scenes, bilingual captions, royalty-free music.' },
      ]

  const pipelineStyle: Record<Example['pipeline'], string> = {
    F1: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    F2: 'bg-violet-500/10 text-violet-500 border-violet-500/30',
    F5: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  }
  const pipelineIcon = { F1: Sparkles, F2: Layers, F5: Scissors }

  return (
    <>
      <DocTitle eyebrow={t.eyebrow} title={t.title} />
      <p className="font-body text-lg text-[--text-secondary] mb-10 leading-relaxed">{t.intro}</p>

      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        {examples.map((ex, i) => {
          const Icon = pipelineIcon[ex.pipeline]
          return (
            <article
              key={i}
              className="rounded-xl border border-border/50 bg-card/40 overflow-hidden hover:bg-card/60 transition-colors group"
            >
              {/* Visual placeholder — replace src once real renders are uploaded */}
              <div className="aspect-video bg-gradient-to-br from-muted/60 to-muted/30 flex items-center justify-center relative overflow-hidden">
                <div className="w-12 h-12 rounded-full bg-foreground/10 backdrop-blur flex items-center justify-center group-hover:bg-foreground/20 transition-colors">
                  <Play size={18} className="text-foreground ml-0.5" fill="currentColor" />
                </div>
                <span className="absolute top-2 right-2 font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/70 backdrop-blur text-[--text-secondary]">
                  {ex.duration} · {ex.format}
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono uppercase tracking-wider ${pipelineStyle[ex.pipeline]}`}>
                    <Icon size={10} />
                    {t.pipelineTitles[ex.pipeline]}
                  </span>
                </div>
                <h3
                  className="font-display font-semibold text-foreground text-sm mb-1.5"
                  dangerouslySetInnerHTML={{ __html: ex.title }}
                />
                <p className="font-body text-xs text-[--text-secondary] leading-relaxed">{ex.summary}</p>
              </div>
            </article>
          )
        })}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/60 p-6 sm:p-8 text-center">
        <Link
          href={t.requestHref}
          className="inline-flex items-center gap-1.5 text-sm font-display font-semibold text-blue-500 hover:text-blue-400 transition-colors"
        >
          {t.requestCta} <ArrowRight size={14} />
        </Link>
      </div>
    </>
  )
}
