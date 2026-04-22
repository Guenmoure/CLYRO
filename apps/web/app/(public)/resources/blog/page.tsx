// app/(public)/resources/blog/page.tsx
'use client'

import { Calendar, ArrowRight } from 'lucide-react'
import { PublicShell, DocTitle } from '@/components/public/PublicShell'

type Lang = 'en' | 'fr'

type Post = {
  date: string
  category: string
  title: string
  summary: string
  minutes: number
}

export default function BlogPage() {
  return (
    <PublicShell>
      {(lang) => <BlogBody lang={lang} />}
    </PublicShell>
  )
}

function BlogBody({ lang }: { lang: Lang }) {
  const t = lang === 'fr'
    ? {
        eyebrow: 'Blog',
        title: 'Carnet de bord CLYRO',
        intro: 'Retours produit, astuces créateurs, coulisses IA. Un article publié chaque semaine, sans fluff.',
        readMore: 'Lire',
        minutes: (n: number) => `${n} min`,
        soon: 'Plus d&rsquo;articles en préparation.',
      }
    : {
        eyebrow: 'Blog',
        title: 'The CLYRO logbook',
        intro: 'Product notes, creator tips, AI behind-the-scenes. One post a week, no fluff.',
        readMore: 'Read',
        minutes: (n: number) => `${n} min read`,
        soon: 'More posts coming soon.',
      }

  const posts: Post[] = lang === 'fr'
    ? [
        { date: '22 avril 2026', category: 'Produit',   title: 'Pourquoi nous avons réécrit le pipeline faceless', summary: 'Passage à un encodage veryfast CRF 28, réduction de 45 % de la taille des MP4, zéro perte de qualité perçue.', minutes: 5 },
        { date: '15 avril 2026', category: 'Coulisses', title: 'Comment nous préservons la langue du script',        summary: 'Détection implicite vs explicite : pourquoi demander « ne traduis jamais » bat un locale flag hardcodé.', minutes: 4 },
        { date: '08 avril 2026', category: 'Tutoriel',  title: 'Les 4 règles pour un storyboard qui tient la route', summary: 'Ce qui distingue un brief clair d&apos;un brief flou — avec des exemples côte à côte.', minutes: 6 },
        { date: '01 avril 2026', category: 'Produit',   title: 'Motion design en deux passes : le pourquoi',         summary: 'Brouillon rapide pour valider l&apos;intention, rendu HD pour la livraison. Retour d&apos;expérience.', minutes: 3 },
        { date: '25 mars 2026',  category: 'IA',        title: 'Choisir la bonne voix ElevenLabs',                    summary: 'Un framework simple pour matcher ton, rythme et émotion au sujet de la vidéo.', minutes: 7 },
      ]
    : [
        { date: 'April 22, 2026', category: 'Product',   title: 'Why we rewrote the faceless pipeline',           summary: 'Move to veryfast/CRF 28 encoding, 45% smaller MP4s, no perceptible quality loss.', minutes: 5 },
        { date: 'April 15, 2026', category: 'Behind',    title: 'How we preserve the script&rsquo;s language',      summary: 'Implicit vs explicit detection: why &ldquo;never translate&rdquo; beats a hardcoded locale flag.', minutes: 4 },
        { date: 'April 8, 2026',  category: 'Tutorial',  title: 'The 4 rules for a storyboard that holds up',      summary: 'What separates a clear brief from a fuzzy one — with side-by-side examples.', minutes: 6 },
        { date: 'April 1, 2026',  category: 'Product',   title: 'Two-pass motion design: the why',                  summary: 'Fast draft to validate intent, HD render for delivery. Lessons learned.', minutes: 3 },
        { date: 'March 25, 2026', category: 'AI',        title: 'Choosing the right ElevenLabs voice',              summary: 'A simple framework to match tone, pacing, and emotion to the video&rsquo;s subject.', minutes: 7 },
      ]

  return (
    <>
      <DocTitle eyebrow={t.eyebrow} title={t.title} />
      <p className="font-body text-lg text-[--text-secondary] mb-10 leading-relaxed">{t.intro}</p>

      <div className="flex flex-col gap-4 mb-12">
        {posts.map((post, i) => (
          <article
            key={i}
            className="rounded-xl border border-border/50 bg-card/40 p-5 sm:p-6 hover:bg-card/60 hover:border-border transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-2 font-mono text-[11px] uppercase tracking-wider text-[--text-muted]">
              <span className="inline-flex items-center gap-1">
                <Calendar size={11} />
                {post.date}
              </span>
              <span>·</span>
              <span className="text-blue-500">{post.category}</span>
              <span>·</span>
              <span>{t.minutes(post.minutes)}</span>
            </div>
            <h2
              className="font-display text-lg sm:text-xl font-semibold text-foreground mb-2 leading-snug group-hover:text-blue-500 transition-colors"
              dangerouslySetInnerHTML={{ __html: post.title }}
            />
            <p
              className="font-body text-sm text-[--text-secondary] leading-relaxed mb-3"
              dangerouslySetInnerHTML={{ __html: post.summary }}
            />
            <span className="inline-flex items-center gap-1 text-xs font-display font-semibold text-blue-500">
              {t.readMore}
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </article>
        ))}
      </div>

      <p
        className="font-body text-sm text-[--text-muted] text-center"
        dangerouslySetInnerHTML={{ __html: t.soon }}
      />
    </>
  )
}
