'use client'

import { useEffect, useState } from 'react'
import { Code2, Zap, BookOpen, Check, Loader2 } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'

export function ApiSection() {
  const supabase = createBrowserClient()
  const [email, setEmail] = useState('')
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      setEmail(session?.user?.email ?? '')
      setJoined(localStorage.getItem('clyro_api_waitlist') === 'true')
    }
    load()
  }, [supabase])

  async function handleJoin() {
    if (joining || joined) return
    setJoining(true)
    try {
      // Stub — in production, POST to /api/v1/waitlist with email
      await new Promise((r) => setTimeout(r, 400))
      localStorage.setItem('clyro_api_waitlist', 'true')
      setJoined(true)
      toast.success('Tu es sur la liste d\'attente API')
    } catch {
      toast.error('Erreur')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">API</h2>
        <p className="font-body text-sm text-[--text-secondary] mt-1">
          Intègre Clyro dans tes propres outils et workflows.
        </p>
      </div>

      {/* Hero — waitlist */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/20 blur-3xl" />

        <div className="relative p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-background border border-border flex items-center justify-center shrink-0">
              <Code2 size={22} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-bold text-foreground">API Clyro</h3>
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted border border-border text-[--text-muted]">
                  Bientôt
                </span>
              </div>
              <p className="font-body text-sm text-[--text-secondary] max-w-md">
                Génère des vidéos Faceless, Motion et Brand programmatiquement.
                Parfait pour alimenter ton CRM, ton outil no-code ou ton app mobile.
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Feature icon={Zap}      title="Génération instantanée" body="Endpoint REST pour lancer une vidéo en 1 appel." />
            <Feature icon={BookOpen} title="Webhooks"                body="Notifié dès qu'une vidéo est prête." />
            <Feature icon={Code2}    title="SDKs"                    body="Client officiel TypeScript + Python." />
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining || joined || !email}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-display font-semibold transition-all ${
                joined
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 cursor-default'
                  : 'bg-gray-900 dark:bg-foreground dark:text-gray-950 text-white hover:opacity-90 disabled:opacity-60'
              }`}
            >
              {joining ? <><Loader2 size={13} className="animate-spin" /> En cours…</> :
                joined   ? <><Check size={13} /> Tu es inscrit</> :
                'Rejoindre la liste d\'attente'}
            </button>
            {email && (
              <p className="font-mono text-xs text-[--text-secondary] truncate">
                via <span className="text-foreground">{email}</span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Code preview teaser */}
      <div className="rounded-2xl border border-border bg-[#0A0D1A] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-black/30">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">Preview · Bientôt</span>
        </div>
        <pre className="px-4 py-4 font-mono text-[11px] leading-relaxed text-white/80 overflow-x-auto">
{`import { Clyro } from '@clyro/sdk'

const clyro = new Clyro({ apiKey: process.env.CLYRO_KEY })

const video = await clyro.faceless.create({
  script: 'Comment dormir mieux en 3 étapes...',
  style: 'minimaliste',
  voice: 'fr-female-01',
  duration: 30,
})

console.log(video.output_url)
// https://cdn.clyro.app/v/abc123.mp4`}
        </pre>
      </div>
    </div>
  )
}

// ── Feature card ─────────────────────────────────────────────────────────

function Feature({
  icon: Icon, title, body,
}: {
  icon: React.ElementType
  title: string
  body: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-1">
      <div className="flex items-center gap-2">
        <Icon size={13} className="text-blue-500" />
        <p className="font-body text-xs font-semibold text-foreground">{title}</p>
      </div>
      <p className="font-body text-[11px] text-[--text-secondary] leading-relaxed">{body}</p>
    </div>
  )
}
