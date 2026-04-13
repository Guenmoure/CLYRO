'use client'

import { useState } from 'react'
import { Download, Share2, ExternalLink, Image as ImageIcon, FileText, Palette } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ResultType = 'video' | 'brand'

export interface BrandAsset {
  label: string
  url: string
  type: 'image' | 'pdf' | 'svg'
}

interface ResultModalProps {
  isOpen: boolean
  onClose: () => void
  type: ResultType
  title: string
  /** For video type */
  videoUrl?: string
  thumbnailUrl?: string
  /** For brand type */
  assets?: BrandAsset[]
  /** Called when user clicks "Nouveau projet" */
  onNewProject?: () => void
}

// ── Video result ───────────────────────────────────────────────────────────────

function VideoResult({ videoUrl, thumbnailUrl, title }: { videoUrl: string; thumbnailUrl?: string; title: string }) {
  return (
    <div className="rounded-xl overflow-hidden bg-navy-950 aspect-video">
      <video
        src={videoUrl}
        poster={thumbnailUrl}
        controls
        playsInline
        className="w-full h-full object-contain"
        aria-label={title}
      />
    </div>
  )
}

// ── Brand asset grid ───────────────────────────────────────────────────────────

function AssetIcon({ type }: { type: BrandAsset['type'] }) {
  if (type === 'image' || type === 'svg') return <ImageIcon size={20} className="text-blue-400" />
  if (type === 'pdf') return <FileText size={20} className="text-purple-400" />
  return <Palette size={20} className="text-cyan-400" />
}

function BrandResult({ assets }: { assets: BrandAsset[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {assets.map((asset) => (
        <a
          key={asset.label}
          href={asset.url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'group flex flex-col items-center gap-3 rounded-xl p-4',
            'bg-navy-800 border border-navy-700 hover:border-blue-500/50',
            'transition-all duration-200 hover:bg-navy-750',
          )}
        >
          <div className="w-12 h-12 rounded-xl bg-navy-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <AssetIcon type={asset.type} />
          </div>
          <span className="font-body text-xs text-[--text-secondary] text-center leading-snug">
            {asset.label}
          </span>
          <Badge variant="neutral" className="text-[10px]">
            {asset.type.toUpperCase()}
          </Badge>
        </a>
      ))}
    </div>
  )
}

// ── ResultModal ────────────────────────────────────────────────────────────────

export function ResultModal({
  isOpen,
  onClose,
  type,
  title,
  videoUrl,
  thumbnailUrl,
  assets = [],
  onNewProject,
}: ResultModalProps) {
  const [sharing, setSharing] = useState(false)

  async function handleShare() {
    if (!videoUrl) return
    setSharing(true)
    try {
      if (navigator.share) {
        await navigator.share({ title, url: videoUrl })
      } else {
        await navigator.clipboard.writeText(videoUrl)
      }
    } catch {
      // User cancelled share
    } finally {
      setSharing(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      scrollable
    >
      <div className="space-y-5">
        {/* Result display */}
        {type === 'video' && videoUrl ? (
          <VideoResult videoUrl={videoUrl} thumbnailUrl={thumbnailUrl} title={title} />
        ) : type === 'brand' && assets.length > 0 ? (
          <BrandResult assets={assets} />
        ) : (
          <div className="rounded-xl bg-navy-800 border border-navy-700 p-8 flex items-center justify-center">
            <p className="font-mono text-sm text-[--text-muted]">Résultat non disponible</p>
          </div>
        )}

        {/* Action row */}
        <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-navy-700/50">
          {onNewProject && (
            <Button variant="ghost" onClick={onNewProject}>
              Nouveau projet
            </Button>
          )}

          {type === 'video' && videoUrl && (
            <>
              <Button
                variant="secondary"
                leftIcon={<Share2 size={14} />}
                loading={sharing}
                onClick={handleShare}
              >
                Partager
              </Button>
              <Button
                variant="secondary"
                leftIcon={<ExternalLink size={14} />}
                asChild
              >
                <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                  Ouvrir
                </a>
              </Button>
              <Button
                variant="primary"
                leftIcon={<Download size={14} />}
                asChild
              >
                <a href={videoUrl} download>
                  Télécharger
                </a>
              </Button>
            </>
          )}

          {type === 'brand' && (
            <Button
              variant="primary"
              leftIcon={<Download size={14} />}
              onClick={() => assets.forEach(a => {
                const link = document.createElement('a')
                link.href = a.url
                link.download = a.label
                link.click()
              })}
            >
              Tout télécharger
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
