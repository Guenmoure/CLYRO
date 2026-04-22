// app/(public)/resources/changelog/page.tsx
'use client'

import { PublicShell, DocTitle } from '@/components/public/PublicShell'

type Lang = 'en' | 'fr'
type Tag = 'new' | 'improved' | 'fixed'

type Release = {
  version: string
  date: string
  entries: Array<{ tag: Tag; label: string }>
}

export default function ChangelogPage() {
  return (
    <PublicShell>
      {(lang) => <ChangelogBody lang={lang} />}
    </PublicShell>
  )
}

function ChangelogBody({ lang }: { lang: Lang }) {
  const t = lang === 'fr'
    ? {
        eyebrow: 'Changelog',
        title: 'Ce qui a changé sur CLYRO',
        intro: 'Chaque mise à jour : ce qui est nouveau, ce qui s&rsquo;est amélioré, ce qui était cassé. Pas de release note marketing.',
        tagLabels: { new: 'Nouveau', improved: 'Amélioré', fixed: 'Corrigé' } as Record<Tag, string>,
      }
    : {
        eyebrow: 'Changelog',
        title: 'What changed on CLYRO',
        intro: 'Every release: what&rsquo;s new, what improved, what was broken. No marketing gloss.',
        tagLabels: { new: 'New', improved: 'Improved', fixed: 'Fixed' } as Record<Tag, string>,
      }

  const releases: Release[] = lang === 'fr'
    ? [
        {
          version: 'v2.4.0',
          date: '22 avril 2026',
          entries: [
            { tag: 'fixed',    label: 'Préservation de la langue du script : plus de traduction automatique en français.' },
            { tag: 'improved', label: 'MP4 finaux 40-50 % plus légers (preset veryfast, CRF 28, faststart).' },
            { tag: 'fixed',    label: 'CSP : prévisualisation des voix ElevenLabs à nouveau jouable.' },
            { tag: 'improved', label: 'Concurrence ffmpeg réduite à 2 pour tenir les 2 Go RAM sur Render.' },
          ],
        },
        {
          version: 'v2.3.0',
          date: '10 avril 2026',
          entries: [
            { tag: 'new',      label: 'Pipeline F5 Studio : édition scène par scène avec transcription YouTube.' },
            { tag: 'improved', label: 'Storyboards Claude : 20 % plus rapides grâce au prompt caching.' },
            { tag: 'fixed',    label: 'Reprise propre des vidéos après timeout réseau.' },
          ],
        },
        {
          version: 'v2.2.0',
          date: '28 mars 2026',
          entries: [
            { tag: 'new',      label: 'Motion design en deux passes : brouillon rapide puis rendu HD.' },
            { tag: 'new',      label: 'Clonage de voix ElevenLabs intégré au Brand Kit.' },
            { tag: 'improved', label: 'Sous-titres burn-in avec typographie Syne native.' },
          ],
        },
        {
          version: 'v2.1.0',
          date: '12 mars 2026',
          entries: [
            { tag: 'new',      label: 'Crédits roll-over permanents tant que l&apos;abonnement est actif.' },
            { tag: 'improved', label: 'Calculateur de crédits sur la page Tarifs.' },
            { tag: 'fixed',    label: 'Générations bloquées à 99 % sur certains longs scripts.' },
          ],
        },
        {
          version: 'v2.0.0',
          date: '01 mars 2026',
          entries: [
            { tag: 'new',      label: 'Refonte complète du dashboard, nouveau design system.' },
            { tag: 'new',      label: 'Support multi-langue (FR, EN, ES, DE, PT).' },
            { tag: 'improved', label: 'Rendu Remotion bake du Chrome headless dans l&apos;image Docker.' },
          ],
        },
      ]
    : [
        {
          version: 'v2.4.0',
          date: 'April 22, 2026',
          entries: [
            { tag: 'fixed',    label: 'Script language preservation: no more auto-translation to French.' },
            { tag: 'improved', label: 'Final MP4s 40-50% smaller (veryfast preset, CRF 28, faststart).' },
            { tag: 'fixed',    label: 'CSP: ElevenLabs voice preview plays again.' },
            { tag: 'improved', label: 'ffmpeg concurrency reduced to 2 to fit 2 GB RAM on Render.' },
          ],
        },
        {
          version: 'v2.3.0',
          date: 'April 10, 2026',
          entries: [
            { tag: 'new',      label: 'F5 Studio pipeline: scene-by-scene editing with YouTube transcription.' },
            { tag: 'improved', label: 'Claude storyboards: 20% faster thanks to prompt caching.' },
            { tag: 'fixed',    label: 'Clean resume after network timeouts.' },
          ],
        },
        {
          version: 'v2.2.0',
          date: 'March 28, 2026',
          entries: [
            { tag: 'new',      label: 'Two-pass motion design: fast draft then HD render.' },
            { tag: 'new',      label: 'ElevenLabs voice cloning integrated in Brand Kit.' },
            { tag: 'improved', label: 'Burn-in captions now use native Syne typography.' },
          ],
        },
        {
          version: 'v2.1.0',
          date: 'March 12, 2026',
          entries: [
            { tag: 'new',      label: 'Permanent credit roll-over while subscription is active.' },
            { tag: 'improved', label: 'Live credit calculator on the Pricing page.' },
            { tag: 'fixed',    label: 'Generations stuck at 99% on certain long scripts.' },
          ],
        },
        {
          version: 'v2.0.0',
          date: 'March 1, 2026',
          entries: [
            { tag: 'new',      label: 'Dashboard redesign, new design system.' },
            { tag: 'new',      label: 'Multi-language support (FR, EN, ES, DE, PT).' },
            { tag: 'improved', label: 'Remotion headless Chrome baked into Docker image.' },
          ],
        },
      ]

  const tagStyle: Record<Tag, string> = {
    new:      'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    improved: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    fixed:    'bg-amber-500/10 text-amber-500 border-amber-500/30',
  }

  return (
    <>
      <DocTitle
        eyebrow={t.eyebrow}
        title={t.title.replace(/&rsquo;/g, '\u2019')}
      />
      <p className="font-body text-lg text-[--text-secondary] mb-10 leading-relaxed">{t.intro}</p>

      <div className="flex flex-col gap-8">
        {releases.map((release) => (
          <section key={release.version} className="pb-8 border-b border-border/30 last:border-0">
            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="font-display text-xl font-semibold text-foreground">{release.version}</h2>
              <span className="font-mono text-xs text-[--text-muted]">{release.date}</span>
            </div>
            <ul className="flex flex-col gap-2">
              {release.entries.map((entry, i) => (
                <li key={i} className="flex gap-2.5 items-start">
                  <span
                    className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] font-mono uppercase tracking-wider mt-0.5 ${tagStyle[entry.tag]}`}
                  >
                    {t.tagLabels[entry.tag]}
                  </span>
                  <span
                    className="font-body text-sm text-[--text-secondary] leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: entry.label }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
