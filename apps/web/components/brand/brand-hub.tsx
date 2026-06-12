'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Plus, Palette, Trash2, Loader2, Upload, Wand2, Download, X, Sparkles,
  Package, Megaphone, Camera, Play, MessageCircle, Image as ImageIcon,
  Send, CheckCircle, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import {
  createBrandKit, updateBrandKit, deleteBrandKit, uploadBrandLogo,
  generateBrandAsset, getBrandAssets, deleteBrandAsset,
  getCatalogItems, addCatalogItem, updateCatalogItem, deleteCatalogItem,
  generateCampaignIdeas, generateCampaignAssets,
  generatePhotoshoot, animateAsset, chatWithBrandAgent, editBackground,
} from '@/lib/api'
import type {
  BrandAsset, SocialPlatform, CatalogItem, CampaignConcept, CampaignAsset,
  PhotoshootTemplate, MotionType, BrandAgentMessage, BrandSuggestions,
} from '@/lib/api'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'
import { AlertCircle } from 'lucide-react'
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

const CAMPAIGN_PLATFORMS = ['instagram', 'tiktok', 'linkedin', 'twitter', 'youtube', 'facebook'] as const

const PHOTOSHOOT_TEMPLATES: Array<{ id: PhotoshootTemplate; label: string; desc: string }> = [
  { id: 'studio',     label: 'Studio',     desc: 'Clean white/gray backdrop, pro lighting' },
  { id: 'floating',   label: 'Floating',   desc: 'Zero-gravity product, dramatic shadow' },
  { id: 'ingredient', label: 'Ingredient', desc: 'Flat-lay with components/ingredients' },
  { id: 'in_use',     label: 'In Use',     desc: 'Lifestyle context, natural environment' },
]

const MOTION_TYPES: Array<{ id: MotionType; label: string }> = [
  { id: 'zoom_in',   label: 'Zoom In' },
  { id: 'pan_left',  label: 'Pan Left' },
  { id: 'pan_right', label: 'Pan Right' },
  { id: 'zoom_out',  label: 'Zoom Out' },
  { id: 'orbit',     label: 'Orbit 360°' },
  { id: 'pulse',     label: 'Pulse' },
]

// ── Brand Kit Form ───────���─────────────────────────────────────────────────────

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
  const { t } = useLanguage()

  async function handleSave() {
    if (!name.trim()) { toast.error(t('bh_nameRequired')); return }
    setSaving(true)
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

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

      toast.success(initial?.id ? t('bh_kitUpdated') : t('bh_kitCreated'))
      onSave(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bh_errorSaving'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-display font-semibold text-foreground text-sm">
        {initial?.id ? t('bh_formEdit') : t('bh_formNew')}
      </h3>

      <input
        id="brand-hub-name" name="brand_name"
        type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder={t('bh_namePlaceholder')}
        className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none transition-all"
      />

      <div className="flex gap-4">
        <div className="flex-1">
          <label htmlFor="brand-hub-primary" className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-1.5 block">{t('bh_primaryColorLabel')}</label>
          <div className="flex items-center gap-2">
            <input id="brand-hub-primary" name="primary_color" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent" />
            <span className="font-mono text-xs text-[--text-muted]">{primaryColor.toUpperCase()}</span>
          </div>
        </div>
        <div className="flex-1">
          <label htmlFor="brand-hub-secondary" className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-1.5 block">{t('bh_secondaryLabel')}</label>
          <div className="flex items-center gap-2">
            <input id="brand-hub-secondary" name="secondary_color" type="color" value={secondaryColor || '#ffffff'} onChange={(e) => setSecondaryColor(e.target.value)}
              className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent" />
            {secondaryColor
              ? <button type="button" onClick={() => setSecondaryColor('')} title="Remove secondary color" className="text-xs text-[--text-muted] hover:text-red-400"><X size={11} /></button>
              : <span className="font-mono text-xs text-[--text-muted]">—</span>
            }
          </div>
        </div>
      </div>

      <input
        id="brand-hub-font" name="font_family"
        type="text" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
        placeholder={t('bh_fontPlaceholder')}
        className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none transition-all"
      />

      <div className="flex items-center gap-3">
        {logoPreview && <img src={logoPreview} alt="Logo" className="w-10 h-10 object-contain rounded-lg bg-card border border-border" />}
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 bg-muted hover:bg-muted/80 border border-border rounded-xl px-3 py-2 text-xs font-body text-[--text-secondary] transition-all">
          <Upload size={12} /> {logoPreview ? t('bh_changeLogo') : t('bh_importLogo')}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" title="Upload logo"
          className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)) } }} />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-3.5 h-3.5 rounded accent-brand" />
        <span className="font-body text-xs text-[--text-muted]">{t('bh_useByDefault')}</span>
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button type="button" onClick={handleSave} disabled={saving}
          className="bg-grad-primary text-white font-display font-semibold px-5 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm transition-opacity flex items-center gap-1.5">
          {saving && <Loader2 size={12} className="animate-spin" />}
          {saving ? t('bh_saving') : t('bh_save')}
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-body text-[--text-muted] hover:text-foreground transition-colors">
          {t('bh_cancel')}
        </button>
      </div>
    </div>
  )
}

// ── Asset Generator Panel ───────���──────────────────────────────────────────────

function AssetGenerator({ kit, onGenerated }: { kit: BrandKit; onGenerated: (asset: BrandAsset) => void }) {
  const [tab,      setTab]      = useState<'logo' | 'social'>('logo')
  const [prompt,   setPrompt]   = useState('')
  const [platform, setPlatform] = useState<SocialPlatform>('instagram_post')
  const [loading,  setLoading]  = useState(false)
  const { t } = useLanguage()

  async function handleGenerate() {
    if (!prompt.trim()) { toast.error(t('bh_describeWhat')); return }
    setLoading(true)
    try {
      const { data } = await generateBrandAsset({
        brand_kit_id: kit.id,
        type:     tab === 'logo' ? 'logo' : 'social_post',
        prompt:   prompt.trim(),
        platform: tab === 'social' ? platform : undefined,
      })
      toast.success(t('bh_assetGenerated'))
      onGenerated(data)
      setPrompt('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bh_generationError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-card border border-border shadow-sm rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-1 p-1 bg-muted rounded-xl w-fit">
        <button type="button" onClick={() => setTab('logo')}
          className={cn('px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
            tab === 'logo' ? 'bg-card text-foreground shadow-sm' : 'text-[--text-muted] hover:text-foreground'
          )}>
          {t('bh_logoTab')}
        </button>
        <button type="button" onClick={() => setTab('social')}
          className={cn('px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
            tab === 'social' ? 'bg-card text-foreground shadow-sm' : 'text-[--text-muted] hover:text-foreground'
          )}>
          {t('bh_socialTab')}
        </button>
      </div>

      {tab === 'social' && (
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPlatform(p.id)}
              className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-body transition-all border',
                platform === p.id
                  ? 'bg-accent border-brand/30 text-accent-foreground'
                  : 'bg-muted hover:bg-muted/80 border border-border text-[--text-secondary]'
              )}>
              <span>{p.emoji}</span> {p.label}
              <span className="font-mono text-[11px] text-[--text-muted]">{p.ratio}</span>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={tab === 'logo' ? t('bh_logoPromptPlaceholder') : t('bh_socialPromptPlaceholder')}
          rows={3}
          className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none resize-none transition-all"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[--text-muted] font-mono">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: kit.primary_color }} />
            {kit.secondary_color && <span className="w-3 h-3 rounded-full inline-block -ml-1" style={{ background: kit.secondary_color }} />}
            {kit.name}
          </div>
          <button type="button" onClick={handleGenerate} disabled={loading || !prompt.trim()}
            className="flex items-center gap-1.5 bg-grad-primary text-white font-display font-semibold px-4 py-2 rounded-xl text-xs hover:opacity-90 disabled:opacity-50 transition-opacity">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            {loading ? t('bh_generating') : t('bh_generate')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Asset Gallery ──────────────────────────────────────────────────────────────

function AssetGallery({ assets, onDelete }: { assets: BrandAsset[]; onDelete: (id: string) => void }) {
  const { t } = useLanguage()

  if (assets.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl py-12 text-center">
        <Wand2 size={28} className="mx-auto mb-3 text-[--text-muted]" />
        <p className="font-body text-sm text-[--text-muted]">{t('bh_noAssetsYet')}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {assets.map((asset) => (
        <div key={asset.id} className="group relative bg-card border border-border rounded-xl overflow-hidden">
          <img src={asset.image_url} alt={asset.prompt} className="w-full aspect-square object-cover" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
            <a href={asset.image_url} download={`${asset.type}-${asset.id}.png`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-body hover:bg-white/30 transition-colors">
              <Download size={11} /> {t('bh_download')}
            </a>
            <button type="button" onClick={() => onDelete(asset.id)}
              className="flex items-center gap-1.5 bg-red-500/30 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-body hover:bg-red-500/50 transition-colors">
              <Trash2 size={11} /> {t('bh_delete')}
            </button>
          </div>
          <div className="p-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[--text-muted]">
              {asset.platform ?? asset.type}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Kit Panel (right side) ─────────���───────────────────────────────────────────

function KitPanel({ kit, onUpdate, onDelete }: {
  kit: BrandKit
  onUpdate: (kit: BrandKit) => void
  onDelete: (id: string) => void
}) {
  const [editing,  setEditing]  = useState(false)
  const [assets,   setAssets]   = useState<BrandAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(true)
  const [assetsError,   setAssetsError]   = useState(false)
  const { t } = useLanguage()

  const loadAssets = useCallback(() => {
    setLoadingAssets(true)
    setAssetsError(false)
    getBrandAssets(kit.id)
      .then(({ data }) => setAssets(data))
      .catch((err) => {
        console.error('[brand-hub] failed to load brand assets:', err)
        setAssetsError(true)
      })
      .finally(() => setLoadingAssets(false))
  }, [kit.id])

  useEffect(() => { loadAssets() }, [loadAssets])

  function handleGenerated(asset: BrandAsset) {
    setAssets((prev) => [asset, ...prev])
  }

  async function handleDeleteAsset(id: string) {
    try {
      await deleteBrandAsset(id)
      setAssets((prev) => prev.filter((a) => a.id !== id))
    } catch {
      toast.error(t('bh_unableDeleteAsset'))
    }
  }

  async function handleDeleteKit() {
    try {
      await deleteBrandKit(kit.id)
      onDelete(kit.id)
    } catch {
      toast.error(t('bh_unableDeleteKit'))
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 gap-6">
      {/* Kit header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {kit.logo_url ? (
            <img src={kit.logo_url} alt={kit.name} className="w-12 h-12 rounded-xl object-contain bg-card border border-border" />
          ) : (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: kit.primary_color }}>
              <Palette size={20} className="text-white" />
            </div>
          )}
          <div>
            <h2 className="font-display font-bold text-foreground text-lg">{kit.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-4 h-4 rounded-full border border-border shadow-sm" style={{ background: kit.primary_color }} />
              {kit.secondary_color && <span className="w-4 h-4 rounded-full border border-border shadow-sm" style={{ background: kit.secondary_color }} />}
              {kit.font_family && <span className="font-mono text-[11px] text-[--text-muted]">{kit.font_family}</span>}
              {kit.is_default && <span className="font-mono text-[11px] text-brand uppercase tracking-wider">{t('bh_defaultStarLabel')}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => setEditing((v) => !v)}
            className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 border border-border flex items-center justify-center text-[--text-muted] hover:text-foreground transition-colors font-mono text-sm">
            ✎
          </button>
          <button type="button" onClick={handleDeleteKit} title="Delete kit"
            className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 border border-border flex items-center justify-center text-[--text-muted] hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="bg-card border border-border shadow-sm rounded-2xl p-5">
          <BrandKitForm
            initial={kit}
            onSave={(updated) => { onUpdate(updated); setEditing(false) }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      {/* Generator */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-3">{t('bh_aiGenerator')}</p>
        <AssetGenerator kit={kit} onGenerated={handleGenerated} />
      </div>

      {/* Gallery */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-3">
          {t('bh_generatedAssets').replace('{count}', String(assets.length))}
        </p>
        {loadingAssets ? (
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map((i) => <div key={i} className="aspect-square bg-card border border-border rounded-xl animate-pulse" />)}
          </div>
        ) : assetsError ? (
          <div className="bg-card border border-border rounded-2xl py-10 px-6 text-center">
            <AlertCircle size={24} className="mx-auto mb-3 text-amber-500" />
            <p className="font-body text-sm text-foreground">{t('err_loadTitle')}</p>
            <p className="font-body text-xs text-[--text-muted] mt-1">{t('err_loadDesc')}</p>
            <button
              type="button"
              onClick={loadAssets}
              className="mt-4 inline-flex items-center gap-1.5 bg-muted hover:bg-muted/80 border border-border rounded-xl px-4 py-2 text-xs font-body text-foreground transition-colors"
            >
              {t('retry')}
            </button>
          </div>
        ) : (
          <AssetGallery assets={assets} onDelete={handleDeleteAsset} />
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════════
// ── PRODUCT CATALOG PANEL ─────────────────────────────────────────────────────
// ═��════════════════════════════════════════════════════════════════════════════════

function CatalogPanel({ kit }: { kit: BrandKit }) {
  const { t } = useLanguage()
  const [items, setItems]       = useState<CatalogItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showAdd, setShowAdd]   = useState(false)
  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [category, setCategory] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving]     = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadItems = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    getCatalogItems(kit.id)
      .then(({ data }) => setItems(data))
      .catch((err) => {
        console.error('[brand-hub] failed to load catalog items:', err)
        setLoadError(true)
      })
      .finally(() => setLoading(false))
  }, [kit.id])

  useEffect(() => { loadItems() }, [loadItems])

  async function handleAdd() {
    if (!name.trim() || !imageFile) { toast.error(t('bh_nameImageRequired')); return }
    setSaving(true)
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const imageUrl = await uploadBrandLogo(imageFile, user.id)
      const { data } = await addCatalogItem({
        brand_kit_id: kit.id,
        name: name.trim(),
        description: desc.trim() || undefined,
        image_url: imageUrl,
        category: category.trim() || undefined,
      })
      setItems((prev) => [data, ...prev])
      setShowAdd(false)
      setName(''); setDesc(''); setCategory(''); setImageFile(null); setImagePreview('')
      toast.success(t('bh_productAdded'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bk_cat_addFailed'))
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCatalogItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch { toast.error(t('bk_deleteFailed')) }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-foreground text-lg">{t('bh_catalogTitle')}</h2>
          <p className="font-body text-sm text-[--text-secondary]">{t('bh_catalogSub')}</p>
        </div>
        <button type="button" onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-grad-primary text-white font-display font-semibold px-4 py-2 rounded-xl text-sm hover:opacity-90 transition-opacity">
          <Plus size={14} /> {t('bh_addProduct')}
        </button>
      </div>

      {showAdd && (
        <div className="bg-card border border-border shadow-sm rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-foreground text-sm">{t('bh_newProduct')}</h3>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder={t('bh_productNamePh')} className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder={t('bh_productDescPh')} rows={2}
            className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none resize-none" />
          <input type="text" value={category} onChange={(e) => setCategory(e.target.value)}
            placeholder={t('bh_productCatPh')} className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none" />
          <div className="flex items-center gap-3">
            {imagePreview && <img src={imagePreview} alt="Preview" className="w-14 h-14 object-cover rounded-xl bg-card border border-border" />}
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 bg-muted hover:bg-muted/80 border border-border rounded-xl px-3 py-2 text-xs font-body text-[--text-secondary]">
              <Upload size={12} /> {imagePreview ? t('bh_changePhoto') : t('bh_uploadPhoto')}
            </button>
            <input ref={fileRef} type="file" accept="image/*" title="Upload image" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)) } }} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={handleAdd} disabled={saving || !name.trim() || !imageFile}
              className="bg-grad-primary text-white font-display font-semibold px-5 py-2 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
              {saving && <Loader2 size={12} className="animate-spin" />} {t('save')}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="text-xs text-[--text-muted] hover:text-foreground">{t('cancel')}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1,2,3].map((i) => <div key={i} className="aspect-square bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      ) : loadError ? (
        <div className="bg-card border border-border rounded-2xl py-16 text-center">
          <AlertCircle size={28} className="mx-auto mb-3 text-amber-500" />
          <p className="font-body text-sm text-foreground">{t('err_loadTitle')}</p>
          <p className="font-body text-xs text-[--text-muted] mt-1">{t('err_loadDesc')}</p>
          <button
            type="button"
            onClick={loadItems}
            className="mt-4 inline-flex items-center gap-1.5 bg-muted hover:bg-muted/80 border border-border rounded-xl px-4 py-2 text-xs font-body text-foreground transition-colors"
          >
            {t('retry')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-16 text-center">
          <Package size={32} className="mx-auto mb-3 text-[--text-muted]" />
          <p className="font-body text-sm text-[--text-muted]">{t('bh_catalogEmpty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.id} className="group relative bg-card border border-border rounded-xl overflow-hidden">
              <img src={item.image_url} alt={item.name} className="w-full aspect-square object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button type="button" onClick={() => handleDelete(item.id)}
                  className="flex items-center gap-1.5 bg-red-500/30 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs hover:bg-red-500/50">
                  <Trash2 size={11} /> {t('bh_remove')}
                </button>
              </div>
              <div className="p-3">
                <p className="font-body text-sm font-medium text-foreground truncate">{item.name}</p>
                {item.category && <p className="font-mono text-[11px] text-[--text-muted] uppercase tracking-wider">{item.category}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════════
// ── CAMPAIGN GENERATOR PANEL ─────────────────────────────────────────────────
// ═════════════════════════���════════════════════════════════════════════════════════

function CampaignPanel({ kit }: { kit: BrandKit }) {
  const { t } = useLanguage()
  const [goal, setGoal]           = useState('')
  const [platforms, setPlatforms] = useState<string[]>(['instagram', 'tiktok'])
  const [loading, setLoading]     = useState(false)
  const [concepts, setConcepts]   = useState<CampaignConcept[]>([])
  const [generating, setGenerating] = useState(false)
  const [assets, setAssets]       = useState<CampaignAsset[]>([])

  function togglePlatform(p: string) {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  async function handleIdeate() {
    if (!goal.trim() || platforms.length === 0) { toast.error(t('bh_goalPlatformsRequired')); return }
    setLoading(true)
    setConcepts([])
    setAssets([])
    try {
      const { campaigns } = await generateCampaignIdeas({
        brand_kit_id: kit.id,
        goal: goal.trim(),
        platforms,
      })
      setConcepts(campaigns)
      toast.success(t('bh_ideasGenerated').replace('{count}', String(campaigns.length)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bh_ideasFailed'))
    } finally { setLoading(false) }
  }

  async function handleGenerateAssets(campaign: CampaignConcept) {
    setGenerating(true)
    try {
      const { assets: generated } = await generateCampaignAssets({
        brand_kit_id: kit.id,
        campaign: { name: campaign.name, posts: campaign.suggested_posts },
      })
      setAssets(generated)
      toast.success(t('bh_assetsGenerated').replace('{count}', String(generated.length)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bh_assetsFailed'))
    } finally { setGenerating(false) }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 gap-6">
      <div>
        <h2 className="font-display font-bold text-foreground text-lg">{t('bh_campaignTitle')}</h2>
        <p className="font-body text-sm text-[--text-secondary]">{t('bh_campaignSub')}</p>
      </div>

      {/* Campaign brief */}
      <div className="bg-card border border-border shadow-sm rounded-2xl p-5 space-y-4">
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)}
          placeholder={t('bh_goalPh')}
          rows={3} className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none resize-none" />

        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2">{t('bh_platforms')}</p>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_PLATFORMS.map((p) => (
              <button key={p} type="button" onClick={() => togglePlatform(p)}
                className={cn('px-3 py-1.5 rounded-xl text-xs font-body border transition-all capitalize',
                  platforms.includes(p) ? 'bg-accent border-brand/30 text-accent-foreground' : 'bg-muted border-border text-[--text-secondary]'
                )}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={handleIdeate} disabled={loading || !goal.trim()}
          className="flex items-center gap-2 bg-grad-primary text-white font-display font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? t('bh_generatingIdeas') : t('bh_generateIdeas')}
        </button>
      </div>

      {/* Campaign concepts */}
      {concepts.length > 0 && (
        <div className="space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">{t('bh_concepts')}</p>
          {concepts.map((c, i) => (
            <div key={i} className="bg-card border border-border shadow-sm rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-bold text-foreground">{c.name}</h3>
                  <p className="font-body text-sm text-brand italic">{c.tagline}</p>
                </div>
                <button type="button" onClick={() => handleGenerateAssets(c)} disabled={generating}
                  className="flex items-center gap-1.5 bg-grad-primary text-white px-3 py-1.5 rounded-xl text-xs font-display font-semibold hover:opacity-90 disabled:opacity-50 shrink-0">
                  {generating ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                  {t('bh_generateAssets')}
                </button>
              </div>
              <p className="font-body text-sm text-[--text-secondary]">{c.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {c.platforms.map((p) => (
                  <span key={p} className="px-2 py-0.5 rounded-lg bg-muted text-[11px] font-mono text-[--text-muted] capitalize">{p}</span>
                ))}
              </div>
              {c.suggested_posts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  {c.suggested_posts.map((post, j) => (
                    <div key={j} className="flex gap-3 text-xs">
                      <span className="font-mono uppercase text-[--text-muted] shrink-0 w-16">{post.platform}</span>
                      <span className="font-body text-[--text-secondary]">{post.copy}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Generated assets */}
      {assets.length > 0 && (
        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">{t('bh_generatedAssetsLabel')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {assets.map((a, i) => (
              <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                <img src={a.image_url} alt={a.copy} className="w-full aspect-square object-cover" />
                <div className="p-2.5">
                  <p className="font-mono text-[11px] uppercase text-brand">{a.platform}</p>
                  <p className="font-body text-xs text-[--text-secondary] line-clamp-2 mt-0.5">{a.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══��════════════════════════════���══════════════════════════════════════════════════
// ── PHOTOSHOOT PANEL ─────────────────────────────────────────────────────────
// ══════��══════════════════════════════���════════════════════════════════════════════

function PhotoshootPanel({ kit }: { kit: BrandKit }) {
  const { t } = useLanguage()
  const [imageUrl, setImageUrl]     = useState('')
  const [imageFile, setImageFile]   = useState<File | null>(null)
  const [preview, setPreview]       = useState('')
  const [template, setTemplate]     = useState<PhotoshootTemplate>('studio')
  const [customPrompt, setCustomPrompt] = useState('')
  const [loading, setLoading]       = useState(false)
  const [results, setResults]       = useState<Array<{ url: string; template: string }>>([])
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleGenerate() {
    if (!imageUrl && !imageFile) { toast.error(t('bh_imageOrUrlRequired')); return }
    setLoading(true)
    try {
      let sourceUrl = imageUrl
      if (imageFile && !imageUrl) {
        const supabase = createBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        sourceUrl = await uploadBrandLogo(imageFile, user.id)
        setImageUrl(sourceUrl)
      }
      const { data } = await generatePhotoshoot({
        brand_kit_id: kit.id,
        source_image_url: sourceUrl,
        template,
        custom_prompt: customPrompt.trim() || undefined,
      })
      setResults((prev) => [{ url: data.image_url, template: data.template }, ...prev])
      toast.success(t('bh_photoshootDone'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bh_photoshootFailed'))
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 gap-6">
      <div>
        <h2 className="font-display font-bold text-foreground text-lg">{t('bh_photoshootTitle')}</h2>
        <p className="font-body text-sm text-[--text-secondary]">{t('bh_photoshootSub')}</p>
      </div>

      <div className="bg-card border border-border shadow-sm rounded-2xl p-5 space-y-4">
        {/* Image upload */}
        <div className="flex items-center gap-4">
          {preview && <img src={preview} alt="Source" className="w-20 h-20 object-cover rounded-xl bg-card border border-border" />}
          <div className="flex-1 space-y-2">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 bg-muted hover:bg-muted/80 border border-border rounded-xl px-4 py-2.5 text-sm font-body text-[--text-secondary] w-full">
              <Upload size={14} /> {preview ? t('bh_changeProductPhoto') : t('bh_uploadProductPhoto')}
            </button>
            <input ref={fileRef} type="file" accept="image/*" title="Upload image" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) { setImageFile(f); setPreview(URL.createObjectURL(f)); setImageUrl('') }
              }} />
          </div>
        </div>

        {/* Template selector */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2">{t('bh_templateLabel')}</p>
          <div className="grid grid-cols-2 gap-2">
            {PHOTOSHOOT_TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => setTemplate(t.id)}
                className={cn('p-3 rounded-xl text-left transition-all border',
                  template === t.id ? 'bg-accent border-brand/30' : 'bg-card border-border hover:border-[--text-muted]'
                )}>
                <p className="font-display text-sm font-semibold text-foreground">{t.label}</p>
                <p className="font-body text-xs text-[--text-secondary] mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Custom prompt */}
        <input type="text" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder={t('bh_customDirectionPh')}
          className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none" />

        <button type="button" onClick={handleGenerate} disabled={loading || (!imageFile && !imageUrl)}
          className="flex items-center gap-2 bg-grad-primary text-white font-display font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 w-full justify-center">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          {loading ? t('bh_generatingShort') : t('bh_generatePhotoshoot')}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">{t('bh_results')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {results.map((r, i) => (
              <div key={i} className="group relative bg-card border border-border rounded-xl overflow-hidden">
                <img src={r.url} alt={r.template} className="w-full aspect-square object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <a href={r.url} download={`photoshoot-${r.template}.png`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs hover:bg-white/30">
                    <Download size={11} /> {t('bh_download')}
                  </a>
                </div>
                <div className="p-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[--text-muted]">{r.template}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════════
// ── ANIMATE PANEL ─────────────────────────────────────────────────────────────
// ══════════════════════���═══════════════════════════════════════════════════════════

function AnimatePanel({ kit }: { kit: BrandKit }) {
  const { t } = useLanguage()
  const [imageUrl, setImageUrl]     = useState('')
  const [imageFile, setImageFile]   = useState<File | null>(null)
  const [preview, setPreview]       = useState('')
  const [motion, setMotion]         = useState<MotionType>('zoom_in')
  const [duration, setDuration]     = useState<'3' | '5'>('5')
  const [loading, setLoading]       = useState(false)
  const [results, setResults]       = useState<Array<{ url: string; type: string }>>([])
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleAnimate() {
    if (!imageUrl && !imageFile) { toast.error(t('bh_uploadFirst')); return }
    setLoading(true)
    try {
      let sourceUrl = imageUrl
      if (imageFile && !imageUrl) {
        const supabase = createBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        sourceUrl = await uploadBrandLogo(imageFile, user.id)
        setImageUrl(sourceUrl)
      }
      const { data } = await animateAsset({
        brand_kit_id: kit.id,
        source_image_url: sourceUrl,
        motion_type: motion,
        duration,
      })
      setResults((prev) => [{ url: data.video_url, type: data.motion_type }, ...prev])
      toast.success(t('bh_animationDone'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bk_sh_animationFailed'))
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 gap-6">
      <div>
        <h2 className="font-display font-bold text-foreground text-lg">{t('bh_animateTitle')}</h2>
        <p className="font-body text-sm text-[--text-secondary]">{t('bh_animateSub')}</p>
      </div>

      <div className="bg-card border border-border shadow-sm rounded-2xl p-5 space-y-4">
        {/* Image upload */}
        <div className="flex items-center gap-4">
          {preview && <img src={preview} alt="Source" className="w-20 h-20 object-cover rounded-xl bg-card border border-border" />}
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 bg-muted hover:bg-muted/80 border border-border rounded-xl px-4 py-2.5 text-sm font-body text-[--text-secondary]">
            <Upload size={14} /> {preview ? t('bh_changeImage') : t('bh_uploadImage')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" title={t('bh_uploadImage')} className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) { setImageFile(f); setPreview(URL.createObjectURL(f)); setImageUrl('') }
            }} />
        </div>

        {/* Motion type */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2">{t('bh_motionType')}</p>
          <div className="grid grid-cols-3 gap-2">
            {MOTION_TYPES.map((m) => (
              <button key={m.id} type="button" onClick={() => setMotion(m.id)}
                className={cn('px-3 py-2 rounded-xl text-xs font-body text-center transition-all border',
                  motion === m.id ? 'bg-accent border-brand/30 text-accent-foreground' : 'bg-card border-border text-[--text-secondary]'
                )}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2">{t('bh_durationLabel')}</p>
          <div className="flex gap-2">
            {(['3', '5'] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDuration(d)}
                className={cn('px-4 py-2 rounded-xl text-sm font-body border transition-all',
                  duration === d ? 'bg-accent border-brand/30 text-accent-foreground' : 'bg-card border-border text-[--text-secondary]'
                )}>
                {d}s
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={handleAnimate} disabled={loading || (!imageFile && !imageUrl)}
          className="flex items-center gap-2 bg-grad-primary text-white font-display font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 w-full justify-center">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {loading ? t('bh_animating') : t('bk_animate')}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">{t('bh_animations')}</p>
          <div className="grid grid-cols-2 gap-3">
            {results.map((r, i) => (
              <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                <video src={r.url} controls className="w-full aspect-video" />
                <div className="p-2 flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase text-[--text-muted]">{r.type}</span>
                  <a href={r.url} download={`animate-${r.type}.mp4`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-brand hover:underline flex items-center gap-1">
                    <Download size={10} /> {t('bh_download')}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ���════════════════════════════════════���════════════════════════════════════════════
// ── BRAND AGENT CHAT PANEL ───────────────────────────────────────────────────
// ════════��════════════════���════════════════════════════════════════════════════════

function BrandAgentPanel({ kit }: { kit: BrandKit | null }) {
  const { t } = useLanguage()
  const [messages, setMessages] = useState<BrandAgentMessage[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [suggestions, setSuggestions] = useState<BrandSuggestions | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim()) return
    const newMsg: BrandAgentMessage = { role: 'user', content: input.trim() }
    const updatedMessages = [...messages, newMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)
    try {
      const { reply, suggestions: sug } = await chatWithBrandAgent({
        brand_kit_id: kit?.id,
        messages: updatedMessages,
        context: kit ? {
          name: kit.name,
          existing_colors: { primary: kit.primary_color, secondary: kit.secondary_color ?? undefined },
        } : undefined,
      })
      setMessages([...updatedMessages, { role: 'assistant', content: reply }])
      if (sug) setSuggestions(sug)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bh_agentError'))
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-display font-bold text-foreground text-lg">{t('bh_agentTitle')}</h2>
        <p className="font-body text-sm text-[--text-secondary]">{t('bh_agentSub')}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle size={32} className="mx-auto mb-3 text-[--text-muted]" />
            <p className="font-body text-sm text-[--text-muted]">
              {t('bh_agentIntro')}
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {[t('bh_agentQ1'), t('bh_agentQ2'), t('bh_agentQ3'), t('bh_agentQ4')].map((q) => (
                <button key={q} type="button" onClick={() => setInput(q)}
                  className="px-3 py-1.5 rounded-xl text-xs font-body bg-muted border border-border text-[--text-secondary] hover:bg-accent hover:border-brand/30 transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[80%] rounded-2xl px-4 py-3',
              msg.role === 'user' ? 'bg-primary text-white' : 'bg-card border border-border shadow-sm text-foreground'
            )}>
              <p className="font-body text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border shadow-sm rounded-2xl px-4 py-3">
              <Loader2 size={16} className="animate-spin text-[--text-muted]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions banner */}
      {suggestions && (
        <div className="px-6 py-3 border-t border-border bg-brand/5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={12} className="text-brand" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-brand">{t('bh_agentSuggestions')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.primary_color && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted text-xs font-mono">
                <span className="w-3 h-3 rounded-full" style={{ background: suggestions.primary_color }} />
                {suggestions.primary_color}
              </span>
            )}
            {suggestions.secondary_color && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted text-xs font-mono">
                <span className="w-3 h-3 rounded-full" style={{ background: suggestions.secondary_color }} />
                {suggestions.secondary_color}
              </span>
            )}
            {suggestions.font_heading && <span className="px-2 py-1 rounded-lg bg-muted text-xs font-mono">{suggestions.font_heading}</span>}
            {suggestions.tagline && <span className="px-2 py-1 rounded-lg bg-muted text-xs font-body italic">&ldquo;{suggestions.tagline}&rdquo;</span>}
            {suggestions.tone && <span className="px-2 py-1 rounded-lg bg-muted text-xs font-mono capitalize">{suggestions.tone}</span>}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-border">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={t('bh_agentInputPh')}
            className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none" />
          <button type="button" onClick={handleSend} disabled={loading || !input.trim()} title={t('bh_sendMessage')} aria-label={t('bh_sendMessage')}
            className="bg-grad-primary text-white rounded-xl px-4 py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════��═══════════════════════════��═════════════════════════════════════════
// ── BACKGROUND EDITOR PANEL ──────────────────────────────────────────────────
// ════��═════════════════════════════════════════════════════════════════════════════

function BackgroundPanel({ kit }: { kit: BrandKit }) {
  const { t } = useLanguage()
  const [imageUrl, setImageUrl]       = useState('')
  const [imageFile, setImageFile]     = useState<File | null>(null)
  const [preview, setPreview]         = useState('')
  const [bgPrompt, setBgPrompt]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [result, setResult]           = useState<{ foreground_url: string; background_url: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleEdit() {
    if (!bgPrompt.trim()) { toast.error(t('bh_describeBg')); return }
    if (!imageUrl && !imageFile) { toast.error(t('bh_uploadFirst')); return }
    setLoading(true)
    try {
      let sourceUrl = imageUrl
      if (imageFile && !imageUrl) {
        const supabase = createBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        sourceUrl = await uploadBrandLogo(imageFile, user.id)
        setImageUrl(sourceUrl)
      }
      const res = await editBackground({
        source_image_url: sourceUrl,
        background_prompt: bgPrompt.trim(),
        brand_kit_id: kit.id,
      })
      setResult(res)
      toast.success(t('bh_bgReplaced'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bh_bgFailed'))
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 gap-6">
      <div>
        <h2 className="font-display font-bold text-foreground text-lg">{t('bh_bgTitle')}</h2>
        <p className="font-body text-sm text-[--text-secondary]">{t('bh_bgSub')}</p>
      </div>

      <div className="bg-card border border-border shadow-sm rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          {preview && <img src={preview} alt="Source" className="w-20 h-20 object-cover rounded-xl bg-card border border-border" />}
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 bg-muted hover:bg-muted/80 border border-border rounded-xl px-4 py-2.5 text-sm font-body text-[--text-secondary]">
            <Upload size={14} /> {preview ? t('bh_changeImage') : t('bh_uploadImage')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" title="Upload image" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) { setImageFile(f); setPreview(URL.createObjectURL(f)); setImageUrl('') }
            }} />
        </div>

        <textarea value={bgPrompt} onChange={(e) => setBgPrompt(e.target.value)}
          placeholder={t('bh_bgPromptPh')}
          rows={3} className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none resize-none" />

        <div className="flex flex-wrap gap-2">
          {['White studio', 'Tropical beach', 'Marble surface', 'Dark neon studio', 'Forest', 'Office desk'].map((s) => (
            <button key={s} type="button" onClick={() => setBgPrompt(s)}
              className="px-2.5 py-1 rounded-lg text-xs font-body bg-muted border border-border text-[--text-secondary] hover:bg-accent hover:border-brand/30 transition-all">
              {s}
            </button>
          ))}
        </div>

        <button type="button" onClick={handleEdit} disabled={loading || !bgPrompt.trim() || (!imageFile && !imageUrl)}
          className="flex items-center gap-2 bg-grad-primary text-white font-display font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 w-full justify-center">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
          {loading ? t('bh_processing') : t('bh_replaceBg')}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">{t('bh_resultLabel')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <img src={result.foreground_url} alt="Foreground (transparent)" className="w-full aspect-square object-contain bg-[url('/checkerboard.svg')]" />
              <div className="p-2">
                <span className="font-mono text-[11px] text-[--text-muted]">{t('bh_fgLabel')}</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <img src={result.background_url} alt="New background" className="w-full aspect-square object-cover" />
              <div className="p-2">
                <span className="font-mono text-[11px] text-[--text-muted]">{t('bh_newBgLabel')}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <a href={result.foreground_url} download="foreground.png" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-muted border border-border rounded-xl px-3 py-2 text-xs font-body text-[--text-secondary] hover:bg-muted/80">
              <Download size={11} /> {t('bh_fgLabel')}
            </a>
            <a href={result.background_url} download="background.png" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-muted border border-border rounded-xl px-3 py-2 text-xs font-body text-[--text-secondary] hover:bg-muted/80">
              <Download size={11} /> {t('bh_dlBackground')}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════��════════════════════════════════════════════════════════════════════════
// ── MAIN HUB ──────────────────────────────────────────────────────────────────
// ═══════════════════��══════════════════════════════════════════════════════════════

type SidebarTab = 'kits' | 'studio' | 'catalog' | 'campaigns' | 'photoshoot' | 'animate' | 'agent' | 'background'

const SIDEBAR_TABS: Array<{ id: SidebarTab; labelKey: string; icon: typeof Palette }> = [
  { id: 'kits',       labelKey: 'bh_tabKits',       icon: Palette },
  { id: 'studio',     labelKey: 'bh_tabStudio',     icon: Sparkles },
  { id: 'catalog',    labelKey: 'bh_tabCatalog',    icon: Package },
  { id: 'campaigns',  labelKey: 'bh_tabCampaigns',  icon: Megaphone },
  { id: 'photoshoot', labelKey: 'bh_tabPhotoshoot', icon: Camera },
  { id: 'animate',    labelKey: 'bh_tabAnimate',    icon: Play },
  { id: 'background', labelKey: 'bh_tabBackground', icon: ImageIcon },
  { id: 'agent',      labelKey: 'bh_tabAgent',      icon: MessageCircle },
]

export function BrandHub({ initialKits }: { initialKits: BrandKit[] }) {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('kits')
  const [kits,       setKits]       = useState<BrandKit[]>(initialKits)
  const [activeId,   setActiveId]   = useState<string | null>(initialKits[0]?.id ?? null)
  const [showCreate, setShowCreate] = useState(false)
  const { t } = useLanguage()

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
      toast.error(t('bh_unableSetDefault'))
    }
  }

  // Features that need an active kit
  const needsKit = ['catalog', 'campaigns', 'photoshoot', 'animate', 'background'].includes(sidebarTab)

  return (
    <div className="flex flex-1 h-full overflow-hidden">

      {/* Sidebar */}
      <aside className="bg-card border-r border-border w-52 m-3 mr-0 rounded-2xl flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-border">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-0.5">{t('bh_moduleLabel')}</p>
          <h1 className="font-display text-sm font-bold text-foreground">{t('bh_moduleTitle')}</h1>
        </div>

        {/* Navigation tabs */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {SIDEBAR_TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setSidebarTab(tab.id); if (tab.id === 'kits') setShowCreate(false) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-body transition-all',
                  sidebarTab === tab.id
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-[--text-secondary] hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon size={13} /> {t(tab.labelKey)}
              </button>
            )
          })}
        </div>

        {/* Active kit selector (shown when feature needs a kit) */}
        {needsKit && kits.length > 0 && (
          <div className="p-3 border-t border-border">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-1.5">{t('bh_activeKit')}</p>
            <select
              value={activeId ?? ''}
              onChange={(e) => setActiveId(e.target.value)}
              title={t('bh_selectActiveKit')}
              aria-label={t('bh_selectActiveKit')}
              className="w-full bg-card border border-border rounded-xl px-2.5 py-2 text-xs font-body text-foreground focus:outline-none"
            >
              {kits.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>
        )}
      </aside>

      {/* Panel principal */}
      <div className="flex-1 overflow-hidden">

        {/* Brand Identity Studio */}
        {sidebarTab === 'studio' && <BrandStudio />}

        {/* Brand Agent (works without a kit too) */}
        {sidebarTab === 'agent' && <BrandAgentPanel kit={activeKit} />}

        {/* Brand Kit manager */}
        {sidebarTab === 'kits' && (
          <>
            {showCreate && (
              <div className="flex flex-col h-full overflow-y-auto px-8 py-8">
                <div className="max-w-lg">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-4">{t('bh_newBrandKitHeader')}</p>
                  <div className="bg-card border border-border shadow-sm rounded-2xl p-6">
                    <BrandKitForm
                      onSave={handleSaved}
                      onCancel={() => { setShowCreate(false); setActiveId(kits[0]?.id ?? null) }}
                    />
                  </div>
                </div>
              </div>
            )}

            {!showCreate && activeKit && (
              <KitPanel
                key={activeKit.id}
                kit={activeKit}
                onUpdate={handleSaved}
                onDelete={handleDeleted}
              />
            )}

            {!activeKit && !showCreate && (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8 py-12 max-w-lg mx-auto">
                <div className="relative">
                  <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-2xl" />
                  <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-teal-500/15 to-teal-500/10 border border-border flex items-center justify-center shadow-lg">
                    <Palette size={40} className="text-feature-brand" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-brand shadow-lg" />
                  <div className="absolute -bottom-2 -left-2 w-6 h-6 rounded-lg bg-purple-500 shadow-lg" />
                </div>

                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-bold text-foreground">{t('bh_emptyTitle')}</h2>
                  <p className="font-body text-sm text-[--text-secondary] max-w-sm">{t('bh_emptyDesc')}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 w-full max-w-md">
                  <div className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-left">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[--text-muted] mb-0.5">{t('bh_logosLabel')}</p>
                    <p className="font-body text-xs text-foreground">{t('bh_logosDesc')}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-left">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[--text-muted] mb-0.5">{t('bh_postsLabel')}</p>
                    <p className="font-body text-xs text-foreground">{t('bh_postsDesc')}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-left">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[--text-muted] mb-0.5">{t('bh_guidelinesLabel')}</p>
                    <p className="font-body text-xs text-foreground">{t('bh_guidelinesDesc')}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 justify-center">
                  <button type="button" onClick={() => setShowCreate(true)}
                    className="bg-grad-primary text-white font-display font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md hover:shadow-lg">
                    <Plus size={15} /> {t('bh_createFirstKit')}
                  </button>
                  <button type="button" onClick={() => setSidebarTab('agent')}
                    className="bg-muted hover:bg-muted/80 border border-border text-foreground font-display font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
                    <MessageCircle size={15} /> {t('bh_tabAgent')}
                  </button>
                </div>
              </div>
            )}

            {/* Kit list at bottom of kits view */}
            {!showCreate && kits.length > 0 && (
              <div className="fixed bottom-4 left-[calc(13rem+2rem)] z-10">
                <div className="flex gap-1 p-1 bg-card rounded-xl border border-border shadow-lg">
                  {kits.slice(0, 5).map((kit) => (
                    <button key={kit.id} type="button" onClick={() => setActiveId(kit.id)}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-body transition-all',
                        activeId === kit.id ? 'bg-accent text-accent-foreground' : 'text-[--text-secondary] hover:bg-muted'
                      )}>
                      <span className="w-2.5 h-2.5 rounded-full inline-block mr-1.5" style={{ background: kit.primary_color }} />
                      {kit.name}
                    </button>
                  ))}
                  <button type="button" onClick={() => setShowCreate(true)} title={t('bh_newKitTitle')} aria-label={t('bh_newKitTitle')}
                    className="px-2 py-1.5 rounded-lg text-[--text-muted] hover:text-foreground transition-colors">
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Features that require an active kit */}
        {needsKit && !activeKit && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Palette size={32} className="text-[--text-muted]" />
            <p className="font-body text-sm text-[--text-muted]">{t('bh_needKit')}</p>
            <button type="button" onClick={() => setSidebarTab('kits')}
              className="flex items-center gap-2 bg-grad-primary text-white font-display font-semibold px-4 py-2 rounded-xl text-sm hover:opacity-90">
              <ArrowRight size={14} /> {t('bh_goToKits')}
            </button>
          </div>
        )}

        {sidebarTab === 'catalog' && activeKit && <CatalogPanel kit={activeKit} />}
        {sidebarTab === 'campaigns' && activeKit && <CampaignPanel kit={activeKit} />}
        {sidebarTab === 'photoshoot' && activeKit && <PhotoshootPanel kit={activeKit} />}
        {sidebarTab === 'animate' && activeKit && <AnimatePanel kit={activeKit} />}
        {sidebarTab === 'background' && activeKit && <BackgroundPanel kit={activeKit} />}
      </div>
    </div>
  )
}
