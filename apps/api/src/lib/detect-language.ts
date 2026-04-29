/**
 * Lightweight, zero-dependency language detection.
 *
 * Used by the video pipelines to tell Claude which language the
 * user's script is in, so the generated voice-over text doesn't
 * silently get translated to French (which used to happen because
 * the storyboard prompts themselves were written in French —
 * Claude mirrored the prompt language even with explicit "do not
 * translate" instructions).
 *
 * Approach: count the occurrences of common stop-words for each
 * supported language in a normalised version of the text. The
 * language with the highest score wins. Ties or empty input
 * default to English (the safest cross-cultural fallback).
 *
 * This is intentionally NOT a general-purpose language detector
 * (no diacritic n-grams, no character-set analysis). Stop-word
 * counting is enough for our use case: scripts are typically
 * 30-300 words, well above the threshold where this approach
 * is reliable for the seven supported languages.
 */

export type SupportedLanguage = 'en' | 'fr' | 'es' | 'de' | 'it' | 'pt' | 'nl'

export interface DetectedLanguage {
  /** ISO 639-1 code, e.g. 'en' */
  code: SupportedLanguage
  /** English display name, e.g. 'English' — used in prompts */
  name: string
  /** Native display name, e.g. 'English', 'Français' — for UI */
  nativeName: string
}

const LANGUAGES: Record<SupportedLanguage, { name: string; nativeName: string; stopWords: string[] }> = {
  en: {
    name: 'English',
    nativeName: 'English',
    stopWords: [
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
      'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
      'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there',
      'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get',
      'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no',
      'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your',
      'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then',
      'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
      'because', 'how', 'why', 'really', 'don', 'is', 'are', 'was',
      'were', 'been', 'being', 'has', 'had', 'does', 'did',
    ],
  },
  fr: {
    name: 'French',
    nativeName: 'Français',
    stopWords: [
      'le', 'la', 'les', 'un', 'une', 'des', 'et', 'ou', 'mais', 'donc',
      'or', 'ni', 'car', 'que', 'qui', 'quoi', 'dont', 'où', 'à', 'au',
      'aux', 'de', 'du', 'en', 'dans', 'sur', 'sous', 'avec', 'sans',
      'pour', 'par', 'vers', 'chez', 'je', 'tu', 'il', 'elle', 'on',
      'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se', 'lui', 'leur',
      'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses',
      'notre', 'votre', 'nos', 'vos', 'leurs', 'ce', 'cet', 'cette',
      'ces', 'est', 'sont', 'était', 'étaient', 'a', 'ont', 'avait',
      'avaient', 'sera', 'seront', 'pas', 'plus', 'très', 'aussi',
      'bien', 'comme', 'tout', 'tous', 'toute', 'toutes', 'même',
      'aussi', 'alors', 'puis', 'ensuite', 'avant', 'après', 'pendant',
      'depuis', 'jusqu', 'parce', 'quand', 'comment', 'pourquoi',
    ],
  },
  es: {
    name: 'Spanish',
    nativeName: 'Español',
    stopWords: [
      'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o',
      'pero', 'si', 'no', 'que', 'qué', 'cual', 'quien', 'donde',
      'cuando', 'como', 'porque', 'a', 'ante', 'bajo', 'con', 'contra',
      'de', 'desde', 'durante', 'en', 'entre', 'hacia', 'hasta', 'para',
      'por', 'según', 'sin', 'sobre', 'tras', 'yo', 'tú', 'él', 'ella',
      'usted', 'nosotros', 'vosotros', 'ellos', 'ellas', 'me', 'te',
      'se', 'le', 'lo', 'les', 'mi', 'tu', 'su', 'mis', 'tus', 'sus',
      'nuestro', 'vuestro', 'este', 'esta', 'estos', 'estas', 'ese',
      'esa', 'esos', 'esas', 'aquel', 'es', 'son', 'era', 'eran',
      'ha', 'han', 'había', 'habían', 'será', 'serán', 'muy', 'más',
      'menos', 'también', 'tan', 'todo', 'todos', 'toda', 'todas',
      'mismo', 'misma', 'ya', 'aún', 'todavía',
    ],
  },
  de: {
    name: 'German',
    nativeName: 'Deutsch',
    stopWords: [
      'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen',
      'einem', 'eines', 'und', 'oder', 'aber', 'doch', 'wenn', 'weil',
      'dass', 'als', 'wie', 'wo', 'was', 'wer', 'warum', 'wann', 'ich',
      'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'sich',
      'uns', 'euch', 'mein', 'dein', 'sein', 'ihr', 'unser', 'euer',
      'mit', 'von', 'zu', 'bei', 'aus', 'nach', 'für', 'auf', 'in',
      'an', 'über', 'unter', 'vor', 'hinter', 'neben', 'zwischen',
      'durch', 'ohne', 'gegen', 'um', 'ist', 'sind', 'war', 'waren',
      'hat', 'haben', 'hatte', 'hatten', 'wird', 'werden', 'nicht',
      'kein', 'sehr', 'auch', 'noch', 'schon', 'nur', 'so', 'ja',
      'nein', 'dann', 'jetzt', 'hier', 'dort', 'immer',
    ],
  },
  it: {
    name: 'Italian',
    nativeName: 'Italiano',
    stopWords: [
      'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'e', 'o',
      'ma', 'però', 'se', 'che', 'chi', 'cui', 'dove', 'quando', 'come',
      'perché', 'a', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'di',
      'del', 'dello', 'della', 'dei', 'degli', 'delle', 'da', 'dal',
      'in', 'nel', 'nella', 'su', 'sul', 'con', 'per', 'tra', 'fra',
      'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro', 'mi', 'ti', 'si',
      'ci', 'vi', 'mio', 'tuo', 'suo', 'nostro', 'vostro', 'questo',
      'questa', 'questi', 'queste', 'quello', 'quella', 'è', 'sono',
      'era', 'erano', 'ha', 'hanno', 'aveva', 'avevano', 'sarà',
      'molto', 'più', 'meno', 'anche', 'tutto', 'tutta', 'tutti',
      'tutte', 'già', 'ancora', 'poi', 'ora', 'qui', 'lì',
    ],
  },
  pt: {
    name: 'Portuguese',
    nativeName: 'Português',
    stopWords: [
      'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'e', 'ou',
      'mas', 'se', 'que', 'qual', 'quem', 'onde', 'quando', 'como',
      'porque', 'porquê', 'à', 'ao', 'aos', 'às', 'de', 'do', 'da',
      'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'por', 'pelo',
      'pela', 'para', 'com', 'sem', 'sobre', 'sob', 'entre', 'ante',
      'após', 'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas',
      'você', 'me', 'te', 'se', 'lhe', 'lhes', 'meu', 'teu', 'seu',
      'nosso', 'vosso', 'este', 'esta', 'estes', 'estas', 'esse',
      'essa', 'esses', 'essas', 'aquele', 'aquela', 'é', 'são', 'era',
      'eram', 'foi', 'foram', 'tem', 'têm', 'tinha', 'tinham', 'será',
      'serão', 'muito', 'mais', 'menos', 'também', 'tão', 'tudo',
      'todos', 'todas', 'toda', 'já', 'ainda', 'então', 'agora',
    ],
  },
  nl: {
    name: 'Dutch',
    nativeName: 'Nederlands',
    stopWords: [
      'de', 'het', 'een', 'en', 'of', 'maar', 'als', 'dat', 'die',
      'dit', 'deze', 'wie', 'wat', 'waar', 'wanneer', 'hoe', 'waarom',
      'omdat', 'door', 'voor', 'aan', 'bij', 'in', 'op', 'over',
      'onder', 'naar', 'van', 'uit', 'met', 'zonder', 'tegen', 'tot',
      'tijdens', 'na', 'voor', 'tussen', 'ik', 'jij', 'je', 'hij',
      'zij', 'ze', 'wij', 'we', 'jullie', 'mij', 'me', 'jou', 'hem',
      'haar', 'ons', 'mijn', 'jouw', 'zijn', 'haar', 'onze', 'hun',
      'is', 'zijn', 'was', 'waren', 'heeft', 'hebben', 'had', 'hadden',
      'wordt', 'worden', 'werd', 'werden', 'niet', 'geen', 'zeer',
      'erg', 'ook', 'nog', 'al', 'altijd', 'nooit', 'soms', 'vaak',
      'hier', 'daar', 'nu', 'dan', 'toen', 'dus',
    ],
  },
}

const TOKEN_RE = /[a-zà-ÿœæ]+/gi

/**
 * Detect the language of a piece of text.
 *
 * @param text  The text to analyse (script, brief, anything narrative).
 * @param fallback  Code returned when the input is empty or undecidable.
 *                  Defaults to 'en' (safest neutral choice).
 */
export function detectLanguage(text: string, fallback: SupportedLanguage = 'en'): DetectedLanguage {
  if (!text || text.trim().length < 4) {
    return toResult(fallback)
  }

  const tokens = (text.toLowerCase().match(TOKEN_RE) ?? [])
  if (tokens.length === 0) return toResult(fallback)

  // Build a set for O(1) lookup per token, scoped per language.
  const sets = Object.fromEntries(
    Object.entries(LANGUAGES).map(([code, def]) => [code, new Set(def.stopWords)]),
  ) as Record<SupportedLanguage, Set<string>>

  const scores: Record<SupportedLanguage, number> = {
    en: 0, fr: 0, es: 0, de: 0, it: 0, pt: 0, nl: 0,
  }

  for (const token of tokens) {
    for (const code of Object.keys(scores) as SupportedLanguage[]) {
      if (sets[code].has(token)) scores[code]++
    }
  }

  // Pick the language with the highest score. If everything is zero
  // (rare — text with no recognisable stop words), fall back.
  let bestCode: SupportedLanguage = fallback
  let bestScore = 0
  for (const code of Object.keys(scores) as SupportedLanguage[]) {
    if (scores[code] > bestScore) {
      bestCode = code
      bestScore = scores[code]
    }
  }

  // Confidence floor: a top score of < 2 hits across the whole text
  // is too thin to trust — treat as undecidable and use the fallback.
  if (bestScore < 2) return toResult(fallback)

  return toResult(bestCode)
}

function toResult(code: SupportedLanguage): DetectedLanguage {
  const def = LANGUAGES[code]
  return { code, name: def.name, nativeName: def.nativeName }
}
