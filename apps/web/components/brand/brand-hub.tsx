'use client'

import { useState, useRef } from 'react'
import { Plus, Palette, Trash2, Loader2, Upload, Wand2, Download, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createBrandKit, updateBrandKit, deleteBrandKit, uploadBrandLogo,
  generateBrandAsset, getBrandAssets, deleteBrandAsset,
} from '@/lib/api'
import type { BrandAsset, SocialPlatform } from '@/lib/api'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'
import type { BrandKit, CreateBrandKitPayload } from '@clyro/shared'
import { BrandStudio } from '@/components/branding/brand-studio'

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS: Array<{ id: SocialPlatform; label: string; emoji: string; ratio: string }> = [
  { id: 'instagram_post',  label: 'Instagram Post', emoji: '📷', ratio: '1:1'  },
  { id: 'instagram_story', label: 'Story / TikTok',  emoji: '📱', ratio: '9:16' },
  { id: 'linkedin',        label: 'LinkedIn',        emoji: '💼', ratio: '16:9' },
  { id: 'twitter',         label: 'X / Twitter',     emoji: '🐦', ratio: '16:9' },
  { id: 'youtube_thumb',   label: 'YouTube',         emoji: '▶️', ratio: '16:9' },
]

// ── Brand Kit Form ─────────────────────────────────────────────────────────────

function BrandKitForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<BrandKit>
  onSave: (kit: BrandKit) => void
  onCancel: () => void
}) {
  const [name,           setName]           = useState(initial?.name ?? '')
  const [primaryColor,   setPrimaryColor]   = useState(initial?.primary_color ?? '#6366f1')
  const [secondaryColor, setSecondaryColor] = useState(initial?.secondary_color ?? '')
  const [fontFamily,     setFontFamily]     = useState(initial?.font_family ?? '')
  const [logoFile,       setLogoFile]       = useState<File | null>(null)
  const [logoPreview,    setLogoPreview]    = useState<string>(initial?.logo_url ?? '')
  const [isDefault,      setIsDefault]      = useState(initial?.is_default ?? false)
  const [saving,         setSaving]         = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSave() {
    if (!name.trim()) { toast.error('Le nom est requis.'); return }
    setSaving(true)
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      let logoUrl = initial?.logo_url ?? undefined
      if (logoFile) logoUrl = await uploadBrandLogo(logoFile, user.id)

      const payload: CreateBrandKitPayload = {
        name:            name.trim(),
        primary_color:   primaryColor,
        secondary_color: secondaryColor || undefined,
        font_family:     fontFamily || undefined,
        logo_url:        logoUrl,
        is_default:      isDefault,
      }

      const result = initial?.id
        ? (await updateBrandKit({ id: initial.id, ...payload })).data
        : (await createBrandKit(payload)).data

      toast.success(initial?.id ? 'Brand kit mis à jour.' : 'Brand kit créé.')
      onSave(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-display font-semibold text-gray-900 dark:text-white text-sm">
        {initial?.id ? 'Modifier' : 'Nouveau brand kit'}
      </h3>

      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Nom du brand (ex: CLYRO Official)"
        className="w-full glass rounded-xl px-3 py-2.5 text-gray-700 dark:text-white/80 font-body text-sm placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none transition-all"
      />

      <div className="flex gap-4">
        <div className="flex-1">
          <p className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/30 mb-1.5">Couleur principale</p>
          <div className="flex items-center gap-2">
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent" />
            <span className="font-mono text-xs text-gray-500 dark:text-white/50">{primaryColor.toUpperCase()}</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/30 mb-1.5">Secondaire</p>
          <div className="flex items-center gap-2">
            <input type="color" value={secondaryColor || '#ffffff'} onChange={(e) => setSecondaryColor(e.target.value)}
              className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent" />
            {secondaryColor
              ? <button type="button" onClick={() => setSecondaryColor('')} className="text-xs text-gray-400 dark:text-white/30 hover:text-red-400"><X size={11} /></button>
              : <span className="font-mono text-xs text-gray-400 dark:text-white/25">—</span>
            }
          </div>
        </div>
      </div>

      <input
        type="text" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
        placeholder="Police (ex: Montserrat)"
        className="w-full glass rounded-xl px-3 py-2.5 text-gray-700 dark:text-white/80 font-body text-sm placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none transition-all"
      />

      <div className="flex items-center gap-3">
        {logoPreview && <img src={logoPreview} alt="Logo" className="w-10 h-10 object-contain rounded-lg glass" />}
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 glass glass-hover rounded-xl px-3 py-2 text-xs font-body text-gray-500 dark:text-white/50 transition-all">
          <Upload size={12} /> {logoPreview ? 'Changer le logo' : 'Importer un logo'}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)) } }} />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-3.5 h-3.5 rounded accent-clyro-primary" />
        <span className="font-body text-xs text-gray-500 dark:text-white/50">Utiliser par défaut</span>
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button type="button" onClick={handleSave} disabled={saving}
          className="bg-grad-primary text-white font-display font-semibold px-5 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm transition-opacity flex items-center gap-1.5">
          {saving && <Loader2 size={12} className="animate-spin" />}
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-body text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 transition-colors">
          Annuler
        </button>
      </div>
    </div>
  )
}

// ── Asset Generator Panel ──────────────────────────────────────────────────────

function AssetGenerator({ kit, onGenerated }: { kit: BrandKit; onGenerated: (asset: BrandAsset) => void }) {
  const [tab,      setTab]      = useState<'logo' | 'social'>('logo')
  const [prompt,   setPrompt]   = useState('')
  const [platform, setPlatform] = useState<SocialPlatform>('instagram_post')
  const [loading,  setLoading]  = useState(false)

  async function handleGenerate() {
    if (!prompt.trim()) { toast.error('Décris ce que tu veux générer.'); return }
    setLoading(true)
    try {
      const { data } = await generateBrandAsset({
        brand_kit_id: kit.id,
        type:     tab === 'logo' ? 'logo' : 'social_post',
        prompt:   prompt.trim(),
        platform: tab === 'social' ? platform : undefined,
      })
      toast.success('Asset généré !')
      onGenerated(data)
      setPrompt('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de génération.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass glass-heavy rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-1 p-1 glass rounded-xl w-fit">
        <button type="button" onClick={() => setTab('logo')}
          className={cn('px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
            tab === 'logo' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70'
          )}>
          Logo
        </button>
        <button type="button" onClick={() => setTab('social')}
          className={cn('px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
            tab === 'social' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70'
          )}>
          Post réseaux
        </button>
      </div>

      {tab === 'social' && (
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPlatform(p.id)}
              className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-body transition-all border',
                platform === p.id
                  ? 'bg-clyro-primary/10 border-clyro-primary/30 text-clyro-primary'
                  : 'glass glass-hover border-transparent text-gray-500 dark:text-white/40'
              )}>
              <span>{p.emoji}</span> {p.label}
              <span className="font-mono text-[11px] text-gray-400 dark:text-white/25">{p.ratio}</span>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={tab === 'logo'
            ? 'ex: abstract geometric logo, tech startup, minimalist…'
            : 'ex: promotion soldes -50%, fond coloré, typography bold…'
          }
          rows={3}
          className="w-full glass rounded-xl px-3 py-2.5 text-gray-700 dark:text-white/80 font-body text-sm placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none resize-none transition-all"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-white/30 font-mono">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: kit.primary_color }} />
            {kit.secondary_color && <span className="w-3 h-3 rounded-full inline-block -ml-1" style={{ background: kit.secondary_color }} />}
            {kit.name}
          </div>
          <button type="button" onClick={handleGenerate} disabled={loading || !prompt.trim()}
            className="flex items-center gap-1.5 bg-grad-primary text-white font-display font-semibold px-4 py-2 rounded-xl text-xs hover:opacity-90 disabled:opacity-50 transition-opacity">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            {loading ? 'Génération…' : 'Générer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Asset Gallery ──────────────────────────────────────────────────────────────

function AssetGallery({ assets, onDelete }: { assets: BrandAsset[]; onDelete: (id: string) => void }) {
  if (assets.length === 0) {
    return (
      <div className="glass rounded-2xl py-12 text-center">
        <Wand2 size={28} className="mx-auto mb-3 text-gray-300 dark:text-white/15" />
        <p className="font-body text-sm text-gray-400 dark:text-white/30">Génère ton premier asset pour le voir ici.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {assets.map((asset) => (
        <div key={asset.id} className="group relative glass rounded-xl overflow-hidden">
          <img src={asset.image_url} alt={asset.prompt} className="w-full aspect-square object-cover" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
            <a href={asset.image_url} download={`${asset.type}-${asset.id}.png`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-body hover:bg-white/30 transition-colors">
              <Download size={11} /> Télécharger
            </a>
            <button type="button" onClick={() => onDelete(asset.id)}
              className="flex items-center gap-1.5 bg-red-500/30 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-body hover:bg-red-500/50 transition-colors">
              <Trash2 size={11} /> Supprimer
            </button>
          </div>
          <div className="p-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-gray-400 dark:text-white/30">
              {asset.platform ?? asset.type}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Kit Panel (right side) ─────────────────────────────────────────────────────

function KitPanel({ kit, onUpdate, onDelete }: {
  kit: BrandKit
  onUpdate: (kit: BrandKit) => void
  onDelete: (id: string) => void
}) {
  const [editing,  setEditing]  = useState(false)
  const [assets,   setAssets]   = useState<BrandAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(true)

  useState(() => {
    getBrandAssets(kit.id)
      .then(({ data }) => setAssets(data))
      .catch(() => {})
      .finally(() => setLoadingAssets(false))
  })

  function handleGenerated(asset: BrandAsset) {
    setAssets((prev) => [asset, ...prev])
  }

  async function handleDeleteAsset(id: string) {
    try {
      await deleteBrandAsset(id)
      setAssets((prev) => prev.filter((a) => a.id !== id))
    } catch {
      toast.error('Impossible de supprimer.')
    }
  }

  async function handleDeleteKit() {
    try {
      await deleteBrandKit(kit.id)
      onDelete(kit.id)
    } catch {
      toast.error('Impossible de supprimer le brand kit.')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 gap-6">
      {/* Kit header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {kit.logo_url ? (
            <img src={kit.logo_url} alt={kit.name} className="w-12 h-12 rounded-xl object-contain glass" />
          ) : (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: kit.primary_color }}>
              <Palette size={20} className="text-white" />
            </div>
          )}
          <div>
            <h2 className="font-display font-bold text-gray-900 dark:text-white text-lg">{kit.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-4 h-4 rounded-full border border-white/10 shadow-sm" style={{ background: kit.primary_color }} />
              {kit.secondary_color && <span className="w-4 h-4 rounded-full border border-white/10 shadow-sm" style={{ background: kit.secondary_color }} />}
              {kit.font_family && <span className="font-mono text-[11px] text-gray-400 dark:text-white/30">{kit.font_family}</span>}
              {kit.is_default && <span className="font-mono text-[11px] text-clyro-primary uppercase tracking-wider">★ Défaut</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => setEditing((v) => !v)}
            className="w-8 h-8 rounded-lg glass glass-hover flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/70 transition-colors font-mono text-sm">
            ✎
          </button>
          <button type="button" onClick={handleDeleteKit}
            className="w-8 h-8 rounded-lg glass glass-hover flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="glass glass-heavy rounded-2xl p-5">
          <BrandKitForm
            initial={kit}
            onSave={(updated) => { onUpdate(updated); setEditing(false) }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      {/* Generator */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/30 mb-3">Générateur IA</p>
        <AssetGenerator kit={kit} onGenerated={handleGenerated} />
      </div>

      {/* Gallery */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/30 mb-3">
          Assets générés · {assets.length}
        </p>
        {loadingAssets ? (
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map((i) => <div key={i} className="aspect-square glass rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <AssetGallery assets={assets} onDelete={handleDeleteAsset} />
        )}
      </div>
    </div>
  )
}

// ── Main Hub ───────────────────────────────────────────────────────────────────

type SidebarTab = 'kits' | 'studio'

export function BrandHub({ initialKits }: { initialKits: BrandKit[] }) {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('kits')
  const [kits,       setKits]       = useState<BrandKit[]>(initialKits)
  const [activeId,   setActiveId]   = useState<string | null>(initialKits[0]?.id ?? null)
  const [showCreate, setShowCreate] = useState(false)

  const activeKit = kits.find((k) => k.id === activeId) ?? null

  function handleSaved(kit: BrandKit) {
    setKits((prev) => {
      const base = kit.is_default ? prev.map((k) => ({ ...k, is_default: false })) : prev
      const exists = base.find((k) => k.id === kit.id)
      return exists ? base.map((k) => (k.id === kit.id ? kit : k)) : [kit, ...base]
    })
    setActiveId(kit.id)
    setShowCreate(false)
  }

  function handleDeleted(id: string) {
    const remaining = kits.filter((k) => k.id !== id)
    setKits(remaining)
    setActiveId(remaining[0]?.id ?? null)
  }

  async function handleSetDefault(id: string) {
    try {
      const { data } = await updateBrandKit({ id, is_default: true })
      setKits((prev) => prev.map((k) => ({ ...k, is_default: k.id === data.id })))
    } catch {
      toast.error('Impossible de définir par défaut.')
    }
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">

      {/* Sidebar */}
      <aside className="glass glass-border-r w-52 m-3 mr-0 rounded-2xl flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 glass-border-b">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-0.5">Module</p>
          <h1 className="font-display text-sm font-bold text-foreground">Brand Kit</h1>
        </div>

        {/* Tab switcher */}
        <div className="p-2 glass-border-b">
          <div className="flex gap-1 p-1 rounded-xl bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10">
            <button
              type="button"
              onClick={() => { setSidebarTab('kits'); setShowCreate(false) }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-mono transition-all',
                sidebarTab === 'kits'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-[--text-muted] hover:text-foreground'
              )}
            >
              <Palette size={11} /> Kits
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('studio')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-mono transition-all',
                sidebarTab === 'studio'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-[--text-muted] hover:text-foreground'
              )}
            >
              <Sparkles size={11} /> Studio
            </button>
          </div>
        </div>

        {sidebarTab === 'kits' && (
          <>
            <div className="p-3 glass-border-b">
              <button type="button" onClick={() => { setActiveId(null); setShowCreate(true) }}
                className="flex items-center gap-2 w-full bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-body text-foreground hover:bg-cyan-500/10 hover:border-cyan-500/40 transition-all">
                <Plus size={15} className="text-clyro-accent" />
                Nouveau brand kit
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {kits.length === 0 && !showCreate && (
                <div className="px-3 py-8 text-center">
                  <Palette size={24} className="mx-auto mb-2 text-[--text-muted]" />
                  <p className="font-body text-xs text-[--text-muted]">Crée ton premier brand kit</p>
                </div>
              )}
              {kits.map((kit) => (
                <button key={kit.id} type="button" onClick={() => { setActiveId(kit.id); setShowCreate(false) }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl transition-all group',
                    activeId === kit.id ? 'bg-cyan-500/15 border border-cyan-500/30' : 'hover:bg-white/40 dark:hover:bg-white/5'
                  )}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-md shrink-0" style={{ background: kit.primary_color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-medium text-foreground truncate">{kit.name}</p>
                      {kit.is_default && (
                        <p className="font-mono text-[11px] text-clyro-primary uppercase tracking-wider">★ Défaut</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {sidebarTab === 'studio' && (
          <div className="flex-1 p-3 flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/30 mt-1 px-1">Identity Studio</p>
            <p className="font-body text-xs text-gray-400 dark:text-white/30 px-1 leading-relaxed">
              Brief → 3 directions → Visuels IA → Charte graphique → Export
            </p>
            <div className="mt-2 space-y-1 text-xs font-mono text-gray-400 dark:text-white/30 px-1">
              {['1 · Brief de marque', '2 · Directions créatives', '3 · Visuels fal.ai', '4 · Charte graphique', '5 · Export brand kit'].map((s) => (
                <p key={s}>{s}</p>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Panel principal */}
      <div className="flex-1 overflow-hidden">

        {/* Brand Identity Studio */}
        {sidebarTab === 'studio' && <BrandStudio />}

        {/* Brand Kit manager */}
        {sidebarTab === 'kits' && (
          <>
            {showCreate && (
              <div className="flex flex-col h-full overflow-y-auto px-8 py-8">
                <div className="max-w-lg">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/30 mb-4">Nouveau brand kit</p>
                  <div className="glass glass-heavy rounded-2xl p-6">
                    <BrandKitForm
                      onSave={handleSaved}
                      onCancel={() => { setShowCreate(false); setActiveId(kits[0]?.id ?? null) }}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeKit && !showCreate && (
              <KitPanel
                key={activeKit.id}
                kit={activeKit}
                onUpdate={handleSaved}
                onDelete={handleDeleted}
              />
            )}

            {!activeKit && !showCreate && (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8 py-12 max-w-lg mx-auto">
                {/* Decorative icon cluster */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/20 via-blue-500/15 to-purple-500/20 blur-2xl" />
                  <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-purple-500/15 border border-border flex items-center justify-center shadow-lg">
                    <Palette size={40} className="text-clyro-accent" />
                  </div>
                  {/* Tiny decorative chips */}
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-blue-500 shadow-lg" />
                  <div className="absolute -bottom-2 -left-2 w-6 h-6 rounded-lg bg-purple-500 shadow-lg" />
                </div>

                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Crée ton Brand Kit
                  </h2>
                  <p className="font-body text-sm text-[--text-secondary] max-w-sm">
                    Définis ta charte graphique (couleurs, typos, logo) et génère en un clic des posts, bannières, logos et assets visuels cohérents avec ton identité.
                  </p>
                </div>

                {/* Feature hints */}
                <div className="grid grid-cols-3 gap-2 w-full max-w-md">
                  <div className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-left">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[--text-muted] mb-0.5">Logos</p>
                    <p className="font-body text-xs text-foreground">SVG exportables</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-left">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[--text-muted] mb-0.5">Posts</p>
                    <p className="font-body text-xs text-foreground">IG · LinkedIn · X</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-left">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[--text-muted] mb-0.5">Charte</p>
                    <p className="font-body text-xs text-foreground">PDF + ZIP</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 justify-center">
                  <button type="button" onClick={() => setShowCreate(true)}
                    className="bg-grad-primary text-white font-display font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md hover:shadow-lg">
                    <Plus size={15} /> Créer mon premier kit
                  </button>
                  <button type="button" onClick={() => setSidebarTab('studio')}
                    className="glass glass-hover text-foreground font-display font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
                    <Sparkles size={15} /> Identity Studio
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
