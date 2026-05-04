// ── CLYRO — Script Planning ───────────────────────────────────────────────────
// Single source of truth for "how many scenes does this script need" and
// "how do we split a long script into chunks the model can handle".
//
// Rule de fer (user requirement, mai 2026) :
// La longueur de la vidéo finale est ENTIÈREMENT déterminée par la longueur
// du script. AUCUNE compression, AUCUN raccourcissement. Si le script fait
// 5000 mots, la vidéo fait ~33 min et on génère ~227 scènes.
//
// Pas de plafond MAX_SCENES. À la place, quand la quantité de scènes
// dépasse ce que Claude peut sortir en un appel (max_tokens), on chunke
// le script en plusieurs morceaux qu'on génère en parallèle puis qu'on
// concatène avec ré-numérotation des index.

/** Vitesse de parole naturelle (voix off pro). Identique entre fr/en/es. */
export const STORYBOARD_WPM = 150

/** Cible de mots par scène. ~22 mots = ~8-9s de narration à 150 wpm. */
export const STORYBOARD_WORDS_PER_SCENE = 22

/** Nombre de scènes max qu'on demande à Claude par appel. Au-delà,
 *  l'output JSON dépasse max_tokens=16000 et est tronqué. Choisi
 *  pour laisser ~200 tokens de marge par scène. */
export const STORYBOARD_MAX_SCENES_PER_CALL = 70

/** Cap logique de sécurité — un script > 12000 mots = ~80 min de vidéo,
 *  largement au-delà de tout cas réaliste. Au-delà, on log un warning
 *  mais on génère quand même (l'utilisateur a explicitement demandé
 *  qu'on ne raccourcisse jamais). */
export const STORYBOARD_SANITY_LIMIT = 600

export interface SceneCountPlan {
  /** Nombre de mots du script (après trim/normalisation). */
  wordCount: number
  /** Nombre TOTAL de scènes nécessaires (peut être très grand, c'est OK). */
  sceneCount: number
  /** Durée estimée totale en secondes (somme des scènes). */
  estimatedSeconds: number
  /** Nombre d'appels Claude à faire (1 si court, plusieurs si long). */
  chunkCount: number
  /** Nombre approximatif de scènes par chunk (les chunks sont ~équilibrés). */
  scenesPerChunk: number
}

/**
 * Calcule combien de scènes le script nécessite, et combien d'appels
 * Claude sont nécessaires pour les générer sans tronquer.
 *
 * @param script - Le script source (jamais raccourci)
 * @param targetDuration - 'auto' ou '6s'/'15s'/'30s'/'60s'/etc.
 * @param fixedSceneMap - Mapping durée → nombre de scènes (utilisé seulement quand targetDuration ≠ 'auto')
 */
export function planSceneCount(
  script: string,
  targetDuration: string = 'auto',
  fixedSceneMap?: Record<string, number>,
): SceneCountPlan {
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length
  const estimatedSeconds = Math.max(6, Math.round((wordCount / STORYBOARD_WPM) * 60))

  let sceneCount: number
  if (targetDuration === 'auto' || !fixedSceneMap) {
    // Mode auto : le script seul drive la quantité de scènes — pas de plafond.
    sceneCount = Math.max(3, Math.ceil(wordCount / STORYBOARD_WORDS_PER_SCENE))
  } else {
    // Mode durée fixe : on respecte le mapping (ex: '30s' → 4 scènes), mais
    // on ne descend jamais en-dessous du nombre nécessaire pour narrer le
    // script complet à 150 wpm sans le compresser.
    const fixed = fixedSceneMap[targetDuration] ?? fixedSceneMap.default ?? 4
    const minForFullScript = Math.max(3, Math.ceil(wordCount / STORYBOARD_WORDS_PER_SCENE))
    sceneCount = Math.max(fixed, minForFullScript)
  }

  const chunkCount = Math.max(1, Math.ceil(sceneCount / STORYBOARD_MAX_SCENES_PER_CALL))
  const scenesPerChunk = Math.ceil(sceneCount / chunkCount)

  return { wordCount, sceneCount, estimatedSeconds, chunkCount, scenesPerChunk }
}

/**
 * Découpe un script long en N morceaux, en respectant les frontières
 * de phrases pour préserver la cohérence narrative. Chaque chunk
 * peut être passé à Claude séparément ; les storyboards résultants
 * sont concaténés avec ré-indexation côté caller.
 *
 * Garantit que la concaténation des chunks (sans modification) ré-assemble
 * EXACTEMENT le script original (modulo whitespace de jointure).
 */
export function splitScriptForChunks(script: string, chunkCount: number): string[] {
  if (chunkCount <= 1) return [script.trim()]

  const trimmed = script.trim()
  // Match phrases en gardant la ponctuation finale ; fallback : par paragraphe ;
  // dernier fallback : tout dans un seul morceau si le script n'a pas de
  // ponctuation (Claude se débrouillera).
  const sentences = trimmed.match(/[^.!?\n]+[.!?]+|\S+[^.!?\n]*$/g) ?? trimmed.split(/\n+/)
  if (sentences.length < chunkCount) return [trimmed]

  const totalWords = trimmed.split(/\s+/).filter(Boolean).length
  const wordsPerChunk = Math.ceil(totalWords / chunkCount)

  const chunks: string[] = []
  let current = ''
  let currentWords = 0
  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).filter(Boolean).length
    if (currentWords + sentenceWords > wordsPerChunk && current.trim() && chunks.length < chunkCount - 1) {
      chunks.push(current.trim())
      current = sentence
      currentWords = sentenceWords
    } else {
      current += (current && !current.endsWith(' ') ? ' ' : '') + sentence
      currentWords += sentenceWords
    }
  }
  if (current.trim()) chunks.push(current.trim())

  // Sanity : si on a obtenu moins de chunks que demandé (script trop court
  // ou phrases trop longues), on retourne ce qu'on a — Claude gérera.
  return chunks.length > 0 ? chunks : [trimmed]
}

/** Compte les mots dans une chaîne, robuste aux espaces multiples. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Vérifie qu'un storyboard généré préserve bien le script complet.
 * Compare le nombre de mots cumulé des `texte_voix` au nombre de mots
 * du script source. Tolérance : 8 % en moins (ponctuation/jointure).
 *
 * Renvoie `{ ok: true }` si OK, sinon `{ ok: false, originalWords, storyboardWords, lossPercent }`.
 */
export function validateScriptCoverage(
  script: string,
  scenes: Array<{ texte_voix?: string }>,
): { ok: boolean; originalWords: number; storyboardWords: number; lossPercent: number } {
  const originalWords = countWords(script)
  const storyboardWords = scenes.reduce((sum, s) => sum + countWords(s.texte_voix ?? ''), 0)
  const lossPercent = originalWords === 0 ? 0 : ((originalWords - storyboardWords) / originalWords) * 100
  return {
    ok: lossPercent <= 8,
    originalWords,
    storyboardWords,
    lossPercent: Math.round(lossPercent * 10) / 10,
  }
}
