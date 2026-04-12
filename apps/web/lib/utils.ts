import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formate un timestamp en date lisible FR
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Formate un timestamp en date + heure
 */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

/**
 * Retourne le label human-readable d'un statut vidéo
 */
export function getVideoStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'En attente',
    processing: 'En traitement',
    storyboard: 'Storyboard',
    visuals: 'Génération visuels',
    audio: 'Voix off',
    assembly: 'Assemblage',
    done: 'Terminé',
    error: 'Erreur',
  }
  return labels[status] ?? status
}

/**
 * Tronque un texte à une longueur donnée
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

/**
 * Valide la durée d'un script basée sur la vitesse de parole française (150 WPM)
 * Retourne les détails du dépassement si le script est trop long
 */
export interface ScriptDurationCheck {
  ok: boolean
  wordCount: number
  estimatedSeconds: number
  targetSeconds: number
  overflowPct: number
  message?: string
}

export function checkScriptDuration(script: string, targetDuration: string): ScriptDurationCheck {
  const WPM_FR = 150
  const DURATION_SECONDS: Record<string, number> = {
    '6s': 6,
    '15s': 15,
    '30s': 30,
    '60s': 60,
  }

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length
  const estimatedSeconds = (wordCount / WPM_FR) * 60
  const targetSeconds = DURATION_SECONDS[targetDuration] ?? 30
  const overflowPct = ((estimatedSeconds - targetSeconds) / targetSeconds) * 100
  const isOk = overflowPct <= 20

  let message = ''
  if (!isOk) {
    message = `Attention: Votre script est trop long. ${Math.round(estimatedSeconds)}s estimées (durée cible: ${targetSeconds}s). Nous allons le condenser automatiquement.`
  }

  return {
    ok: isOk,
    wordCount,
    estimatedSeconds: Math.round(estimatedSeconds * 10) / 10,
    targetSeconds,
    overflowPct: Math.round(overflowPct * 10) / 10,
    message: message || undefined,
  }
}
