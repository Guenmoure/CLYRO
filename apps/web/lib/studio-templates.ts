/**
 * Studio templates — curated set surfaced by the StudioTemplateGallery on
 * /studio/new (Audit 16/06/26 Wave 3 — « ajouter une bibliothèque de
 * modèles dans le Studio »).
 *
 * Each template is an opinionated starting point for an avatar-driven
 * video: a script seed in EN + FR, a target duration, a recommended
 * narration language, and visual hints (gradient + emoji). Clicking a
 * card on the gallery prefills the Studio form so the user doesn't face
 * the blank-page tax.
 *
 * Design constraints
 * ─────────────────
 * • Avatar-format-aware: every script is written for a single talking
 *   head + on-screen lower-thirds, not for B-roll narration.
 * • Tight: each script is ≤ 120 words (~ 60s at 130 wpm) so the user can
 *   read it through quickly and trust it before regenerating.
 * • Bilingual today (EN + FR). ES / DE / PT fall back to EN at render
 *   time via `getLocalizedField()`.
 * • Zero new dependency, zero migration — pure TypeScript data.
 */

export type StudioTemplateCategory =
  | 'pitch'
  | 'demo'
  | 'tutorial'
  | 'testimonial'
  | 'social'
  | 'professional'

export interface StudioTemplate {
  id:               string
  category:         StudioTemplateCategory
  /** Display name surfaced on the card. */
  name_en:          string
  name_fr:          string
  /** One-liner used in the card body + tooltip. */
  description_en:   string
  description_fr:   string
  /** Initial script seed inserted in the textarea on selection. */
  script_en:        string
  script_fr:        string
  /** Approximate target duration in seconds — drives credit estimate. */
  duration_seconds: number
  /** Suggested narration language code (matches Studio LANGUAGES). */
  language_hint:    'en' | 'fr'
  /** Tailwind gradient classes for the card visual. */
  gradient:         string
  /** Emoji glyph displayed as the card icon. */
  emoji:            string
}

/**
 * The curated set surfaced in the gallery. Order = display order, so
 * « Founder pitch » sits first as the most common starting point.
 */
export const STUDIO_TEMPLATES: readonly StudioTemplate[] = [
  {
    id:               'founder-pitch',
    category:         'pitch',
    name_en:          'Founder pitch',
    name_fr:          'Pitch fondateur',
    description_en:   'A 60-second elevator pitch for investors or partners — problem, solution, traction.',
    description_fr:   'Pitch ascenseur de 60s pour investisseurs ou partenaires — problème, solution, traction.',
    script_en:        `Most companies waste hours every week on the same problem — and nobody has fixed it. I built [Product] because I lived that pain for years. We turn a two-hour task into a two-minute one. In six months, we've grown to [N] customers and [revenue] in monthly revenue. We're raising [amount] to expand into [market]. If you're investing in vertical SaaS, let's talk.`,
    script_fr:        `La plupart des boîtes perdent des heures chaque semaine sur le même problème — et personne ne l'a résolu. J'ai lancé [Produit] parce que j'ai vécu cette douleur pendant des années. On transforme une tâche de deux heures en deux minutes. En six mois, on est passés à [N] clients et [revenu] de revenu mensuel. On lève [montant] pour s'attaquer à [marché]. Si tu investis dans le SaaS vertical, parlons-en.`,
    duration_seconds: 60,
    language_hint:    'en',
    gradient:         'from-blue-500/20 to-indigo-500/5',
    emoji:            '🚀',
  },
  {
    id:               'product-demo',
    category:         'demo',
    name_en:          'Product demo',
    name_fr:          'Démo produit',
    description_en:   'A friendly walkthrough of one feature — show the value in 90 seconds.',
    description_fr:   'Tour guidé d\'une fonctionnalité — montre la valeur en 90 secondes.',
    script_en:        `Hey, want to see how [Feature] works in real life? Watch this. You open the dashboard, click [action], and the [output] is ready in seconds. The trick is [explain]. We do all the heavy lifting in the background so you just keep going. Try it free on [URL] — first three projects are on us.`,
    script_fr:        `Salut, tu veux voir comment [Fonctionnalité] marche pour de vrai ? Regarde. T'ouvres le dashboard, tu cliques sur [action], et [résultat] est prêt en quelques secondes. L'astuce, c'est [explication]. On fait tout le boulot en arrière-plan pour que tu n'aies qu'à avancer. Essaie gratuitement sur [URL] — les trois premiers projets sont offerts.`,
    duration_seconds: 90,
    language_hint:    'en',
    gradient:         'from-emerald-500/20 to-teal-500/5',
    emoji:            '🛠️',
  },
  {
    id:               'talking-head-explainer',
    category:         'tutorial',
    name_en:          'Talking-head explainer',
    name_fr:          'Explainer talking head',
    description_en:   'Break down a complex concept in plain language, looking at the camera.',
    description_fr:   'Décortique un concept complexe dans un langage simple, face caméra.',
    script_en:        `Most people get [Topic] wrong, and that's because it's usually taught backwards. Here's the simple version. [Concept] is really just [analogy]. Once you see it that way, three things become obvious: first, [point one]. Second, [point two]. Third, [point three]. The next time someone tells you [misconception], you'll know exactly why it doesn't hold up.`,
    script_fr:        `La plupart des gens se plantent sur [Sujet], et c'est parce qu'on l'enseigne à l'envers. Voilà la version simple. [Concept] c'est juste [analogie]. Une fois que tu le vois comme ça, trois choses deviennent évidentes : un, [point un]. Deux, [point deux]. Trois, [point trois]. La prochaine fois qu'on te sort [idée reçue], tu sauras exactement pourquoi ça ne tient pas.`,
    duration_seconds: 75,
    language_hint:    'en',
    gradient:         'from-amber-500/20 to-orange-500/5',
    emoji:            '🎓',
  },
  {
    id:               'customer-testimonial',
    category:         'testimonial',
    name_en:          'Customer testimonial',
    name_fr:          'Témoignage client',
    description_en:   'A first-person story — before, after, and the moment that changed things.',
    description_fr:   'Une histoire à la première personne — avant, après, et le moment qui a tout changé.',
    script_en:        `Six months ago, my team was [pain point] — it was costing us [cost]. We tried [alternatives] and none of them solved the real issue. Then I found [Product]. Two weeks in, [first win]. Today we've [outcome]. Honestly, the part I wasn't expecting was [unexpected benefit]. If you're stuck like I was, give it a shot.`,
    script_fr:        `Il y a six mois, mon équipe était [problème] — ça nous coûtait [coût]. On a essayé [alternatives] et rien n'a vraiment résolu le souci. Puis j'ai trouvé [Produit]. Au bout de deux semaines, [première victoire]. Aujourd'hui, on a [résultat]. Honnêtement, ce que je n'attendais pas, c'est [bénéfice inattendu]. Si tu galères comme moi avant, lance-toi.`,
    duration_seconds: 45,
    language_hint:    'en',
    gradient:         'from-pink-500/20 to-rose-500/5',
    emoji:            '💬',
  },
  {
    id:               'tiktok-fast-hook',
    category:         'social',
    name_en:          'TikTok fast hook',
    name_fr:          'Hook TikTok rapide',
    description_en:   'Punchy 20-second vertical hook — grab attention in the first 3 seconds.',
    description_fr:   'Hook vertical de 20s qui claque — accrocher en moins de 3 secondes.',
    script_en:        `Stop scrolling. Here's the thing nobody told you about [topic]: [counterintuitive truth]. I tested it for [duration] and the result was [outcome]. The reason it works is [one-line explanation]. Try it once. Comment « DONE » when you do.`,
    script_fr:        `Arrête de scroller. Voilà ce que personne ne t'a dit sur [sujet] : [vérité contre-intuitive]. J'ai testé pendant [durée] et le résultat, c'est [résultat]. La raison pour laquelle ça marche, c'est [explication courte]. Essaie une fois. Tape « DONE » en commentaire quand c'est fait.`,
    duration_seconds: 20,
    language_hint:    'en',
    gradient:         'from-violet-500/20 to-fuchsia-500/5',
    emoji:            '⚡',
  },
  {
    id:               'linkedin-thought-leader',
    category:         'professional',
    name_en:          'LinkedIn thought leader',
    name_fr:          'Thought leader LinkedIn',
    description_en:   'A 60-second take on an industry trend — credibility-first delivery.',
    description_fr:   'Prise de position de 60s sur une tendance — posture crédible avant tout.',
    script_en:        `Everyone in [industry] is talking about [trend], but most of the takes miss the point. Here's what I'm actually seeing on the ground. [Observation one]. [Observation two]. The companies winning right now aren't the loudest — they're the ones doing [unsexy thing] better than anyone else. If your team is debating [common decision], the answer is probably [contrarian recommendation]. Let me know what you're seeing.`,
    script_fr:        `Tout le monde dans [secteur] parle de [tendance], mais la plupart des analyses passent à côté du sujet. Voilà ce que je vois vraiment sur le terrain. [Observation un]. [Observation deux]. Les boîtes qui gagnent en ce moment ne sont pas les plus bruyantes — ce sont celles qui font [chose pas sexy] mieux que les autres. Si ton équipe hésite sur [décision classique], la réponse, c'est probablement [recommandation à contre-courant]. Dis-moi ce que tu observes.`,
    duration_seconds: 60,
    language_hint:    'en',
    gradient:         'from-cyan-500/20 to-blue-500/5',
    emoji:            '💼',
  },
  {
    id:               'news-update',
    category:         'professional',
    name_en:          'News update',
    name_fr:          'Brève d\'actu',
    description_en:   'A 45-second briefing on a single news item — authoritative, no fluff.',
    description_fr:   'Brief de 45s sur un sujet d\'actualité — ton posé, zéro remplissage.',
    script_en:        `Today's update: [event] just happened. Here's what you need to know in under a minute. First, [headline fact]. Second, [why it matters]. Third, [what to watch next]. Sources are linked below. If you want the in-depth analysis, the full breakdown is on [URL] — link in bio.`,
    script_fr:        `Aujourd'hui : [événement] vient de se produire. Voilà ce qu'il faut savoir en moins d'une minute. Un, [fait principal]. Deux, [pourquoi c'est important]. Trois, [ce qu'il faut suivre ensuite]. Les sources sont en commentaire. Si tu veux l'analyse en profondeur, le décryptage complet est sur [URL] — lien en bio.`,
    duration_seconds: 45,
    language_hint:    'en',
    gradient:         'from-slate-500/20 to-zinc-500/5',
    emoji:            '📰',
  },
  {
    id:               'tutorial-step-by-step',
    category:         'tutorial',
    name_en:          'Tutorial step-by-step',
    name_fr:          'Tuto pas-à-pas',
    description_en:   'A 2-minute walkthrough — number every step, end with a clear payoff.',
    description_fr:   'Tour guidé de 2 min — numérote chaque étape, finis par un résultat clair.',
    script_en:        `In the next two minutes, I'll show you how to [goal]. Step one: [action one]. Make sure you [tip]. Step two: [action two]. This is where most people get stuck — the trick is [explain]. Step three: [action three]. And step four: [action four]. That's it. You should now have [outcome]. If it didn't work, double-check step two — that's almost always the culprit.`,
    script_fr:        `Dans les deux prochaines minutes, je te montre comment [objectif]. Étape un : [action un]. Vérifie bien que tu [conseil]. Étape deux : [action deux]. C'est là que la plupart des gens se bloquent — l'astuce, c'est [explication]. Étape trois : [action trois]. Et étape quatre : [action quatre]. Voilà. Tu devrais maintenant avoir [résultat]. Si ça n'a pas marché, revérifie l'étape deux — c'est presque toujours le coupable.`,
    duration_seconds: 120,
    language_hint:    'en',
    gradient:         'from-indigo-500/20 to-violet-500/5',
    emoji:            '📚',
  },
] as const

/** Resolve a localised field, falling back to EN for languages we don't ship. */
export function getStudioTemplateText(
  template: StudioTemplate,
  field: 'name' | 'description' | 'script',
  lang: string,
): string {
  if (lang === 'fr') return template[`${field}_fr`]
  return template[`${field}_en`]
}
