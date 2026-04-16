'use client'

import { useEffect, useState } from 'react'
import { Camera, Loader2, Users } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { toast } from '@/components/ui/toast'

export function GeneralSection() {
  const supabase = createBrowserClient()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [userId, setUserId]   = useState('')

  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceDesc, setWorkspaceDesc] = useState('')
  const [initials, setInitials] = useState('?')

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        setUserId(session.user.id)

        // Workspace prefs saved in localStorage (no dedicated table yet)
        const savedName = localStorage.getItem('clyro_workspace_name') ?? ''
        const savedDesc = localStorage.getItem('clyro_workspace_desc') ?? ''

        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .maybeSingle()

        const defaultName = data?.full_name ?? session.user.email?.split('@')[0] ?? 'My workspace'
        const name = savedName || defaultName
        setWorkspaceName(name)
        setWorkspaceDesc(savedDesc)
        setInitials(name.charAt(0).toUpperCase())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  async function handleSave() {
    if (saving || !userId) return
    setSaving(true)
    try {
      localStorage.setItem('clyro_workspace_name', workspaceName.trim())
      localStorage.setItem('clyro_workspace_desc', workspaceDesc.trim())
      setInitials(workspaceName.charAt(0).toUpperCase() || '?')
      toast.success('Workspace updated')
    } catch {
      toast.error('Save error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-20 flex items-center justify-center"><Loader2 className="animate-spin text-[--text-muted]" /></div>
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">{t('generalSettings')}</h2>
        <p className="font-body text-sm text-[--text-secondary] mt-1">
          Your workspace identity. Used in emails and shared pages.
        </p>
      </div>

      {/* Avatar */}
      <div className="space-y-2">
        <p className="font-body text-sm font-semibold text-foreground">Workspace logo</p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-grad-primary flex items-center justify-center shrink-0 shadow-sm">
            <span className="font-mono text-xl font-bold text-white">{initials}</span>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              disabled
              title="Coming soon"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-body font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Camera size={13} /> Upload logo
            </button>
            <p className="font-body text-xs text-[--text-muted]">PNG, JPG or SVG · max 4 MB · Coming soon.</p>
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label htmlFor="workspace-name" className="font-body text-sm font-semibold text-foreground">
          Workspace name
        </label>
        <input
          id="workspace-name"
          type="text"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="Ex. My Studio, Acme, etc."
          maxLength={60}
        />
        <p className="font-body text-xs text-[--text-muted]">
          {workspaceName.length}/60 characters.
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="workspace-desc" className="font-body text-sm font-semibold text-foreground">
          Description
        </label>
        <textarea
          id="workspace-desc"
          value={workspaceDesc}
          onChange={(e) => setWorkspaceDesc(e.target.value)}
          rows={3}
          maxLength={200}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-colors resize-none"
          placeholder="A few words to describe your team or project."
        />
        <p className="font-body text-xs text-[--text-muted]">
          {workspaceDesc.length}/200 characters.
        </p>
      </div>

      {/* Save */}
      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 dark:bg-foreground dark:text-gray-950 text-white px-5 py-2.5 text-sm font-display font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
        >
          {saving ? <><Loader2 size={13} className="animate-spin" /> {t('saving')}</> : t('save')}
        </button>
      </div>

      {/* Team (stub) */}
      <section className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-4 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
          <Users size={18} className="text-[--text-muted]" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-body text-sm font-semibold text-foreground">Invite teammates</p>
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted border border-border text-[--text-muted]">
              Coming soon
            </span>
          </div>
          <p className="font-body text-xs text-[--text-secondary]">
            Collaborate on brand kits and videos, share templates and cloned voices.
          </p>
        </div>
      </section>
    </div>
  )
}
