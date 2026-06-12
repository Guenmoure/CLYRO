'use client'

import { Facebook, Instagram, Linkedin, Twitter, Youtube, Music2, Pin, type LucideIcon } from 'lucide-react'
import type { SocialLinks } from '@clyro/shared'

interface SocialLinksEditorProps {
  value: SocialLinks
  onChange: (next: SocialLinks) => void
}

type SocialKey = keyof SocialLinks

const SOCIAL_NETWORKS: { key: SocialKey; label: string; placeholder: string; Icon: LucideIcon }[] = [
  { key: 'facebook',  label: 'Facebook',  placeholder: 'https://facebook.com/your-brand',  Icon: Facebook  },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/your-brand', Icon: Instagram },
  { key: 'linkedin',  label: 'LinkedIn',  placeholder: 'https://linkedin.com/company/...', Icon: Linkedin  },
  { key: 'twitter',   label: 'X / Twitter', placeholder: 'https://x.com/your-brand',       Icon: Twitter   },
  { key: 'youtube',   label: 'YouTube',   placeholder: 'https://youtube.com/@your-brand',  Icon: Youtube   },
  // TikTok n'est pas dans lucide-react — on réutilise Music2 (note de musique)
  { key: 'tiktok',    label: 'TikTok',    placeholder: 'https://tiktok.com/@your-brand',   Icon: Music2    },
  { key: 'pinterest', label: 'Pinterest', placeholder: 'https://pinterest.com/your-brand', Icon: Pin       },
]

/**
 * Liste fixe des 7 réseaux Pomelli. Chaque ligne = icône + label + input URL.
 * Une URL vide supprime la clé du JSON (ne stocke pas de chaîne vide).
 */
export function SocialLinksEditor({ value, onChange }: SocialLinksEditorProps) {
  function update(key: SocialKey, url: string) {
    const trimmed = url.trim()
    if (!trimmed) {
      // Supprime la clé pour garder le JSON propre
      const next = { ...value }
      delete next[key]
      onChange(next)
    } else {
      onChange({ ...value, [key]: trimmed })
    }
  }

  return (
    <div className="space-y-2">
      {SOCIAL_NETWORKS.map(({ key, label, placeholder, Icon }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-xl border border-border bg-muted px-3 py-2 focus-within:border-brand/60 transition-colors"
        >
          <Icon size={18} className="text-[--text-muted] shrink-0" aria-hidden="true" />
          <span className="font-mono text-xs text-[--text-muted] w-24 shrink-0">{label}</span>
          <input
            type="url"
            value={value[key] ?? ''}
            onChange={(e) => update(key, e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none font-body text-sm text-foreground placeholder-[--text-muted]"
            maxLength={500}
          />
        </div>
      ))}
    </div>
  )
}
