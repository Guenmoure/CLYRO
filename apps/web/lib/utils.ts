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
