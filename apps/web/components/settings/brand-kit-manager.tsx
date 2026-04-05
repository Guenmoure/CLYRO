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
import type { BrandKit } from '@clyro/shared'

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
      if (logoFile) {
        logoUrl = await uploadBrandLogo(logoFile, user.id)
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

      toast.success(initial?.id ? 'Brand kit mis à jour.' : 'Brand kit créé.')
      onSave(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.')
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
    <div className="glass glass-heavy rounded-2xl p-6 space-y-5">
      <h3 className="font-display font-semibold text-gray-900 dark:text-white">
        {initial?.id ? 'Modifier le brand kit' : 'Nouveau brand kit'}
      </h3>

      {/* Name */}
      <div>
        <label className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/40 mb-2 block">Nom</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: CLYRO Official"
          maxLength={80}
          className="w-full glass rounded-xl px-4 py-3 text-gray-700 dark:text-white/80 font-body text-sm placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-clyro-primary/50 transition-all"
        />
      </div>

      {/* Colors */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-36">
          <label className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/40 mb-2 block">
            Couleur principale
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent"
            />
            <span className="font-mono text-sm text-gray-600 dark:text-white/60">{primaryColor.toUpperCase()}</span>
          </div>
        </div>
        <div className="flex-1 min-w-36">
          <label className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/40 mb-2 block">
            Couleur secondaire <span className="normal-case">(optionnel)</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={secondaryColor || '#ffffff'}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent"
            />
            <span className="font-mono text-sm text-gray-600 dark:text-white/60">
              {secondaryColor ? secondaryColor.toUpperCase() : '—'}
            </span>
            {secondaryColor && (
              <button type="button" onClick={() => setSecondaryColor('')} className="text-xs text-gray-400 dark:text-white/30 hover:text-red-400 transition-colors">
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Font family */}
      <div>
        <label className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/40 mb-2 block">
          Police <span className="normal-case">(optionnel)</span>
        </label>
        <input
          type="text"
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          placeholder="ex: Montserrat, Playfair Display"
          className="w-full glass rounded-xl px-4 py-3 text-gray-700 dark:text-white/80 font-body text-sm placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-clyro-primary/50 transition-all"
        />
      </div>

      {/* Logo */}
      <div>
        <label className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/40 mb-2 block">
          Logo <span className="normal-case">(optionnel)</span>
        </label>
        <div className="flex items-center gap-4">
          {logoPreview && (
            <img src={logoPreview} alt="Logo preview" className="w-12 h-12 object-contain rounded-lg glass" />
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 glass glass-hover rounded-xl px-4 py-2.5 text-sm font-body text-gray-600 dark:text-white/60 transition-all"
          >
            <Upload size={14} />
            {logoPreview ? 'Changer' : 'Importer un logo'}
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
          className="w-4 h-4 rounded accent-clyro-primary"
        />
        <span className="font-body text-sm text-gray-600 dark:text-white/60">Utiliser par défaut</span>
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
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-body text-sm text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition-colors"
        >
          Annuler
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
}: {
  kit: BrandKit
  onEdit: (kit: BrandKit) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
}) {
  return (
    <div className={cn(
      'glass glass-heavy rounded-2xl p-5 transition-all',
      kit.is_default && 'ring-2 ring-clyro-primary/30'
    )}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {kit.logo_url ? (
            <img src={kit.logo_url} alt={kit.name} className="w-10 h-10 rounded-lg object-contain glass" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: kit.primary_color }}>
              <Palette size={16} className="text-white" />
            </div>
          )}
          <div>
            <p className="font-display font-semibold text-gray-900 dark:text-white text-sm">{kit.name}</p>
            {kit.is_default && (
              <span className="font-mono text-[9px] uppercase tracking-wider text-clyro-primary">Par défaut</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!kit.is_default && (
            <button
              type="button"
              title="Définir par défaut"
              onClick={() => onSetDefault(kit.id)}
              className="w-7 h-7 rounded-lg glass glass-hover flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-yellow-500 transition-colors"
            >
              <Star size={13} />
            </button>
          )}
          <button
            type="button"
            title="Modifier"
            onClick={() => onEdit(kit)}
            className="w-7 h-7 rounded-lg glass glass-hover flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/70 transition-colors font-mono text-xs"
          >
            ✎
          </button>
          <button
            type="button"
            title="Supprimer"
            onClick={() => onDelete(kit.id)}
            className="w-7 h-7 rounded-lg glass glass-hover flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-red-400 transition-colors"
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
          title={`Primaire: ${kit.primary_color}`}
        />
        {kit.secondary_color && (
          <div
            className="w-6 h-6 rounded-lg border border-white/10 shadow-sm"
            style={{ background: kit.secondary_color }}
            title={`Secondaire: ${kit.secondary_color}`}
          />
        )}
        {kit.font_family && (
          <span className="font-mono text-[11px] text-gray-400 dark:text-white/30 ml-1">{kit.font_family}</span>
        )}
      </div>
    </div>
  )
}

// ── Main Manager ───────────────────────────────────────────────────────────────

export function BrandKitManager() {
  const [kits,       setKits]       = useState<BrandKit[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [editingKit, setEditingKit] = useState<BrandKit | null>(null)

  useEffect(() => {
    getBrandKits()
      .then(({ data }) => setKits(data))
      .catch(() => toast.error('Impossible de charger les brand kits.'))
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
      toast.success('Brand kit supprimé.')
    } catch {
      toast.error('Impossible de supprimer.')
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const { data } = await updateBrandKit({ id, is_default: true })
      setKits((prev) =>
        prev.map((k) => ({ ...k, is_default: k.id === data.id }))
      )
    } catch {
      toast.error('Impossible de définir par défaut.')
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 glass rounded-2xl animate-pulse" />
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
        />
      ))}

      {/* Edit form */}
      {editingKit && (
        <BrandKitForm
          initial={editingKit}
          onSave={handleSaved}
          onCancel={() => setEditingKit(null)}
        />
      )}

      {/* Create form */}
      {showForm && !editingKit && (
        <BrandKitForm
          onSave={handleSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Add button */}
      {!showForm && !editingKit && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 glass glass-hover rounded-2xl py-4 text-sm font-body text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 border-2 border-dashed border-gray-200 dark:border-white/[0.06] transition-all"
        >
          <Plus size={15} />
          Nouveau brand kit
        </button>
      )}
    </div>
  )
}
