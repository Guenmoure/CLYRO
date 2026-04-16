'use client'

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  FileText, Youtube, ArrowRight, Loader2, Sparkles,
  Globe, Wand2, Info, Check, Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { analyzeStudio, getStudioAvatars } from '@/lib/api'
import { useDraftSave } from '@/hooks/use-draft-save'
import { createBrowserClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Mode = 'script' | 'youtube'

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'es', label: 'Español',  flag: '🇪🇸' },
  { code: 'ar', label: 'العربية',  flag: '🇸🇦' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
]

const YOUTUBE_RE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/

function StudioNewPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialDraftId = searchParams.get('draft')

  const [mode, setMode] = useState<Mode>('script')
  const [title, setTitle] = useState('')
  const [script, setScript] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [language, setLanguage] = useState('fr')
  const [analyzing, setAnalyzing] = useState(false)
  const [step, setStep] = useState<string>('')
  const [restored, setRestored] = useState(false)

  // Avatar list
  const [avatars, setAvatars] = useState<Array<{ avatar_id: string; avatar_name: string; preview_image_url: string }>>([])
  const [avatarId, setAvatarId] = useState<string>('')
  const [loadingAvatars, setLoadingAvatars] = useState(true)
  const [avatarSearch, setAvatarSearch] = useState('')

  const filteredAvatars = useMemo(() => {
    if (!avatarSearch.trim()) return avatars
    const q = avatarSearch.toLowerCase()
    return avatars.filter((av) => av.avatar_name.toLowerCase().includes(q))
  }, [avatars, avatarSearch])

  useEffect(() => {
    getStudioAvatars()
      .then((data) => {
        setAvatars(data.stock)
        if (data.stock.length > 0) setAvatarId(data.stock[0]!.avatar_id)
      })
      .catch(() => setAvatars([]))
      .finally(() => setLoadingAvatars(false))
  }, [])

  // ── Restore draft from DB ───────────────────────────────────────────────────
  useEffect(() => {
    if (!initialDraftId || restored) return
    async function loadDraft() {
      const supabase = createBrowserClient()
      const { data } = await (supabase
        .from('videos')
        .select('wizard_state, title')
        .eq('id', initialDraftId)
        .single() as Promise<any>)
      if (!data) return
      setRestored(true)
      const s = data.wizard_state as Record<string, any>
      if (data.title)    setTitle(data.title)
      if (s.mode)        setMode(s.mode)
      if (s.script)      setScript(s.script)
      if (s.youtubeUrl)  setYoutubeUrl(s.youtubeUrl)
      if (s.language)    setLanguage(s.language)
      toast.success('Brouillon restauré — reprends là où tu t\'étais arrêté')
    }
    loadDraft()
  }, [initialDraftId, restored])

  // ── Draft auto-save ─────────────────────────────────────────────────────────
  useDraftSave({
    module:      'studio',
    title:       title || 'Studio Draft',
    style:       mode,
    currentStep: 0,
    totalSteps:  1,
    stepLabel:   'Setup',
    state:       { mode, script, youtubeUrl, language },
    initialDraftId,
  })

  // Derived metrics
  const words = useMemo(() => script.trim().split(/\s+/).filter(Boolean).length, [script])
  const estimatedMin = useMemo(() => Math.round((words / 150) * 10) / 10, [words])

  const scriptValid  = script.trim().length >= 30
  const urlValid     = YOUTUBE_RE.test(youtubeUrl.trim())
  const canAnalyze   = (mode === 'script' ? scriptValid : urlValid) && !analyzing

  async function handleAnalyze() {
    if (!canAnalyze) return
    setAnalyzing(true)

    try {
      setStep(mode === 'youtube' ? 'Transcription de la vidéo…' : 'Analyse de la structure…')

      const result = await analyzeStudio({
        inputType: mode === 'script' ? 'script' : 'youtube_url',
        value: mode === 'script' ? script.trim() : youtubeUrl.trim(),
        language,
        title: title.trim() || undefined,
        avatarId: avatarId || undefined,
        format: '16_9',
      })

      setStep('Redirection vers l\'éditeur…')
      toast.success(`Projet créé — ${result.sceneCount} scènes prêtes à générer`)
      router.push(`/studio/${result.projectId}/editor`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de l\'analyse')
    } finally {
      setAnalyzing(false)
      setStep('')
    }
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Badge variant="info" dot>
              <Sparkles size={10} className="mr-1" /> AI Avatar Studio
            </Badge>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            CLYRO Studio
          </h1>
          <p className="font-body text-sm text-[--text-secondary] max-w-xl mx-auto">
            Create a video with your AI avatar in a few minutes. Start from a script or a YouTube URL.
          </p>
        </div>

        {/* Mode selector — 2 big cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModeCard
            active={mode === 'script'}
            onClick={() => setMode('script')}
            icon={<FileText size={28} className="text-blue-500" />}
            title="I have a script"
            description="Paste your text and CLYRO generates the complete video."
            tags={['Any language', 'Auto-structured', 'Free format']}
          />
          <ModeCard
            active={mode === 'youtube'}
            onClick={() => setMode('youtube')}
            icon={<Youtube size={28} className="text-red-500" />}
            title="I have a YouTube video"
            description="CLYRO transcribes, improves and recreates it with your avatar."
            tags={['Any duration', 'Script improved by AI', 'Auto-chaptered']}
          />
        </div>

        {/* Title (optional) */}
        <div className="space-y-2">
          <label htmlFor="title" className="font-body text-sm font-semibold text-foreground">
            Project title <span className="text-[--text-muted] font-normal">(optional)</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Leave empty — CLYRO will suggest one"
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-secondary] focus:outline-none focus:border-blue-500 transition-colors"
            maxLength={120}
          />
        </div>

        {/* Content area */}
        {mode === 'script' ? (
          <div className="space-y-2">
            <label htmlFor="script" className="font-body text-sm font-semibold text-foreground">
              Your script
            </label>
            <textarea
              id="script"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={12}
              placeholder={`Paste your script here. CLYRO will:
  ✓ Split it into scenes automatically
  ✓ Choose the optimal visual type for each
  ✓ Generate the avatar and animations
  ✓ Assemble everything into a final video`}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-body text-foreground placeholder:text-[--text-secondary] focus:outline-none focus:border-blue-500 transition-colors resize-y"
            />
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-[--text-muted]">
                {words} words · ~{estimatedMin} min estimated
              </p>
              {scriptValid && <Check size={13} className="text-emerald-500" />}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label htmlFor="ytUrl" className="font-body text-sm font-semibold text-foreground">
              YouTube URL
            </label>
            <div className="relative">
              <Youtube size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none" />
              <input
                id="ytUrl"
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-secondary] focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="font-body text-xs text-[--text-secondary]">
                CLYRO will analyze and improve this content. The final video is a new, improved version —
                not a copy. Make sure you have the rights to this content.
              </p>
            </div>
          </div>
        )}

        {/* Language */}
        <div className="space-y-2">
          <label htmlFor="lang" className="font-body text-sm font-semibold text-foreground">
            Language
          </label>
          <div className="relative">
            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none" />
            <select
              id="lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2.5 text-sm font-body text-foreground focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.flag}  {l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Avatar picker */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-body text-sm font-semibold text-foreground">Avatar</p>
            {avatars.length > 0 && (
              <span className="font-body text-xs text-[--text-muted]">
                {filteredAvatars.length} avatar{filteredAvatars.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {loadingAvatars ? (
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : avatars.length === 0 ? (
            <Card variant="elevated" padding="md" className="flex items-center gap-3">
              <Info size={16} className="text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm text-foreground">HeyGen avatars unavailable</p>
                <p className="font-body text-xs text-[--text-secondary] mt-0.5">
                  Add <span className="font-mono">HEYGEN_API_KEY</span> on the server to load real avatars.
                  You can still create a project — avatar generation will fail gracefully.
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* Search avatars */}
              {avatars.length > 8 && (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none" />
                  <input
                    type="text"
                    value={avatarSearch}
                    onChange={(e) => setAvatarSearch(e.target.value)}
                    placeholder="Search avatars..."
                    className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              )}
              {/* Scrollable avatar grid */}
              <div className="max-h-[320px] overflow-y-auto rounded-xl pr-1 scrollbar-thin">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {filteredAvatars.map((av) => (
                    <button
                      key={av.avatar_id}
                      type="button"
                      onClick={() => setAvatarId(av.avatar_id)}
                      className={cn(
                        'relative rounded-xl overflow-hidden border transition-all card-interactive',
                        avatarId === av.avatar_id
                          ? 'border-blue-500 ring-2 ring-blue-500/30'
                          : 'border-border hover:border-border',
                      )}
                    >
                      <div
                        className="aspect-[3/4] bg-cover bg-center bg-muted"
                        style={{ backgroundImage: `url(${av.preview_image_url})` }}
                      />
                      {avatarId === av.avatar_id && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow">
                          <Check size={11} className="text-white" />
                        </div>
                      )}
                      <p className="font-body text-[11px] text-foreground px-2 py-1.5 truncate bg-card">
                        {av.avatar_name}
                      </p>
                    </button>
                  ))}
                </div>
                {filteredAvatars.length === 0 && avatarSearch && (
                  <p className="font-body text-sm text-[--text-muted] text-center py-6">
                    No avatars matching &ldquo;{avatarSearch}&rdquo;
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* CTA */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={analyzing}
          disabled={!canAnalyze}
          onClick={handleAnalyze}
          rightIcon={!analyzing ? <ArrowRight size={16} /> : undefined}
        >
          {analyzing
            ? (step || 'Analysis in progress…')
            : mode === 'script' ? 'Analyze my script' : 'Analyze the YouTube video'}
        </Button>

        {/* Progress steps during analysis */}
        {analyzing && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3 text-sm text-foreground">
              <Loader2 size={15} className="animate-spin text-blue-500 shrink-0" />
              <span className="font-body">{step}</span>
            </div>
            <div className="mt-3 space-y-1.5 pl-8">
              <StepLine done label="Project initialization" />
              {mode === 'youtube' && <StepLine done={step.includes('Claude')} label="YouTube transcription" />}
              <StepLine done={step.includes('Redirection')} label="Claude analyzes the structure" />
              <StepLine done={step.includes('Redirection')} label="Optimized scene split" />
            </div>
          </div>
        )}

        <p className="font-mono text-[11px] text-[--text-muted] text-center">
          <Wand2 size={10} className="inline mr-1" />
          Powered by HeyGen · ElevenLabs · Remotion · Claude
        </p>
      </div>
    </div>
  )
}

export default function StudioNewPage() {
  return (
    <Suspense>
      <StudioNewPageInner />
    </Suspense>
  )
}

// ── ModeCard ────────────────────────────────────────────────────────────

function ModeCard({
  active, onClick, icon, title, description, tags,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  description: string
  tags: string[]
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative text-left rounded-2xl border p-5 transition-all card-interactive',
        active
          ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/[0.03]'
          : 'border-border bg-card hover:border-border',
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="font-display text-lg font-bold text-foreground">{title}</p>
      <p className="font-body text-sm text-[--text-secondary] mt-1">{description}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {tags.map((t) => (
          <span key={t} className="inline-block rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-[--text-muted]">
            {t}
          </span>
        ))}
      </div>
      {active && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow">
          <Check size={12} className="text-white" />
        </div>
      )}
    </button>
  )
}

// ── StepLine ────────────────────────────────────────────────────────────

function StepLine({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <Check size={11} className="text-emerald-500 shrink-0" />
      ) : (
        <span className="w-[11px] h-[11px] rounded-full bg-muted border border-border shrink-0" />
      )}
      <span className={cn('font-mono text-[11px]', done ? 'text-[--text-secondary]' : 'text-[--text-muted]')}>
        {label}
      </span>
    </div>
  )
}
