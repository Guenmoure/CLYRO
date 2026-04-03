'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Video, Mic2, ChevronRight, Loader2, Upload, FileText, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { startFacelessGeneration, getVoices } from '@/lib/api'
import { useVideoStatus } from '@/hooks/use-video-status'
import { toast } from '@/components/ui/toast'
import { VideoPlayer } from '@/components/ui/video-player'
import type { FacelessStyle, VideoFormat, VideoDuration } from '@clyro/shared'

// ── Data ───────────────────────────────────────────────────────────────────────

const STYLES: Array<{ id: FacelessStyle; emoji: string; label: string; desc: string; color: string }> = [
  { id: 'animation-2d', emoji: '🎨', label: 'Animation 2D',  desc: 'Cartoon & illustration animée',    color: 'bg-purple-50 border-purple-200' },
  { id: 'stock-vo',     emoji: '🎬', label: 'Stock + VO',    desc: 'Vidéos stock avec voix off pro',    color: 'bg-blue-50 border-blue-200'   },
  { id: 'minimaliste',  emoji: '⬜', label: 'Minimaliste',   desc: 'Texte animé sur fond épuré',        color: 'bg-gray-50 border-gray-200'   },
  { id: 'infographie',  emoji: '📊', label: 'Infographie',   desc: 'Données et stats visuelles',        color: 'bg-green-50 border-green-200' },
  { id: 'whiteboard',   emoji: '✏️', label: 'Whiteboard',    desc: 'Dessin tableau blanc animé',        color: 'bg-yellow-50 border-yellow-200' },
  { id: 'cinematique',  emoji: '🎥', label: 'Cinématique',   desc: 'Ambiance cinéma dramatique',        color: 'bg-red-50 border-red-200'    },
]

const FORMATS: Array<{ id: VideoFormat; label: string; desc: string }> = [
  { id: '9:16', label: '9:16', desc: 'Stories / TikTok' },
  { id: '1:1',  label: '1:1',  desc: 'Instagram' },
  { id: '16:9', label: '16:9', desc: 'YouTube' },
]

const DURATIONS: Array<{ id: VideoDuration; label: string }> = [
  { id: '15s', label: '15s' },
  { id: '30s', label: '30s' },
  { id: '60s', label: '60s' },
]

const SCRIPT_TEMPLATES: Array<{ label: string; content: string }> = [
  {
    label: 'Tutoriel "Comment faire"',
    content: 'Dans cette vidéo, je vais vous montrer comment [sujet] en 3 étapes simples.\n\nÉtape 1 : [première étape]\nÉtape 2 : [deuxième étape]\nÉtape 3 : [troisième étape]\n\nMaintenant que vous savez comment [résultat], essayez dès aujourd\'hui !',
  },
  {
    label: 'Revue produit',
    content: 'Aujourd\'hui, je teste [nom du produit]. Est-ce que ça vaut vraiment le coup ?\n\nCe que j\'aime : [points positifs]\nCe que j\'aime moins : [points négatifs]\n\nMon verdict : [conclusion]. Laissez vos questions en commentaire !',
  },
  {
    label: 'Contenu éducatif',
    content: 'Saviez-vous que [fait surprenant] ? Dans cette vidéo, on va explorer [sujet].\n\n[Premier point clé]\n[Deuxième point clé]\n[Troisième point clé]\n\nSi ce contenu vous a été utile, abonnez-vous pour en voir plus !',
  },
  {
    label: 'Publicité produit',
    content: 'Vous en avez assez de [problème] ? [Nom du produit] est la solution.\n\nGrâce à [fonctionnalité 1] et [fonctionnalité 2], vous allez enfin [bénéfice principal].\n\nTentez l\'expérience gratuitement sur [site web]. Lien en description.',
  },
]

const PIPELINE = [
  { key: 'storyboard', label: 'Storyboard IA',     pct: 25  },
  { key: 'visuals',    label: 'Génération visuels', pct: 60  },
  { key: 'audio',      label: 'Voix off',           pct: 75  },
  { key: 'assembly',   label: 'Assemblage vidéo',   pct: 90  },
  { key: 'done',       label: 'Vidéo prête !',      pct: 100 },
]

interface VideoSession {
  id: string
  title: string | null
  status: string
  output_url?: string | null
  created_at: string
}

interface VoiceItem { id: string; name: string; gender?: string; accent?: string }

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    done:       'bg-[#eafaf1] text-[#27ae60]',
    processing: 'bg-brand-primary-light text-brand-primary',
    storyboard: 'bg-brand-primary-light text-brand-primary',
    visuals:    'bg-brand-primary-light text-brand-primary',
    audio:      'bg-brand-primary-light text-brand-primary',
    assembly:   'bg-brand-primary-light text-brand-primary',
    pending:    'bg-brand-bg text-brand-muted',
    error:      'bg-red-50 text-red-500',
  }
  const label: Record<string, string> = {
    done: 'Prête', processing: 'En cours', storyboard: 'Storyboard',
    visuals: 'Visuels', audio: 'Audio', assembly: 'Assemblage',
    pending: 'En attente', error: 'Erreur',
  }
  return (
    <span className={cn('font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full', map[status] ?? map.pending)}>
      {label[status] ?? status}
    </span>
  )
}

// ── Generating view ────────────────────────────────────────────────────────────

function GeneratingView({ videoId, title, onReset, onDone }: {
  videoId: string
  title: string
  onReset: () => void
  onDone: (id: string, outputUrl: string | null) => void
}) {
  const router = useRouter()
  const { status, progress, outputUrl, errorMessage, isDone, isError } = useVideoStatus(videoId)
  const notifiedRef = useRef(false)

  useEffect(() => {
    if (isDone && !notifiedRef.current) {
      notifiedRef.current = true
      onDone(videoId, outputUrl)
      const t = setTimeout(() => router.refresh(), 2500)
      return () => clearTimeout(t)
    }
  }, [isDone, videoId, outputUrl, onDone, router])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 max-w-lg mx-auto">
      <div className="w-full">
        <h2 className="font-display text-xl font-bold text-brand-text mb-1 text-center">
          {isError ? 'Erreur de génération' : isDone ? 'Vidéo prête !' : 'Génération en cours…'}
        </h2>
        <p className="text-brand-muted text-sm text-center mb-6">
          {!isDone && !isError && 'Environ 2–5 minutes. Tu peux fermer cet onglet.'}
        </p>

        <div className="h-1.5 bg-brand-bg rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-grad-primary rounded-full transition-all duration-700 progress-bar"
            style={{ '--progress-width': `${Math.max(progress, 5)}%` } as React.CSSProperties}
          />
        </div>

        <div className="space-y-3 mb-6">
          {PIPELINE.map((p) => {
            const done   = progress >= p.pct
            const active = status === p.key && !done
            return (
              <div key={p.key} className="flex items-center gap-3">
                <div className={cn(
                  'w-5 h-5 rounded-full border text-xs font-mono flex items-center justify-center transition-all',
                  done   ? 'bg-brand-primary border-brand-primary text-white'
                  : active ? 'border-brand-primary text-brand-primary'
                  : 'border-brand-border text-brand-muted'
                )}>
                  {done ? '✓' : '·'}
                </div>
                <span className={cn('font-body text-sm', done ? 'text-brand-text' : 'text-brand-muted')}>{p.label}</span>
                {active && <Loader2 size={12} className="text-brand-primary animate-spin" />}
              </div>
            )
          })}
        </div>

        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-4">
            {errorMessage ?? 'Une erreur est survenue.'}
          </div>
        )}

        {isDone && outputUrl && (
          <VideoPlayer url={outputUrl} title={title} />
        )}

        {isError && (
          <button type="button" onClick={onReset} className="mt-4 text-sm text-brand-primary font-medium hover:underline">
            Recommencer
          </button>
        )}
      </div>
    </div>
  )
}

// ── Done view ─────────────────────────────────────────────────────────────────

function DoneView({ session, onNew }: { session: VideoSession; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 max-w-lg mx-auto gap-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-brand-text">{session.title ?? 'Vidéo'}</h2>
          <button type="button" onClick={onNew} className="text-xs font-mono text-brand-primary hover:underline">+ Nouvelle vidéo</button>
        </div>
        {session.output_url ? (
          <VideoPlayer url={session.output_url} title={session.title ?? undefined} />
        ) : (
          <div className="flex items-center justify-center h-40 rounded-2xl bg-brand-bg border border-brand-border text-brand-muted text-sm">
            Vidéo non disponible
          </div>
        )}
      </div>
    </div>
  )
}

// ── Creation form ──────────────────────────────────────────────────────────────

function CreationForm({ onGenerated }: { onGenerated: (id: string, title: string) => void }) {
  const [style,     setStyle]     = useState<FacelessStyle | null>(null)
  const [format,    setFormat]    = useState<VideoFormat>('16:9')
  const [duration,  setDuration]  = useState<VideoDuration>('30s')
  const [voiceId,   setVoiceId]   = useState('')
  const [title,     setTitle]     = useState('')
  const [inputType, setInputType] = useState<'script' | 'audio'>('script')
  const [script,    setScript]    = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [voices,    setVoices]    = useState<VoiceItem[]>([])
  const [launching, setLaunching] = useState(false)
  const [showTpl,   setShowTpl]   = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getVoices().then(({ public: pub }) => setVoices(pub as VoiceItem[])).catch(() => {})
  }, [])

  const canSubmit = !!style && title.trim().length > 0 &&
    (inputType === 'script' ? script.trim().length >= 20 : !!audioFile)

  function applyTemplate(content: string) {
    setScript(content)
    setShowTpl(false)
  }

  async function handleGenerate() {
    if (!style) return
    setLaunching(true)
    try {
      const { video_id } = await startFacelessGeneration({
        title,
        style,
        input_type: inputType,
        script: inputType === 'script' ? script : undefined,
        voice_id: voiceId || undefined,
      })
      onGenerated(video_id, title)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-brand-border">
        <h1 className="font-display text-2xl font-bold text-brand-text">Nouvelle vidéo Faceless</h1>
        <p className="text-brand-muted text-sm mt-1">Choisissez un style, une voix, rédigez votre script — on s'occupe du reste.</p>
      </div>

      <div className="flex-1 px-8 py-6 space-y-7">

        {/* SECTION 1 — Style (cards uniquement, select doublon supprimé) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-brand-muted">Style visuel</p>
            {!style && <span className="font-mono text-[10px] text-red-400 uppercase tracking-wider">· Requis</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={cn(
                  'border rounded-xl p-4 text-left transition-all',
                  s.color,
                  style === s.id ? 'ring-2 ring-brand-primary ring-offset-1' : 'hover:shadow-brand-sm'
                )}
              >
                <span className="text-xl mb-2 block">{s.emoji}</span>
                <p className="font-display font-semibold text-brand-text text-sm">{s.label}</p>
                <p className="font-body text-xs text-brand-muted mt-0.5">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 2 — Format + Durée + Voix */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-36">
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Format</label>
            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button key={f.id} type="button" onClick={() => setFormat(f.id)}
                  title={f.desc}
                  className={cn('flex-1 py-2.5 rounded-xl border text-xs font-display font-semibold transition-all',
                    format === f.id ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40'
                  )}>
                  {f.label}
                  <p className="font-body font-normal text-[10px] mt-0.5 opacity-70">{f.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-28">
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Durée</label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button key={d.id} type="button" onClick={() => setDuration(d.id)}
                  className={cn('flex-1 py-2.5 rounded-xl border text-xs font-display font-semibold transition-all',
                    duration === d.id ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40'
                  )}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-36">
            <label htmlFor="faceless-voice" className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Voix off</label>
            <div className="relative">
              <Mic2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
              <select id="faceless-voice" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}
                aria-label="Sélectionner une voix off"
                className="w-full bg-brand-bg border border-brand-border rounded-xl pl-8 pr-3 py-2.5 text-brand-text font-body text-sm focus:outline-none focus:border-brand-primary appearance-none">
                <option value="">Aucune voix</option>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}{v.gender ? ` · ${v.gender}` : ''}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 3 — Titre */}
        <div>
          <label htmlFor="faceless-title" className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Titre</label>
          <input
            id="faceless-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex: Comment apprendre à coder en 30 jours"
            maxLength={200}
            className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none focus:border-brand-primary"
          />
        </div>

        {/* SECTION 4 — Script ou Audio */}
        <div>
          {/* Toggle script / audio */}
          <div className="flex items-center gap-1 mb-3 bg-brand-bg border border-brand-border rounded-xl p-1 w-fit">
            <button
              type="button"
              onClick={() => setInputType('script')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                inputType === 'script' ? 'bg-white shadow-sm text-brand-text' : 'text-brand-muted hover:text-brand-text'
              )}>
              <FileText size={12} />
              Script
            </button>
            <button
              type="button"
              onClick={() => setInputType('audio')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                inputType === 'audio' ? 'bg-white shadow-sm text-brand-text' : 'text-brand-muted hover:text-brand-text'
              )}>
              <Upload size={12} />
              Audio existant
            </button>
          </div>

          {inputType === 'script' ? (
            <div>
              {/* Templates */}
              <div className="relative mb-2">
                <button
                  type="button"
                  onClick={() => setShowTpl((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-mono text-brand-primary hover:underline"
                >
                  <FileText size={11} />
                  Utiliser un template
                  <ChevronDown size={11} className={cn('transition-transform', showTpl && 'rotate-180')} />
                </button>
                {showTpl && (
                  <div className="absolute top-6 left-0 z-10 bg-white border border-brand-border rounded-xl shadow-lg py-1 w-64">
                    {SCRIPT_TEMPLATES.map((t) => (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => applyTemplate(t.content)}
                        className="w-full text-left px-4 py-2.5 text-sm font-body text-brand-text hover:bg-brand-bg transition-colors"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative border border-brand-border rounded-2xl bg-brand-bg focus-within:border-brand-primary transition-colors">
                <textarea
                  id="faceless-script"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Décrivez votre idée ou collez votre script complet…"
                  maxLength={5000}
                  rows={7}
                  aria-label="Script de la vidéo"
                  className="w-full bg-transparent px-4 pt-4 pb-14 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none resize-none rounded-2xl"
                />
                <div className="absolute bottom-3 left-4 right-3 flex items-center justify-between">
                  <span className={cn('font-mono text-[11px]', script.length < 20 ? 'text-red-400' : 'text-brand-muted')}>
                    {script.length}/5000{script.length < 20 ? ` · encore ${20 - script.length} car.` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!canSubmit || launching}
                    className="flex items-center gap-2 bg-brand-text text-white font-display font-semibold text-sm px-5 py-2 rounded-xl disabled:opacity-40 hover:opacity-80 transition-opacity"
                  >
                    {launching ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                    Générer
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
                  audioFile ? 'border-brand-primary bg-brand-primary-light' : 'border-brand-border hover:border-brand-primary hover:bg-brand-bg'
                )}
              >
                <Upload size={24} className={cn('mx-auto mb-3', audioFile ? 'text-brand-primary' : 'text-brand-muted')} />
                <p className="font-display font-semibold text-sm text-brand-text">
                  {audioFile ? audioFile.name : 'Cliquez ou déposez votre fichier audio'}
                </p>
                <p className="text-xs text-brand-muted mt-1">MP3, WAV, M4A — max 50 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/mp4,audio/m4a"
                  aria-label="Fichier audio à importer"
                  className="hidden"
                  onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canSubmit || launching}
                className="w-full flex items-center justify-center gap-2 bg-brand-text text-white font-display font-semibold text-sm px-5 py-3 rounded-xl disabled:opacity-40 hover:opacity-80 transition-opacity"
              >
                {launching ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                Générer la vidéo
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Main Hub ───────────────────────────────────────────────────────────────────

export function FacelessHub({ initialVideos }: { initialVideos: VideoSession[] }) {
  const [sessions,        setSessions]        = useState<VideoSession[]>(initialVideos)
  const [generatingId,    setGeneratingId]    = useState<string | null>(null)
  const [generatingTitle, setGeneratingTitle] = useState('')
  const [activeSession,   setActiveSession]   = useState<VideoSession | null>(null)

  function handleGenerated(videoId: string, title: string) {
    setGeneratingId(videoId)
    setGeneratingTitle(title)
    setActiveSession(null)
    setSessions((prev) => [
      { id: videoId, title, status: 'processing', created_at: new Date().toISOString() },
      ...prev,
    ])
  }

  function handleDone(videoId: string, outputUrl: string | null) {
    setSessions((prev) =>
      prev.map((s) => s.id === videoId ? { ...s, status: 'done', output_url: outputUrl ?? undefined } : s)
    )
  }

  function handleReset() {
    setGeneratingId(null)
    setGeneratingTitle('')
    setActiveSession(null)
  }

  function handleSessionClick(session: VideoSession) {
    if (generatingId === session.id) return
    setActiveSession(session)
    setGeneratingId(null)
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">

      {/* Sidebar 208px — titre + statut + date lisibles (F1) */}
      <aside className="w-52 bg-brand-surface border-r border-brand-border flex flex-col shrink-0">
        <div className="p-4 border-b border-brand-border">
          <h2 className="font-display text-sm font-semibold text-brand-text">Faceless Video</h2>
        </div>
        <div className="p-3 border-b border-brand-border">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-sm font-body text-brand-text hover:border-brand-primary/40 hover:bg-blue-50 transition-all"
          >
            <Plus size={16} className="text-brand-primary" />
            Nouvelle vidéo
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <Video size={28} className="text-brand-border mb-2" />
              <p className="text-brand-muted font-body text-xs">Aucune session. Créez votre première vidéo !</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => {
                const isActive = activeSession?.id === s.id || generatingId === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSessionClick(s)}
                    title={s.title ?? 'Sans titre'}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-xl transition-all',
                      isActive ? 'bg-blue-50' : 'hover:bg-brand-bg'
                    )}
                  >
                    <p className="font-body text-sm text-brand-text truncate">{s.title ?? 'Sans titre'}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <StatusBadge status={s.status} />
                      <span className="font-mono text-[10px] text-brand-muted">
                        {new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Panel principal */}
      <div className="flex-1 overflow-hidden">
        {generatingId
          ? <GeneratingView videoId={generatingId} title={generatingTitle} onReset={handleReset} onDone={handleDone} />
          : activeSession?.status === 'done'
            ? <DoneView session={activeSession} onNew={handleReset} />
            : <CreationForm onGenerated={handleGenerated} />
        }
      </div>
    </div>
  )
}
