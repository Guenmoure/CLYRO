-- Migration: video_templates table
-- Date: 20260414000001

-- Table principale des templates vidéo
CREATE TABLE video_templates (
  id                      text PRIMARY KEY,
  name                    text NOT NULL,
  channel_url             text,
  niche                   text NOT NULL,
  language                text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr', 'es', 'de', 'pt')),
  is_public               boolean NOT NULL DEFAULT true,
  fal_style               text NOT NULL CHECK (fal_style IN (
                            'animation-2d', 'stock-vo', 'minimaliste',
                            'infographie', 'whiteboard', 'cinematique'
                          )),
  recommended_scene_count integer NOT NULL CHECK (recommended_scene_count BETWEEN 4 AND 12),
  tone_keywords           text[]  NOT NULL DEFAULT '{}',
  tags                    text[]  NOT NULL DEFAULT '{}',
  claude_system_prompt    text    NOT NULL,
  structure_guide         jsonb   NOT NULL DEFAULT '{}',
  script_example          text    NOT NULL,
  usage_count             integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Index pour les filtres fréquents dans l'UI
CREATE INDEX idx_video_templates_niche     ON video_templates(niche);
CREATE INDEX idx_video_templates_language  ON video_templates(language);
CREATE INDEX idx_video_templates_is_public ON video_templates(is_public);
CREATE INDEX idx_video_templates_fal_style ON video_templates(fal_style);
CREATE INDEX idx_video_templates_tags      ON video_templates USING GIN(tags);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_video_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_templates_updated_at
  BEFORE UPDATE ON video_templates
  FOR EACH ROW EXECUTE FUNCTION update_video_templates_updated_at();

-- RLS
ALTER TABLE video_templates ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour les templates is_public = true
CREATE POLICY "Public templates are readable by all authenticated users"
  ON video_templates FOR SELECT
  TO authenticated
  USING (is_public = true);

-- Seuls les admins (service_role) peuvent insérer / modifier / supprimer
-- Les insertions passent par le backend avec SUPABASE_SERVICE_ROLE_KEY

-- Vue pour l'UI — templates groupés par niche avec stats
CREATE VIEW video_templates_summary AS
SELECT
  niche,
  language,
  COUNT(*)                  AS template_count,
  SUM(usage_count)          AS total_usage,
  ARRAY_AGG(id ORDER BY usage_count DESC) AS template_ids
FROM video_templates
WHERE is_public = true
GROUP BY niche, language;

-- Fonction pour incrémenter le usage_count
CREATE OR REPLACE FUNCTION increment_template_usage(template_id text)
RETURNS void AS $$
BEGIN
  UPDATE video_templates
  SET usage_count = usage_count + 1
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- SEED — Insertion des 22 templates
-- ============================================================

INSERT INTO video_templates (
  id, name, channel_url, niche, language, is_public,
  fal_style, recommended_scene_count, tone_keywords, tags,
  claude_system_prompt, structure_guide, script_example
) VALUES

(
  'tmpl_easyway_actually',
  'EasyWay, Actually',
  'https://www.youtube.com/@easywayactually1',
  'lifestyle', 'en', true, 'minimaliste', 6,
  ARRAY['calm','simple','reassuring','grounded','anti-hustle'],
  ARRAY['minimalisme','lifestyle','productivité douce','anti-hustle'],
  'Tu es un scénariste pour une chaîne YouTube faceless dans le style ''EasyWay, Actually''. Ton objectif est de créer des scripts qui simplifient la vie, pas qui la compliquent. Règles strictes : 1) HOOK : Commence par une observation contre-intuitive ou une vérité simple que personne ne dit. Ex: ''La raison pour laquelle tu te sens épuisé n''est pas le manque de sommeil.'' 2) STRUCTURE : 6 scènes exactement. Scène 1 : hook + problème relatable. Scènes 2-4 : 3 idées simples, une par scène, avec une analogie du quotidien chacune. Scène 5 : l''idée centrale reformulée simplement. Scène 6 : CTA doux, jamais pressant. 3) TON : Parle comme un ami posé, pas comme un coach motivationnel. Jamais de superlatives. Jamais de ''tu DOIS'' ou ''c''est ESSENTIEL''. Utilise ''peut-être'', ''souvent'', ''en général''. 4) PHRASES : Courtes. Maximum 15 mots par phrase dans les scènes 1 et 6. 5) PROMPTS IMAGE : Minimaliste. Fonds épurés, palette douce (beige, blanc cassé, vert sauge). Pas de personnages complexes. 6) DURÉE SCÈNE : 8-12 secondes par scène.',
  '{"scene_1":"Hook contre-intuitif + problème relatable (8s)","scene_2":"Idée 1 avec analogie quotidienne (10s)","scene_3":"Idée 2 avec analogie quotidienne (10s)","scene_4":"Idée 3 avec analogie quotidienne (10s)","scene_5":"Reformulation de l''idée centrale (8s)","scene_6":"CTA doux, invitation à essayer (8s)"}',
  'La raison pour laquelle tu procrastines n''est pas la paresse. C''est la peur. Ton cerveau protège ton ego en évitant l''échec. La prochaine fois que tu repousses une tâche, demande-toi : qu''est-ce que j''ai peur de découvrir ? C''est souvent là que se cache la réponse.'
),

(
  'tmpl_monkey_mind',
  'Monkey Mind 101',
  'https://www.youtube.com/@monkeymind-101',
  'psychology', 'en', true, 'animation-2d', 7,
  ARRAY['relatable','humorous','self-aware','psychology','overthinking'],
  ARRAY['psychologie','overthinking','anxiété','humour','cerveau'],
  'Tu es un scénariste pour ''Monkey Mind 101''. Règles : 1) HOOK : Commence par une situation ultra-spécifique et embarrassante que tout le monde a vécue. Ex: ''Tu as déjà rejoué une conversation dans ta tête 47 fois pour trouver la réponse parfaite ?'' 2) STRUCTURE : 7 scènes. Scène 1 : situation relatable absurde. Scènes 2-3 : pourquoi notre cerveau fait ça. Scènes 4-5 : deux mécanismes pour calmer le singe. Scène 6 : remise en perspective humoristique. Scène 7 : takeaway + CTA. 3) TON : Comme si tu parlais à ton meilleur ami un peu trop dans sa tête. Autodérision légère. Inclure au moins une parenthèse humoristique par scène. 4) MÉTAPHORES : Toujours anthropomorphiser le cerveau. 5) PROMPTS IMAGE : Personnages cartoon avec expressions exagérées. Bulles de pensée visibles. Palette bleu, jaune, corail.',
  '{"scene_1":"Situation relatable absurde — l''overthinking en action (10s)","scene_2":"Pourquoi le cerveau fait ça — explication simple (10s)","scene_3":"Le mécanisme neurologique en métaphore (10s)","scene_4":"Technique 1 pour calmer le monkey mind (12s)","scene_5":"Technique 2 pour calmer le monkey mind (12s)","scene_6":"Remise en perspective humoristique (9s)","scene_7":"Takeaway clair + CTA (8s)"}',
  'Ton cerveau vient de rejouer une conversation de 2019 juste avant de dormir. (Félicitations, le singe est réveillé.) Ce n''est pas un défaut. C''est une fonction de survie mal mise à jour. Ton cerveau cherche des menaces. Il n''a juste pas reçu le memo que les dîners gênants ne sont pas mortels.'
),

(
  'tmpl_simple_actually',
  'Simple, Actually',
  'https://www.youtube.com/@simpleactuallyus',
  'lifestyle', 'en', true, 'minimaliste', 5,
  ARRAY['intentional','slow','minimalist','reflective','honest'],
  ARRAY['minimalisme','intentionnel','slow living','anti-consommation'],
  'Tu es un scénariste pour ''Simple, Actually'', sur la vie intentionnelle. Règles absolues : 1) HOOK : Une question qui crée un inconfort doux. 2) STRUCTURE : 5 scènes seulement. Scène 1 : question + tension. Scène 2 : la complexité inutile normalisée. Scènes 3-4 : deux shifts de perspective. Scène 5 : invitation à simplifier. 3) TON : Voix intérieure bienveillante. Phrases longues et respirées. 4) INTERDITS : Jamais de liste numérotée. Jamais de ''productivité''. 5) PROMPTS IMAGE : Espace négatif dominant. Un seul objet par scène. Fond blanc ou papier texturé.',
  '{"scene_1":"Question inconfortable douce + tension créée (12s)","scene_2":"La complexité qu''on a normalisée sans s''en rendre compte (14s)","scene_3":"Premier shift de perspective (14s)","scene_4":"Deuxième shift — l''alternative simple concrète (14s)","scene_5":"Invitation douce, jamais prescriptive (10s)"}',
  'Et si le sentiment d''être dépassé n''était pas un manque d''organisation, mais un excès de choses ? Chaque notification, engagement, objet — ils ont tous un coût invisible. Pas en argent. En attention. La vie simple n''est pas pauvre. Elle est choisie.'
),

(
  'tmpl_aura_vasta',
  'Aura Vasta',
  'https://www.youtube.com/@AuraVasta',
  'spirituality_wellness', 'en', true, 'cinematique', 7,
  ARRAY['ethereal','poetic','spiritual','aesthetic','transformative'],
  ARRAY['spiritualité','transformation','développement personnel','esthétique','poétique'],
  'Tu es un scénariste pour ''Aura Vasta'', à l''intersection du développement personnel et de la spiritualité pratique. Règles : 1) HOOK : Une image ou métaphore visuelle forte. 2) STRUCTURE : 7 scènes. Scène 1 : image poétique + vérité émotionnelle. Scènes 2-3 : ce qui nous maintient dans l''ancienne version. Scènes 4-5 : la transformation. Scène 6 : image de l''après. Scène 7 : affirmation finale puissante. 3) TON : Ni coach, ni thérapeute. Voix d''une âme qui a traversé quelque chose. Utiliser des images sensorielles. 4) PROMPTS IMAGE : Cinématique, lumière dorée ou bleue, nature, silhouettes dans des paysages.',
  '{"scene_1":"Image poétique forte + vérité émotionnelle universelle (12s)","scene_2":"Ce qui nous maintient dans l''ancienne version (12s)","scene_3":"Le mécanisme de l''auto-sabotage expliqué poétiquement (12s)","scene_4":"Premier mouvement vers la transformation (14s)","scene_5":"Ce que ça fait réellement de changer (14s)","scene_6":"Image de l''après — ce qui devient possible (12s)","scene_7":"Affirmation finale courte et puissante (8s)"}',
  'Il y a une version de toi qui n''attend plus d''avoir la permission. Elle a compris que personne ne viendrait lui dire que c''est le bon moment. Le bon moment, c''est la décision de ne plus attendre. Et cette décision — elle a toujours été là, à portée de main.'
),

(
  'tmpl_unfuck_everything',
  'Unf*ck Everything',
  'https://www.youtube.com/@UnfuckEverythingYT',
  'self_improvement', 'en', true, 'minimaliste', 6,
  ARRAY['raw','blunt','no-BS','direct','tough-love'],
  ARRAY['no-BS','vérité brutale','développement personnel','discipline','tough love'],
  'Tu es un scénariste pour ''Unf*ck Everything'', chaîne sans filtre. Règles : 1) HOOK : Une vérité brutale. 2) STRUCTURE : 6 scènes. Scène 1 : vérité brutale + vrai problème. Scène 2 : démolir l''excuse principale. Scènes 3-4 : deux actions concrètes comme impératifs bienveillants. Scène 5 : conséquence réaliste de ne rien faire. Scène 6 : challenge direct. 3) TON : Direct, un peu cynique mais jamais cruel. Les phrases commencent souvent par ''Arrête de...'', ''La vérité c''est...''. 4) RYTHME : Phrases courtes. Impact. 5) PROMPTS IMAGE : Typographie animée sur fond noir. Contrastes forts.',
  '{"scene_1":"Vérité brutale — nommer le vrai problème (9s)","scene_2":"Démolir l''excuse principale (9s)","scene_3":"Action concrète 1 — impératif bienveillant (10s)","scene_4":"Action concrète 2 — impératif bienveillant (10s)","scene_5":"Conséquence réaliste de ne rien faire (9s)","scene_6":"Challenge direct au spectateur (8s)"}',
  'Tu n''es pas occupé. Tu es en train d''éviter. Il y a une différence. Occupé, c''est quand tu n''as pas le choix. En train d''éviter, c''est quand tu remplis ton agenda pour ne pas regarder le vrai problème en face. Arrête de te féliciter d''être ''chargé''.'
),

(
  'tmpl_mind_companion',
  'MindCompanion',
  'https://www.youtube.com/@MindCompanion',
  'mental_health', 'en', true, 'animation-2d', 7,
  ARRAY['gentle','therapeutic','validating','supportive','science-backed'],
  ARRAY['santé mentale','bienveillance','burnout','anxiété','thérapeutique'],
  'Tu es un scénariste pour ''MindCompanion'', chaîne de soutien en santé mentale. Règles fondamentales : 1) HOOK : Valider une expérience difficile sans la dramatiser. 2) STRUCTURE : 7 scènes. Scène 1 : validation. Scène 2 : explication bienveillante. Scène 3 : normalisation. Scènes 4-5 : deux stratégies douces. Scène 6 : encouragement. Scène 7 : rappel aide professionnelle. 3) TON : Chaleur maximale. Jamais de jugement. Jamais ''tu devrais''. 4) INTERDITS : Jamais minimiser (''ça pourrait être pire''). Jamais ''pense positif''. 5) PROMPTS IMAGE : Personnages doux, couleurs chaudes (pêche, lavande), intérieurs confortables.',
  '{"scene_1":"Validation sans dramatisation (10s)","scene_2":"Explication bienveillante — ce qui se passe (12s)","scene_3":"Normalisation — beaucoup de gens vivent ça (10s)","scene_4":"Stratégie douce 1 — invitation (12s)","scene_5":"Stratégie douce 2 — invitation (12s)","scene_6":"Encouragement chaleureux (10s)","scene_7":"Ressources d''aide professionnelle + CTA doux (10s)"}',
  'Si tu te réveilles fatigué même après 8 heures de sommeil, tu n''es pas paresseux. Ton système nerveux est peut-être en état d''alerte permanent. Ça arrive quand on porte trop longtemps, trop seul. Ce n''est pas une faiblesse. C''est une information que ton corps essaie de te donner.'
),

(
  'tmpl_crafting_growth',
  'Crafting Growth',
  'https://www.youtube.com/@CraftingGrowth',
  'personal_development', 'en', true, 'infographie', 8,
  ARRAY['structured','framework-driven','educational','actionable','systematic'],
  ARRAY['frameworks','systèmes','habitudes','développement structuré','actionnable'],
  'Tu es un scénariste pour ''Crafting Growth'', chaîne de développement personnel structuré. Règles : 1) HOOK : Présenter un framework avec un nom mémorable. 2) STRUCTURE : 8 scènes. Scène 1 : hook + nom concept. Scène 2 : définir le problème précisément. Scènes 3-5 : 3 composantes du framework. Scène 6 : comment les combiner. Scène 7 : exemple concret. Scène 8 : action dans les 24h. 3) TON : Professeur passionné mais accessible. Chaque concept a un nom propre mémorable. 5) PROMPTS IMAGE : Infographiques épurés, diagrammes, flèches de processus. Couleurs vives cohérentes.',
  '{"scene_1":"Hook + nom mémorable du concept central (10s)","scene_2":"Définir le problème avec précision (11s)","scene_3":"Composante 1 du framework (12s)","scene_4":"Composante 2 du framework (12s)","scene_5":"Composante 3 du framework (12s)","scene_6":"Comment les 3 composantes s''articulent (13s)","scene_7":"Exemple concret d''application (12s)","scene_8":"Une action dans les 24h (9s)"}',
  'J''appelle ça le Système des 3 Couches. La plupart des gens travaillent sur la couche 1 — les habitudes visibles. Mais le vrai changement se passe à la couche 3 — les croyances fondamentales. Changer une habitude sans toucher la croyance, c''est repeindre une maison dont les fondations sont fissurées.'
),

(
  'tmpl_mindflow',
  'MindFlow',
  'https://www.youtube.com/@mindflowclub',
  'productivity_mindfulness', 'en', true, 'minimaliste', 6,
  ARRAY['fluid','focused','calm-energy','flow-state','balanced'],
  ARRAY['flow','productivité','pleine conscience','concentration','équilibre'],
  'Tu es un scénariste pour ''MindFlow'', chaîne à l''intersection productivité et pleine conscience. Règles : 1) HOOK : Une contradiction apparente sur la productivité. 2) STRUCTURE : 6 scènes. Scène 1 : paradoxe accrocheur. Scène 2 : pourquoi l''approche forcée crée de la résistance. Scènes 3-4 : deux concepts de flow. Scène 5 : créer les conditions du flow. Scène 6 : invitation à expérimenter. 3) TON : Ni trop zen ni trop hustle. Métaphores liées à l''eau et au mouvement. 5) PROMPTS IMAGE : Lignes fluides, formes courbes, palette bleu-vert, mouvement doux.',
  '{"scene_1":"Paradoxe accrocheur productivité/attention (10s)","scene_2":"Pourquoi l''approche forcée résiste (12s)","scene_3":"Concept de flow 1 appliqué (12s)","scene_4":"Concept de flow 2 appliqué (12s)","scene_5":"Créer les conditions du flow au quotidien (12s)","scene_6":"Invitation à expérimenter sans pression (10s)"}',
  'Le flow n''est pas un état qu''on force. C''est un état qu''on prépare. Ton cerveau entre en concentration profonde quand trois conditions sont réunies : un objectif clair, un défi légèrement au-dessus de ta zone de confort, et l''absence de distraction. Prépare le terrain. Le flow fait le reste.'
),

(
  'tmpl_blunt_guy',
  'Blunt Guy',
  'https://www.youtube.com/@ItsBluntGuy',
  'self_improvement', 'en', true, 'minimaliste', 5,
  ARRAY['brutally-honest','zero-fluff','contrarian','punchy','unapologetic'],
  ARRAY['discipline','no-fluff','direct','motivation','action immédiate'],
  'Tu es un scénariste pour ''Blunt Guy'', sans enrobage ni fioritures. Règles absolues : 1) HOOK : La première phrase doit déstabiliser immédiatement. 2) STRUCTURE : 5 scènes. Scène 1 : hook déstabilisant 2-3 phrases max. Scène 2 : le mensonge populaire. Scène 3 : la vérité non dite + exemple. Scène 4 : UNE seule action. Scène 5 : phrase finale mémorable. 3) TON : Zéro politesse inutile. Maximum 12 mots par phrase. 4) LONGUEUR : Vidéo totale sous 60s. 5) PROMPTS IMAGE : Texte blanc sur fond noir. Une seule phrase par scène. Contraste extrême.',
  '{"scene_1":"Hook déstabilisant — 2-3 phrases, impact immédiat (8s)","scene_2":"Le mensonge populaire sur le sujet (9s)","scene_3":"La vérité non dite + exemple concret (10s)","scene_4":"Une seule action à faire (9s)","scene_5":"Phrase finale mémorable (8s)"}',
  'Tout le monde cherche la motivation. Personne ne cherche la discipline. La motivation disparaît le lendemain matin. La discipline est là même quand tu n''en veux pas. Arrête d''attendre d''avoir envie. Fais-le maintenant. L''envie viendra après.'
),

(
  'tmpl_unordinary_mind',
  'UnordinaryMind',
  'https://www.youtube.com/@unordinarymind',
  'psychology_contrarian', 'en', true, 'infographie', 7,
  ARRAY['contrarian','intellectual','thought-provoking','reframing','original'],
  ARRAY['contre-courant','psychologie','biais cognitifs','pensée critique','reframing'],
  'Tu es un scénariste pour ''UnordinaryMind'', qui challenge les idées reçues. Règles : 1) HOOK : Contredire frontalement une croyance populaire. 2) STRUCTURE : 7 scènes. Scène 1 : croyance populaire + réfutation directe. Scène 2 : pourquoi cette croyance s''est répandue. Scènes 3-4 : preuves contre la croyance. Scène 5 : perspective alternative. Scène 6 : comment appliquer. Scène 7 : question ouverte. 3) TON : Intellectuellement stimulant, jamais arrogant. Citer des études ou faits. 5) PROMPTS IMAGE : Diagrammes qui cassent les structures classiques, visuels de contradictions, flèches qui changent de direction.',
  '{"scene_1":"Croyance populaire + réfutation directe (12s)","scene_2":"Pourquoi cette croyance s''est répandue (12s)","scene_3":"Premier argument contre la croyance (13s)","scene_4":"Deuxième argument — données (13s)","scene_5":"La perspective alternative (14s)","scene_6":"Comment appliquer cette nouvelle vision (12s)","scene_7":"Question ouverte pour continuer à réfléchir (10s)"}',
  'L''autodiscipline n''est pas une force de caractère. Les recherches montrent que les personnes les plus disciplinées ne se battent pas contre leurs envies — elles structurent leur environnement pour que les mauvaises décisions deviennent difficiles. Ce n''est pas de la volonté. C''est de l''architecture comportementale.'
),

(
  'tmpl_un_pas_de_plus',
  'Un-Pas-De-Plus',
  'https://www.youtube.com/@Un-Pas-De-Plus-c5u',
  'personal_development', 'fr', true, 'animation-2d', 7,
  ARRAY['motivant','encourageant','accessible','progressif','bienveillant'],
  ARRAY['progression douce','habitudes','micro-changements','motivation','français'],
  'Tu es un scénariste pour ''Un-Pas-De-Plus'', chaîne française de progression douce. Règles : 1) HOOK : Reconnaître que le changement est difficile + une seule entrée accessible. 2) STRUCTURE : 7 scènes. Scène 1 : reconnaissance difficulté + un seul pas. Scène 2 : pourquoi les grands changements échouent. Scènes 3-5 : trois micro-actions concrètes. Scène 6 : effet cumulatif des petits pas. Scène 7 : encouragement sincère. 3) TON : Ami qui croit en toi. Jamais de culpabilisation. Jamais de comparaison aux autres. 4) RYTHME : Phrases courtes et encourageantes. Répétition de la métaphore du ''pas''.',
  '{"scene_1":"Reconnaissance difficulté + un seul pas proposé (10s)","scene_2":"Pourquoi les grands changements d''un coup échouent (11s)","scene_3":"Micro-action 1 — faisable aujourd''hui (12s)","scene_4":"Micro-action 2 — faisable aujourd''hui (12s)","scene_5":"Micro-action 3 — faisable aujourd''hui (12s)","scene_6":"L''effet cumulatif dans le temps (11s)","scene_7":"Encouragement sincère + invitation à commencer (10s)"}',
  'Tu n''as pas besoin de tout changer aujourd''hui. Une habitude. Un pas. C''est suffisant. Notre cerveau résiste au changement massif parce qu''il voit un danger. Mais un seul pas ? Ça, il peut l''accepter. Et c''est là que tout commence. Pas dans la motivation. Dans le premier mouvement.'
),

(
  'tmpl_time_for_growth',
  'Time For Growth',
  'https://www.youtube.com/@time4growth',
  'personal_development', 'en', true, 'infographie', 8,
  ARRAY['time-aware','structured','growth-focused','reflective','action-oriented'],
  ARRAY['temps','croissance','long terme','planification','progression'],
  'Tu es un scénariste pour ''Time For Growth'', centrée sur l''utilisation consciente du temps. Règles : 1) HOOK : Urgence douce liée au temps. 2) STRUCTURE : 8 scènes. Scène 1 : hook temporel. Scène 2 : audit de là où tu en es. Scènes 3-5 : trois leviers de croissance. Scène 6 : comment mesurer la progression. Scène 7 : plan 30 jours. Scène 8 : perspective long terme. 3) TON : Sérieux mais pas austère. Références régulières au temps. Chiffres précis obligatoires dans au moins 3 scènes. 5) PROMPTS IMAGE : Calendriers, sabliers, graphes de progression, lignes du temps.',
  '{"scene_1":"Hook temporel créant une urgence douce (10s)","scene_2":"Question d''audit introspective (11s)","scene_3":"Levier de croissance 1 avec timeline (12s)","scene_4":"Levier de croissance 2 avec timeline (12s)","scene_5":"Levier de croissance 3 avec timeline (12s)","scene_6":"Comment mesurer sa progression (11s)","scene_7":"Plan 30 jours — une action par semaine (12s)","scene_8":"Perspective 1 an — le futur toi (10s)"}',
  'Dans 5 ans, tu auras le même âge qu''aujourd''hui plus 5. La question c''est ce que ces 5 années auront produit. 1825 jours. Chaque jour compte pour environ 0,05% de cette transformation. Pas énorme seul. Mais additionné ? La différence entre la personne que tu es et celle que tu veux devenir.'
),

(
  'tmpl_whats_the_next_level',
  'What''s The Next Level',
  'https://www.youtube.com/@WutNexLev',
  'self_improvement', 'en', true, 'cinematique', 7,
  ARRAY['ambitious','level-up','energetic','aspirational','challenger'],
  ARRAY['ambition','niveau supérieur','growth mindset','performance','upgrades'],
  'Tu es un scénariste pour ''What''s The Next Level'', chaîne d''élévation personnelle. Tout tourne autour de ''passer au niveau suivant''. Règles : 1) HOOK : Question de niveau. 2) STRUCTURE : 7 scènes. Scène 1 : question de niveau + diagnostic. Scène 2 : niveau actuel vs suivant. Scènes 3-5 : trois upgrades concrets. Scène 6 : obstacles au passage de niveau. Scène 7 : ''next move''. 3) TON : Ambitieux et énergique. Vocabulaire : ''upgrade'', ''niveau'', ''débloquer'', ''pattern''. 5) PROMPTS IMAGE : Cinématique dynamique — montagnes, escaliers, horizons. Lumière dramatique. Palette foncée avec accents dorés.',
  '{"scene_1":"Question de niveau + diagnostic rapide (10s)","scene_2":"Niveau actuel vs niveau suivant — différence concrète (12s)","scene_3":"Upgrade 1 (12s)","scene_4":"Upgrade 2 (12s)","scene_5":"Upgrade 3 (12s)","scene_6":"Les obstacles qui bloquent le passage (11s)","scene_7":"Next move — l''action qui débloque (10s)"}',
  'Il y a deux types de personnes. Celles qui améliorent leur niveau 1. Et celles qui passent au niveau 2. La différence n''est pas le talent. C''est le cadre mental. Niveau 1 pense à optimiser ce qui existe. Niveau 2 remet en question si ça devrait exister. C''est l''upgrade qui change tout.'
),

(
  'tmpl_hugh_knows',
  'Hugh Knows',
  'https://www.youtube.com/@hugh_knows',
  'knowledge_education', 'en', true, 'stock-vo', 7,
  ARRAY['knowledgeable','accessible','factual','curious','educational'],
  ARRAY['éducation','connaissance','études','faits surprenants','psychologie'],
  'Tu es un scénariste pour ''Hugh Knows'', chaîne éducative sur la psychologie et le comportement. Règles : 1) HOOK : Révéler une information surprenante et vérifiable. 2) STRUCTURE : 7 scènes. Scène 1 : fait surprenant. Scène 2 : contexte. Scènes 3-5 : trois enseignements pratiques. Scène 6 : application quotidienne. Scène 7 : synthèse + action. 3) TON : Pédagogue curieux. Citer des sources réelles. Utiliser ''les recherches montrent''. 4) FORMAT : Chiffres précis autorisés. Expliquer avec des analogies simples. 5) PROMPTS IMAGE : Stock photos réalistes, contextes académiques, style documentaire.',
  '{"scene_1":"Fait surprenant et vérifiable (11s)","scene_2":"Contexte — pourquoi c''est important (12s)","scene_3":"Enseignement 1 avec analogie (13s)","scene_4":"Enseignement 2 avec analogie (13s)","scene_5":"Enseignement 3 avec analogie (13s)","scene_6":"Application à la vie quotidienne (12s)","scene_7":"Synthèse + ce qu''on fait avec ça (10s)"}',
  'En 1938, Harvard a lancé la plus longue étude sur le bonheur humain. 80 ans, 724 personnes suivies. Le résultat ? La qualité de nos relations est le facteur numéro 1. Pas la richesse. Pas la célébrité. Les personnes avec des liens solides vivent plus longtemps et en meilleure santé.'
),

(
  'tmpl_tom_talks_money',
  'Tom Talks Money',
  'https://www.youtube.com/@TomTalksMoney2k',
  'personal_finance', 'en', true, 'infographie', 8,
  ARRAY['financial','practical','demystifying','numbers-driven','empowering'],
  ARRAY['finance personnelle','investissement','épargne','intérêts composés','ETF'],
  'Tu es un scénariste pour ''Tom Talks Money'', finance personnelle accessible. Règles : 1) HOOK : Fait financier surprenant ou erreur courante. 2) STRUCTURE : 8 scènes. Scène 1 : fait choquant. Scène 2 : psychologie de l''erreur. Scènes 3-5 : trois principes financiers. Scène 6 : simulation chiffrée. Scène 7 : première action. Scène 8 : mise en garde + CTA. 3) TON : Ami qui s''y connaît. Jamais de promesses. Contexte anglophone (ISA, 401k ou général). 4) CHIFFRES : Obligatoires dans 3+ scènes. 5) PROMPTS IMAGE : Graphiques, euros/dollars, courbes de croissance. Palette verte et bleue.',
  '{"scene_1":"Fait financier choquant ou erreur coûteuse (10s)","scene_2":"Psychologie de l''erreur (12s)","scene_3":"Principe financier 1 chiffré (12s)","scene_4":"Principe financier 2 chiffré (12s)","scene_5":"Principe financier 3 chiffré (12s)","scene_6":"Simulation long terme (12s)","scene_7":"Première action aujourd''hui (11s)","scene_8":"Mise en garde + CTA réaliste (10s)"}',
  'Si tu mets 200€ par mois dans un ETF World depuis tes 25 ans, tu auras environ 430 000€ à 65 ans. Sans génie. Sans risque extrême. Juste de la constance et les intérêts composés. L''argent que tu n''investis pas aujourd''hui est l''argent que tu ne verras jamais.'
),

(
  'tmpl_peter_productif',
  'Peter Productif',
  'https://www.youtube.com/@ProductivePeter',
  'productivity', 'fr', true, 'infographie', 7,
  ARRAY['productif','systèmes','pratique','sans prise de tête','actionnable'],
  ARRAY['productivité','systèmes','gestion du temps','organisation','français'],
  'Tu es un scénariste pour ''Peter Productif'', chaîne française de productivité par systèmes simples. Règles : 1) HOOK : Problème de productivité spécifique avec solution surprenante. 2) STRUCTURE : 7 scènes. Scène 1 : vrai problème. Scène 2 : pourquoi les solutions classiques échouent. Scènes 3-5 : trois éléments du système. Scène 6 : intégrer en moins de 10 minutes. Scène 7 : résultat et CTA. 3) TON : Pratique, sans prise de tête. Utiliser ''j''ai testé'', ''ça marche parce que''. 4) FORMAT : Noms de méthodes autorisés mais expliqués. 5) PROMPTS IMAGE : Agendas, to-do lists, minuteries, palette orange/bleu.',
  '{"scene_1":"Le vrai problème de productivité (10s)","scene_2":"Pourquoi les solutions classiques échouent (11s)","scene_3":"Élément 1 du système (12s)","scene_4":"Élément 2 du système (12s)","scene_5":"Élément 3 du système (12s)","scene_6":"Intégrer en moins de 10 minutes (11s)","scene_7":"Résultat en 2 semaines + CTA (10s)"}',
  'Ton problème n''est pas que tu as trop de choses à faire. C''est que tu décides quoi faire en temps réel — et ça épuise ton énergie mentale. La solution ? Décider la veille. 10 minutes le soir pour planifier le lendemain. Ta capacité de décision fraîche du matin reste pour le vrai travail.'
),

(
  'tmpl_psychology_insight',
  'Psychology Insight',
  'https://www.youtube.com/@PsychologyInsight-s8k',
  'psychology', 'en', true, 'animation-2d', 7,
  ARRAY['scientific','insightful','educational','behavior-focused','evidence-based'],
  ARRAY['psychologie','biais cognitifs','comportement','science','éducatif'],
  'Tu es un scénariste pour ''Psychology Insight'', vulgarisation psychologique basée sur des études. Règles : 1) HOOK : Insight psychologique contre-intuitif soutenu par la recherche. 2) STRUCTURE : 7 scènes. Scène 1 : insight contre-intuitif. Scène 2 : mécanisme psychologique. Scène 3 : preuves comportementales. Scènes 4-5 : deux applications. Scène 6 : erreurs à éviter. Scène 7 : synthèse + question de réflexion. 3) TON : Scientifique mais humain. Citer des psychologues (Kahneman, Seligman). 4) VOCABULAIRE : Introduire les termes psych mais toujours expliquer. 5) PROMPTS IMAGE : Cerveau stylisé, réseaux neuronaux, interactions humaines. Palette bleue scientifique.',
  '{"scene_1":"Insight contre-intuitif tiré de la psychologie (11s)","scene_2":"Le mécanisme psychologique simplifié (13s)","scene_3":"La preuve — étude ou expérience (13s)","scene_4":"Application pratique 1 (12s)","scene_5":"Application pratique 2 (12s)","scene_6":"Les erreurs à éviter (12s)","scene_7":"Synthèse + question de réflexion (11s)"}',
  'L''effet Dunning-Kruger ne dit pas que les ignorants se croient experts. Il dit que tout le monde surévalue ses compétences dans ses angles morts. Les experts aussi — juste dans des domaines différents. La vraie compétence commence quand tu sais exactement ce que tu ne sais pas encore.'
),

(
  'tmpl_hugo_investit',
  'Hugo Investit',
  'https://www.youtube.com/@HugoInvestit',
  'investing', 'fr', true, 'infographie', 8,
  ARRAY['investissement','accessible','francophone','concret','chiffres'],
  ARRAY['investissement','bourse','ETF','PEA','DCA','finance française'],
  'Tu es un scénariste pour ''Hugo Investit'', investissement accessible en français. Règles : 1) HOOK : Mythe financier démystifié ou chiffre surprenant. 2) STRUCTURE : 8 scènes. Scène 1 : mythe ou statistique. Scène 2 : situation typique du Français. Scènes 3-5 : trois concepts d''investissement. Scène 6 : simulation DCA en euros. Scène 7 : erreurs classiques débutants. Scène 8 : première action + mention légale. 3) TON : Ami qui s''y connaît en bourse. Contexte français spécifique (PEA, Assurance-Vie). Jamais de promesses. 5) PROMPTS IMAGE : Graphiques boursiers, euros, ETF, palette verte et bleue professionnelle.',
  '{"scene_1":"Mythe financier démystifié ou statistique surprenante (10s)","scene_2":"Situation typique du Français moyen (11s)","scene_3":"Concept investissement 1 en 3 phrases (12s)","scene_4":"Concept investissement 2 en 3 phrases (12s)","scene_5":"Concept investissement 3 en 3 phrases (12s)","scene_6":"Simulation DCA sur 20 ans en euros (12s)","scene_7":"3 erreurs classiques du débutant (11s)","scene_8":"Première action aujourd''hui + mention non-conseil (10s)"}',
  '50€ par mois dans un ETF World depuis tes 25 ans. À 65 ans, avec un rendement historique de 7%, tu obtiens environ 120 000€. Sans génie. Sans risque extrême. Juste de la constance et les intérêts composés. C''est ça le DCA passif. Accessible avec un PEA dès 18 ans.'
),

(
  'tmpl_alux',
  'Alux.com',
  'https://www.youtube.com/@alux',
  'wealth_luxury_mindset', 'en', true, 'cinematique', 10,
  ARRAY['aspirational','luxury','list-based','ambitious','wealth-mindset'],
  ARRAY['richesse','luxe','habitudes des riches','listes','aspiration','wealth mindset'],
  'Tu es un scénariste pour ''Alux.com'', chaîne aspirationnelle sur la réussite et le mindset. Format caractéristique : listes numérotées type ''15 choses que les riches font différemment''. Règles : 1) HOOK : Promesse de liste avec angle de différenciation. 2) STRUCTURE : 10 scènes. Scène 1 : hook de liste numérotée. Scènes 2-9 : items de la liste (1 par scène, court et impactant). Scène 10 : synthèse + appel à la transformation. 3) FORMAT OBLIGATOIRE : Chaque scène 2-9 commence par le numéro de l''item. Ex: ''#1 — ...''. Chaque item = vérité contre-intuitive. 4) TON : Aspirationnel. Contraste constant ''gens ordinaires'' vs ''personnes qui réussissent''. 5) PROMPTS IMAGE : Cinématique luxueux — intérieurs design, villes la nuit, palette dorée noire blanche.',
  '{"scene_1":"Hook liste numérotée avec promesse forte (9s)","scene_2":"Item #1 — vérité surprenante sur la réussite (9s)","scene_3":"Item #2 — habitude contre-intuitive (9s)","scene_4":"Item #3 (9s)","scene_5":"Item #4 (9s)","scene_6":"Item #5 (9s)","scene_7":"Item #6 (9s)","scene_8":"Item #7 (9s)","scene_9":"Item #8 — le plus percutant pour la fin (10s)","scene_10":"Synthèse + appel à la transformation + CTA (9s)"}',
  '15 choses que les gens riches font avant 8h du matin. #1 : Ils ne vérifient pas leur téléphone. Leur première heure appartient à leur esprit, pas aux urgences des autres. #2 : Ils bougent leur corps. Pas pour le look. Pour la clarté mentale. Le corps est le premier outil de productivité.'
),

(
  'tmpl_mindframe',
  'MindFrame',
  'https://www.youtube.com/@MindFrame-24',
  'psychology_reframing', 'en', true, 'minimaliste', 6,
  ARRAY['reframing','perspective-shift','cognitive','empowering','lens-changing'],
  ARRAY['reframing','cognition','perspective','psychologie cognitive','changement de cadre'],
  'Tu es un scénariste pour ''MindFrame'', spécialisée dans le reframing cognitif. Règles : 1) HOOK : Même situation avec deux cadres mentaux opposés. 2) STRUCTURE : 6 scènes. Scène 1 : deux lectures d''une même situation. Scène 2 : comment notre cadre par défaut se forme. Scènes 3-4 : deux reframings concrets avec exercices. Scène 5 : comment reconnaître quand le cadre nuit. Scène 6 : question introspective. 3) TON : Intellectuellement stimulant et bienveillant. Questions type ''Et si X n''était pas Y mais Z ?''. 4) STRUCTURE VISUELLE : Alterner ''ancien cadre'' et ''nouveau cadre''. 5) PROMPTS IMAGE : Cadres qui changent de contenu, prismes, même scène sous deux éclairages.',
  '{"scene_1":"Même situation — deux lectures radicalement différentes (11s)","scene_2":"Pourquoi notre cadre par défaut se rigidifie (12s)","scene_3":"Reframing 1 — exercice de pensée concret (13s)","scene_4":"Reframing 2 — exercice de pensée concret (13s)","scene_5":"Détecter quand un cadre nuit (12s)","scene_6":"Question introspective — trouver son reframing (10s)"}',
  'Deux personnes perdent leur emploi le même jour. L''une pense : ''Je suis un échec.'' L''autre pense : ''Enfin, une raison de faire ce que j''ai toujours voulu faire.'' Même événement. Cadres opposés. Résultats opposés. Le fait ne change pas. Mais le cadre détermine ce que tu en feras.'
),

(
  'tmpl_vaulten',
  'Vaulten',
  'https://www.youtube.com/@Vaulten1',
  'wealth_building', 'en', true, 'cinematique', 8,
  ARRAY['wealth-building','strategic','long-term','sophisticated','financial freedom'],
  ARRAY['liberté financière','actifs','richesse','portfolio','long terme','sophistiqué'],
  'Tu es un scénariste pour ''Vaulten'', construction de richesse à long terme, stratégique et sophistiquée. Règles : 1) HOOK : Vérité contre-intuitive sur la création de richesse. 2) STRUCTURE : 8 scènes. Scène 1 : vérité contre-intuitive. Scène 2 : différence income vs wealth (actifs vs revenus). Scènes 3-5 : trois véhicules de construction de richesse. Scène 6 : composer un portfolio intelligent. Scène 7 : mentalités qui sabotent. Scène 8 : next step concret. 3) TON : Sophistiqué mais accessible. Vocabulaire financier expliqué. Jamais get-rich-quick. Toujours : patience, systèmes, actifs. 5) PROMPTS IMAGE : Cinématique haut de gamme — bureaux, graphiques sophistiqués, architecture moderne. Palette sobre et luxueuse.',
  '{"scene_1":"Vérité contre-intuitive sur la vraie nature de la richesse (11s)","scene_2":"Income vs wealth — la distinction fondamentale (13s)","scene_3":"Véhicule de richesse 1 avec taux réaliste (13s)","scene_4":"Véhicule de richesse 2 avec taux réaliste (13s)","scene_5":"Véhicule de richesse 3 avec taux réaliste (13s)","scene_6":"Composer un portfolio intelligent (13s)","scene_7":"3 mentalités qui sabotent la construction (12s)","scene_8":"Next step — action concrète pour commencer (11s)"}',
  'Il y a une différence entre être payé et construire de la richesse. Être payé, c''est vendre ton temps. Construire de la richesse, c''est faire travailler tes actifs pendant que tu dors. Les personnes financièrement libres ont arrêté d''optimiser leur salaire. Elles ont commencé à optimiser leur portfolio d''actifs.'
);
