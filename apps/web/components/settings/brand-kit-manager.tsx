'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Star, Loader2, Upload, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getBrandKits,
  createBrandKit,
  updateBrandKit,
  deleteBrandKit,
  uploadBrandLogo,
} from '@/lib/api'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/i18n'
import type { BrandKit } from '@clyro/shared'

// ── Brand Kit Form ─────────────────────────────────────────────────────────────

function BrandKitForm({
  initial,
  onSave,
  onCancel,
  t,
}: {
  initial?: Partial<BrandKit>
  onSave: (kit: BrandKit) => void
  onCancel: () => void
  t: (key: string) => string
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
    if (!name.trim()) { toast.error(t('bkm_nameRequired')); return }
    setSaving(true)
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let logoUrl = initial?.logo_url ?? undefined
      if (logoFile) {
        const rawLogoUrl = await uploadBrandLogo(logoFile, user.id)
        // Remove background automatically (fal-ai/birefnet) — fallback to raw if it fails
        try {
          const rembgRes = await fetch('/api/rembg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: rawLogoUrl }),
          })
          if (rembgRes.ok) {
            const { url } = await rembgRes.json() as { url?: string }
            logoUrl = url ?? rawLogoUrl
          } else {
            logoUrl = rawLogoUrl
          }
        } catch {
          logoUrl = rawLogoUrl
        }
      }

      const payload = {
        name:            name.trim(),
        primary_color:   primaryColor,
        secondary_color: secondaryColor || undefined,
        font_family:     fontFamily || undefined,
        logo_url:        logoUrl,
        is_default:      isDefault,
      }

      let result: BrandKit
      if (initial?.id) {
        const { data } = await updateBrandKit({ id: initial.id, ...payload })
        result = data
      } else {
        const { data } = await createBrandKit(payload)
        result = data
      }

      toast.success(initial?.id ? t('bkm_updated') : t('bkm_created'))
      onSave(result)
    } catch {
      toast.error(t('bkm_saveError'))
    } finally {
      setSaving(false)
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
      <h3 className="font-display font-semibold text-foreground">
        {initial?.id ? t('bkm_editKit') : t('bkm_newKit')}
      </h3>

      {/* Name */}
      <div>
        <label htmlFor="bkm-name" className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2 block">{t('bkm_name')}</label>
        <input
          id="bkm-name"
          name="brand_name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('bkm_namePlaceholder')}
          maxLength={80}
          className="w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none focus:border-primary transition-all"
        />
      </div>

      {/* Colors */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-36">
          <label htmlFor="bkm-primary" className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2 block">
            {t('bkm_primaryColor')}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="bkm-primary"
              name="primary_color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent"
            />
            <span className="font-mono text-sm text-[--text-secondary]">{primaryColor.toUpperCase()}</span>
          </div>
        </div>
        <div className="flex-1 min-w-36">
          <label htmlFor="bkm-secondary" className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2 block">
            {t('bkm_secondaryColor')} <span className="normal-case">({t('bkm_optional')})</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              id="bkm-secondary"
              name="secondary_color"
              type="color"
              value={secondaryColor || '#ffffff'}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent"
            />
            <span className="font-mono text-sm text-[--text-secondary]">
              {secondaryColor ? secondaryColor.toUpperCase() : '—'}
            </span>
            {secondaryColor && (
              <button type="button" onClick={() => setSecondaryColor('')} className="text-xs text-[--text-muted] hover:text-error transition-colors">
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Font family */}
      <div>
        <label className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2 block">
          {t('bkm_font')} <span className="normal-case">({t('bkm_optional')})</span>
        </label>
        <input
          type="text"
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          placeholder={t('bkm_fontPlaceholder')}
          className="w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none focus:border-primary transition-all"
        />
      </div>

      {/* Logo */}
      <div>
        <label className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2 block">
          {t('bkm_logo')} <span className="normal-case">({t('bkm_optional')})</span>
        </label>
        <div className="flex items-center gap-4">
          {logoPreview && (
            <img src={logoPreview} alt={t('bkm_logoPreview')} className="w-12 h-12 object-contain rounded-lg border border-border bg-muted" />
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 bg-muted hover:bg-muted/80 border border-border rounded-xl px-4 py-2.5 text-sm font-body text-[--text-secondary] transition-all"
          >
            <Upload size={14} />
            {logoPreview ? t('bkm_changeLogo') : t('bkm_uploadLogo')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>
      </div>

      {/* Default */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="w-4 h-4 rounded accent-brand"
        />
        <span className="font-body text-sm text-[--text-secondary]">{t('bkm_useDefault')}</span>
      </label>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-grad-primary text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm transition-opacity flex items-center gap-2"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          {saving ? t('bkm_saving') : t('save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-body text-sm text-[--text-muted] hover:text-foreground transition-colors"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}

// ── Brand Kit Card ─────────────────────────────────────────────────────────────

function BrandKitCard({
  kit,
  onEdit,
  onDelete,
  onSetDefault,
  t,
}: {
  kit: BrandKit
  onEdit: (kit: BrandKit) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
  t: (key: string) => string
}) {
  return (
    <div className={cn(
      'bg-card border border-border rounded-2xl p-5 transition-all',
      kit.is_default && 'ring-2 ring-brand/30'
    )}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {kit.logo_url ? (
            <img src={kit.logo_url} alt={kit.name} className="w-10 h-10 rounded-lg object-contain border border-border bg-muted" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: kit.primary_color }}>
              <Palette size={16} className="text-white" />
            </div>
          )}
          <div>
            <p className="font-display font-semibold text-foreground text-sm">{kit.name}</p>
            {kit.is_default && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-primary">{t('bkm_default')}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!kit.is_default && (
            <button
              type="button"
              title={t('bkm_setDefault')}
              onClick={() => onSetDefault(kit.id)}
              className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 border border-border flex items-center justify-center text-[--text-muted] hover:text-warning transition-colors"
            >
              <Star size={13} />
            </button>
          )}
          <button
            type="button"
            title={t('bkm_edit')}
            onClick={() => onEdit(kit)}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 border border-border flex items-center justify-center text-[--text-muted] hover:text-foreground transition-colors font-mono text-xs"
          >
            ✎
          </button>
          <button
            type="button"
            title={t('bkm_delete')}
            onClick={() => onDelete(kit.id)}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 border border-border flex items-center justify-center text-[--text-muted] hover:text-error transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Color swatches */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg border border-white/10 shadow-sm"
          style={{ background: kit.primary_color }}
          title={`${t('bkm_primaryColor')}: ${kit.primary_color}`}
        />
        {kit.secondary_color && (
          <div
            className="w-6 h-6 rounded-lg border border-white/10 shadow-sm"
            style={{ background: kit.secondary_color }}
            title={`${t('bkm_secondaryColor')}: ${kit.secondary_color}`}
          />
        )}
        {kit.font_family && (
          <span className="font-mono text-[11px] text-[--text-muted] ml-1">{kit.font_family}</span>
        )}
      </div>
    </div>
  )
}

// ── Main Manager ───────────────────────────────────────────────────────────────

export function BrandKitManager() {
  const { t } = useLanguage()
  const [kits,       setKits]       = useState<BrandKit[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [editingKit, setEditingKit] = useState<BrandKit | null>(null)

  useEffect(() => {
    getBrandKits()
      .then(({ data }) => setKits(data))
      .catch(() => toast.error(t('bkm_loadError')))
      .finally(() => setLoading(false))
  }, [])

  function handleSaved(kit: BrandKit) {
    setKits((prev) => {
      const exists = prev.find((k) => k.id === kit.id)
      const base = kit.is_default ? prev.map((k) => ({ ...k, is_default: false })) : prev
      return exists
        ? base.map((k) => (k.id === kit.id ? kit : k))
        : [kit, ...base]
    })
    setShowForm(false)
    setEditingKit(null)
  }

  async function handleDelete(id: string) {
    try {
      await deleteBrandKit(id)
      setKits((prev) => prev.filter((k) => k.id !== id))
      toast.success(t('bkm_deleted'))
    } catch {
      toast.error(t('bkm_deleteError'))
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const { data } = await updateBrandKit({ id, is_default: true })
      setKits((prev) =>
        prev.map((k) => ({ ...k, is_default: k.id === data.id }))
      )
    } catch {
      toast.error(t('bkm_defaultError'))
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-border bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Existing kits */}
      {kits.map((kit) => (
        <BrandKitCard
          key={kit.id}
          kit={kit}
          onEdit={(k) => { setEditingKit(k); setShowForm(false) }}
          onDelete={handleDelete}
          onSetDefault={handleSetDefault}
          t={t}
        />
      ))}

      {/* Edit form */}
      {editingKit && (
        <BrandKitForm
          initial={editingKit}
          onSave={handleSaved}
          onCancel={() => setEditingKit(null)}
          t={t}
        />
      )}

      {/* Create form */}
      {showForm && !editingKit && (
        <BrandKitForm
          onSave={handleSaved}
          onCancel={() => setShowForm(false)}
          t={t}
        />
      )}

      {/* Add button */}
      {!showForm && !editingKit && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 border border-border rounded-2xl py-4 text-sm font-body text-[--text-muted] hover:text-foreground border-2 border-dashed border-border transition-all"
        >
          <Plus size={15} />
          {t('bkm_newKit')}
        </button>
      )}
    </div>
  )
}
