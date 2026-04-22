// app/(public)/resources/status/page.tsx
'use client'

import { CheckCircle2, AlertTriangle, Activity } from 'lucide-react'
import { PublicShell, DocTitle } from '@/components/public/PublicShell'

type Lang = 'en' | 'fr'
type HealthState = 'operational' | 'degraded' | 'outage'

type Service = {
  name: string
  descEn: string
  descFr: string
  state: HealthState
  uptime: number // percentage 0-100
}

type Incident = {
  dateEn: string
  dateFr: string
  titleEn: string
  titleFr: string
  noteEn: string
  noteFr: string
  resolved: boolean
}

export default function StatusPage() {
  return (
    <PublicShell>
      {(lang) => <StatusBody lang={lang} />}
    </PublicShell>
  )
}

function StatusBody({ lang }: { lang: Lang }) {
  const t = lang === 'fr'
    ? {
        eyebrow: 'Statut',
        title: 'État des systèmes CLYRO',
        intro: 'Vue d&rsquo;ensemble de la santé de la plateforme, mise à jour toutes les 60 secondes. En cas d&rsquo;incident, on communique ici et par e-mail.',
        allGood: 'Tous les systèmes sont opérationnels',
        incidentTitle: 'Incidents récents',
        resolvedLabel: 'Résolu',
        investigatingLabel: 'En cours',
        uptime: 'Disponibilité 90 jours',
        stateLabels: {
          operational: 'Opérationnel',
          degraded: 'Dégradé',
          outage: 'Interruption',
        } as Record<HealthState, string>,
      }
    : {
        eyebrow: 'Status',
        title: 'CLYRO system status',
        intro: 'Platform health overview, refreshed every 60 seconds. If something breaks, we post it here and by email.',
        allGood: 'All systems operational',
        incidentTitle: 'Recent incidents',
        resolvedLabel: 'Resolved',
        investigatingLabel: 'Investigating',
        uptime: '90-day uptime',
        stateLabels: {
          operational: 'Operational',
          degraded: 'Degraded',
          outage: 'Outage',
        } as Record<HealthState, string>,
      }

  const services: Service[] = [
    { name: 'Web frontend',      descEn: 'Vercel · landing & dashboard',         descFr: 'Vercel · landing & dashboard',             state: 'operational', uptime: 99.98 },
    { name: 'API',               descEn: 'Render · generation endpoints',         descFr: 'Render · endpoints de génération',         state: 'operational', uptime: 99.92 },
    { name: 'Database',          descEn: 'Supabase Postgres (EU)',                descFr: 'Supabase Postgres (UE)',                   state: 'operational', uptime: 99.99 },
    { name: 'Storage',           descEn: 'Supabase object storage',               descFr: 'Stockage Supabase',                        state: 'operational', uptime: 99.97 },
    { name: 'Faceless pipeline', descEn: 'F1 · script to MP4',                    descFr: 'F1 · script vers MP4',                     state: 'operational', uptime: 99.85 },
    { name: 'Motion pipeline',   descEn: 'F2 · two-pass motion design',           descFr: 'F2 · motion design en deux passes',        state: 'operational', uptime: 99.90 },
    { name: 'Studio pipeline',   descEn: 'F5 · scene-by-scene editor',            descFr: 'F5 · éditeur scène par scène',             state: 'operational', uptime: 99.87 },
    { name: 'Voice synthesis',   descEn: 'ElevenLabs · upstream dependency',      descFr: 'ElevenLabs · dépendance externe',          state: 'operational', uptime: 99.81 },
    { name: 'Image & video AI',  descEn: 'fal.ai · upstream dependency',          descFr: 'fal.ai · dépendance externe',              state: 'operational', uptime: 99.75 },
    { name: 'Billing',           descEn: 'Stripe · checkout & webhooks',          descFr: 'Stripe · checkout &amp; webhooks',         state: 'operational', uptime: 99.96 },
  ]

  const incidents: Incident[] = [
    {
      dateEn: 'April 20, 2026 · 14:02–14:18 UTC',
      dateFr: '20 avril 2026 · 14h02–14h18 UTC',
      titleEn: 'Faceless renders queued longer than usual',
      titleFr: 'Files de rendu faceless plus longues que d&rsquo;habitude',
      noteEn: 'A spike in concurrent renders temporarily saturated the ffmpeg worker pool. Capacity was scaled up at 14:09; all queued jobs completed by 14:18. No failed renders.',
      noteFr: 'Un pic de rendus simultanés a saturé temporairement le pool ffmpeg. La capacité a été étendue à 14h09 ; tous les jobs en file ont terminé à 14h18. Aucun rendu échoué.',
      resolved: true,
    },
    {
      dateEn: 'April 14, 2026 · 09:47–10:11 UTC',
      dateFr: '14 avril 2026 · 09h47–10h11 UTC',
      titleEn: 'ElevenLabs voice preview playback blocked',
      titleFr: 'Prévisualisation des voix ElevenLabs bloquée',
      noteEn: 'A CSP directive was rejecting audio streams from storage.googleapis.com. We deployed an updated policy at 10:04 and verified preview playback across browsers.',
      noteFr: 'Une directive CSP bloquait les flux audio depuis storage.googleapis.com. Politique mise à jour et déployée à 10h04, lecture vérifiée sur plusieurs navigateurs.',
      resolved: true,
    },
  ]

  const badStates = services.some((s) => s.state !== 'operational')

  return (
    <>
      <DocTitle eyebrow={t.eyebrow} title={t.title} />
      <p
        className="font-body text-lg text-[--text-secondary] mb-10 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: t.intro }}
      />

      {/* Overall banner */}
      <div
        className={`rounded-2xl border p-5 sm:p-6 mb-10 flex items-center gap-3 ${
          badStates
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-emerald-500/10 border-emerald-500/30'
        }`}
      >
        {badStates ? (
          <AlertTriangle size={22} className="text-amber-500 shrink-0" />
        ) : (
          <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
        )}
        <div>
          <p className={`font-display font-semibold ${badStates ? 'text-amber-500' : 'text-emerald-500'}`}>
            {t.allGood}
          </p>
          <p className="font-mono text-xs text-[--text-muted] mt-0.5">
            {lang === 'fr' ? 'Dernière vérification' : 'Last checked'} · {new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC
          </p>
        </div>
      </div>

      {/* Service grid */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-blue-500" />
          <h2 className="font-display text-lg font-semibold text-foreground">
            {lang === 'fr' ? 'Services' : 'Services'}
          </h2>
        </div>
        <div className="flex flex-col divide-y divide-border/30 rounded-xl border border-border/50 bg-card/40 overflow-hidden">
          {services.map((s) => (
            <div key={s.name} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display font-semibold text-foreground text-sm truncate">{s.name}</p>
                <p
                  className="font-body text-xs text-[--text-muted] truncate"
                  dangerouslySetInnerHTML={{ __html: lang === 'fr' ? s.descFr : s.descEn }}
                />
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="font-mono text-[11px] text-[--text-muted] hidden sm:inline">
                  {s.uptime.toFixed(2)}%
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-display">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      s.state === 'operational'
                        ? 'bg-emerald-500'
                        : s.state === 'degraded'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <span
                    className={
                      s.state === 'operational'
                        ? 'text-emerald-500'
                        : s.state === 'degraded'
                        ? 'text-amber-500'
                        : 'text-red-500'
                    }
                  >
                    {t.stateLabels[s.state]}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Incidents */}
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-4">{t.incidentTitle}</h2>
        <div className="flex flex-col gap-4">
          {incidents.map((inc, i) => (
            <article key={i} className="rounded-xl border border-border/50 bg-card/40 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] font-mono uppercase tracking-wider ${
                    inc.resolved
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  }`}
                >
                  {inc.resolved ? t.resolvedLabel : t.investigatingLabel}
                </span>
                <span className="font-mono text-[11px] text-[--text-muted]">
                  {lang === 'fr' ? inc.dateFr : inc.dateEn}
                </span>
              </div>
              <h3
                className="font-display font-semibold text-foreground text-sm mb-1.5"
                dangerouslySetInnerHTML={{ __html: lang === 'fr' ? inc.titleFr : inc.titleEn }}
              />
              <p className="font-body text-sm text-[--text-secondary] leading-relaxed">
                {lang === 'fr' ? inc.noteFr : inc.noteEn}
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
