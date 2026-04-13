/**
 * Catalogue de musiques de fond royalty-free (CC0 / Pixabay)
 * URL publiques stables — servies depuis Supabase Storage ou CDN externe.
 * Chaque piste est choisie pour son adéquation avec les styles Faceless.
 */
export interface MusicTrack {
  id: string
  label: string
  mood: string
  bpm: number
  url: string
}

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'ambient-calm',
    label: 'Ambient Calm',
    mood: 'calme, éducatif, focus',
    bpm: 80,
    url: process.env.MUSIC_AMBIENT_CALM_URL ?? '',
  },
  {
    id: 'upbeat-corporate',
    label: 'Corporate Upbeat',
    mood: 'motivant, professionnel',
    bpm: 120,
    url: process.env.MUSIC_CORPORATE_URL ?? '',
  },
  {
    id: 'epic-cinematic',
    label: 'Epic Cinematic',
    mood: 'dramatique, cinématique',
    bpm: 100,
    url: process.env.MUSIC_EPIC_URL ?? '',
  },
  {
    id: 'playful-fun',
    label: 'Playful & Fun',
    mood: 'jovial, enfantin, décontracté',
    bpm: 130,
    url: process.env.MUSIC_PLAYFUL_URL ?? '',
  },
  {
    id: 'lofi-chill',
    label: 'Lo-Fi Chill',
    mood: 'détendu, moderne, étude',
    bpm: 90,
    url: process.env.MUSIC_LOFI_URL ?? '',
  },
]

/**
 * Returns the URL for a music track by ID.
 * Returns undefined if the track is not found or its URL env var is not configured.
 * This ensures the pipeline skips background music gracefully instead of crashing.
 */
export function getMusicTrackUrl(trackId: string): string | undefined {
  const track = MUSIC_TRACKS.find((t) => t.id === trackId)
  if (!track) return undefined
  if (!track.url) {
    console.warn(`[music] Track "${trackId}" has no URL configured (missing env var). Skipping background music.`)
    return undefined
  }
  return track.url
}

/**
 * Returns only the tracks that have a URL configured.
 * Used to filter the music catalogue shown to the user.
 */
export function getAvailableTracks(): MusicTrack[] {
  return MUSIC_TRACKS.filter((t) => !!t.url)
}
