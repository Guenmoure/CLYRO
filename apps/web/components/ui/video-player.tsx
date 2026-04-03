'use client'

import { useState, useRef } from 'react'
import { Download, Copy, Check, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  url: string
  title?: string
  className?: string
}

export function VideoPlayer({ url, title, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [copied, setCopied] = useState(false)
  const [playing, setPlaying] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handlePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else          { v.pause(); setPlaying(false) }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Player */}
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video group shadow-lg">
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          className="w-full h-full object-contain"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
        {!playing && (
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Lire la vidéo"
          >
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
              <Play size={22} className="text-gray-900 ml-1" fill="currentColor" />
            </div>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {title && (
          <p className="flex-1 font-display font-semibold text-sm text-brand-text truncate">{title}</p>
        )}
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all',
            copied
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
              : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary hover:text-brand-primary'
          )}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copié !' : 'Copier le lien'}
        </button>
        <a
          href={url}
          download
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-text text-white text-xs font-mono hover:opacity-80 transition-opacity"
        >
          <Download size={12} />
          Télécharger
        </a>
      </div>
    </div>
  )
}
