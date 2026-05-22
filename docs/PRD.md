# PRD.md — Product Requirements Document

**Projet :** CLYRO
**Version :** 2.0 MVP
**Date :** Avril 2026
**Statut :** En développement

---

## 1. Vision produit

### Problème
Les créateurs de contenu et équipes marketing perdent des dizaines d'heures par semaine à produire des vidéos et des identités visuelles. Faire appel à une agence coûte cher et prend du temps. Les outils actuels sont soit trop complexes, soit trop limités.

### Solution
CLYRO automatise la production vidéo et visuelle de bout en bout grâce à l'IA :
- Entrée : un script, un brief ou un logo
- Sortie : une vidéo MP4 professionnelle ou un brand kit complet prêt à l'emploi

### Proposition de valeur
> « De ton script à ta vidéo en moins de 10 minutes. De ton brief à ta charte graphique en moins de 15 minutes. Sans caméra, sans monteur, sans agence. »

---

## 2. Module 1 — Faceless Videos

Génération de vidéos pour chaînes YouTube/TikTok/Instagram avec personnages animés (style Tikman, Monkey Mind, Peakonomics).

### 6 styles visuels

| Style | Description | Modèle fal.ai | Usage typique |
|-------|-------------|---------------|---------------|
| Animation 2D | Personnages cartoon animés | flux-pro | Éducatif, storytelling |
| Stock + VO | Images stock réalistes + voix off | flux-pro-v1.1-ultra | News, tutoriels |
| Minimaliste | Typographie animée, design épuré | flux/dev | Citations, tips |
| Infographie | Données visualisées, icônes | flux/dev | Finance, stats |
| Whiteboard | Animation tableau blanc dessiné | flux/dev | Formation, explicatif |
| Cinématique | Plans cinéma, ambiance épique | flux-pro-v1.1-ultra | Motivation, lifestyle |

### Parcours utilisateur F1

```
1. SCRIPT & CONFIGURATION
   ├─ Coller ou écrire son script (50–5000 mots)
   ├─ Sélectionner le style visuel (grille avec exemples vidéo 10s)
   ├─ Choisir la voix ElevenLabs (bibliothèque publique ou voix clonée)
   ├─ Ajouter une description visuelle complémentaire (optionnel)
   └─ Choisir le format (9:16 TikTok / 16:9 YouTube)

2. DÉCOUPAGE EN SCÈNES (Claude AI — automatique)
   → 3 à 12 scènes selon longueur du script
   → Pour chaque scène : résumé narratif, durée estimée, prompt image,
     prompt animation, texte voix off
   → L'utilisateur peut ÉDITER chaque prompt avant génération
   → Drag-and-drop pour réordonner les scènes
   → Bouton "Améliorer via IA" sur chaque prompt (Claude explique les changements)

3. GÉNÉRATION IMAGES (fal.ai — preview-first)
   → Preview flux/schnell en 3s
   → HD flux-pro en arrière-plan (15s), remplace silencieusement
   → Comparaison avant/après pour les régénérations
   → Conserver jusqu'à 3 versions par scène

4. GÉNÉRATION VOIX OFF (ElevenLabs)
   → Audio + word timestamps par scène
   → Ajustement automatique des durées si audio > slot prévu
   → Player audio inline par scène
   → Régénérer avec ton ou vitesse différents

5. ANIMATION IMAGE → VIDÉO (fal.ai Kling)
   → Clip MP4 par scène (durée = audio + 0.5s buffer)
   → Player preview par clip
   → Régénérer avec prompt animation modifié

6. COMPOSITION FINALE (Remotion Lambda + FFmpeg)
   → Sous-titres karaoke synchronisés (word timestamps)
   → Mix voix off + musique de fond (ducking automatique)
   → Transitions entre scènes
   → Re-render partiel si une scène est modifiée

7. PREVIEW & TÉLÉCHARGEMENT
   → Player vidéo dans le navigateur
   → Export MP4 (9:16 ou 16:9, 1080p)
   → Email notification si l'utilisateur a quitté la page
   → Sauvegarde dans l'historique
```

---

## 3. Module 2 — Motion Design

Génération de vidéos pub/marketing style After Effects pour ads, présentations produit et contenus marketing.

### Formats supportés
- Réseaux sociaux : 9:16 (Stories/Reels), 1:1 (Feed), 16:9 (YouTube)
- Publicité : 6s bumper, 15s, 30s, 60s

### Parcours utilisateur F2

```
1. BRIEF CRÉATIF
   ├─ Objectif : pub / présentation / teaser / promo événement
   ├─ Textes et CTAs
   ├─ Upload logo ou assets de marque (SVG/PNG)
   ├─ Couleurs de marque (HEX)
   ├─ Style motion : corporatif minimaliste / énergique / luxe / tech / néon
   └─ Format + durée cible (15s / 30s / 60s)

2. STORYBOARD JSON (Claude AI — Motion Director)
   → JSON storyboard typé avec types de scènes Remotion exacts
   → Pour chaque scène : type, durée, texte, animation, couleurs, prompt visuel
   → Types disponibles : text_hero, split_text_image, product_showcase,
     stats_counter, cta_end, image_full
   → L'utilisateur peut éditer le texte de chaque slide inline
   → Modifier le type de scène dans une liste déroulante

3. GÉNÉRATION ASSETS VISUELS (fal.ai — preview-first)
   → Uniquement les scènes nécessitant une image
   → Modèle sélectionné automatiquement selon le type de contenu
   → Vérification automatique du contrast ratio WCAG (alerte si < 4.5:1)
   → Upload logo → Sharp normalisation + rembg si fond parasite

4. VOIX OFF (ElevenLabs — optionnel)
   → Recalcul automatique du timing si audio dépasse la durée de scène
   → Si dépassement > 3s : Claude propose de réécrire le texte plus court

5. RENDU (Remotion Lambda + FFmpeg)
   → Animations React/CSS dans chaque composant Remotion
   → Mix audio avec ducking
   → Thumbnail JPEG auto-généré (frame à t=3s) pour les ads

6. PREVIEW & EXPORT
   → MP4 + thumbnail téléchargeables
   → Variante créative à la demande (Claude propose un autre storyboard)
```

---

## 4. Module 3 — Brand Kit

Création complète d'une identité visuelle et d'une charte graphique depuis un brief et/ou des éléments existants.

### Parcours utilisateur F3

```
1. BRIEF DE MARQUE
   ├─ Nom de la marque
   ├─ Secteur d'activité
   ├─ Valeurs (3 mots clés)
   ├─ Ambiance souhaitée (luxe / accessible / tech / naturel / festif…)
   ├─ Cible (âge, persona)
   ├─ Concurrents à éviter (optionnel)
   └─ Éléments existants : logo, couleurs imposées, références visuelles (optionnel)

2. ANALYSE DU BRIEF (Claude — Brand Analyst)
   → Détection des contradictions (ex: "luxe" + "accessible à tous")
   → Vérification WCAG des couleurs imposées (contrast ratio)
   → Questions de clarification si brief insuffisant (max 3)
   → Identification de l'archétype de marque

3. TROIS DIRECTIONS CRÉATIVES (Claude — Creative Director)
   → Direction 1, 2, 3 — radicalement différentes
   → Chaque direction : palette 5 couleurs HEX, paire typographique
     Google Fonts, 5 adjectifs de mood, prompt logo recraft-v3
   → Logos × 3 générés en parallèle (recraft-v3, mode vector_illustration)
   → Affichage des 3 directions en cards avec logo, palette, specimen typo

4. SÉLECTION ET HYBRIDATION
   → L'utilisateur choisit une direction
   → Hybridation possible : palette D1 + typo D3 + logo D2
   → Claude génère un JSON cohérent + nouveau logo si hybride

5. GÉNÉRATION ASSETS (fal.ai × 8-12 en batches de 4)
   Ordre fixe : logos variantes → mockups → patterns → illustrations
   → Variantes logo (fond blanc / transparent / couleur) via rembg
   → Mockups lifestyle (carte de visite, email, post LinkedIn, packaging)
   → Patterns et textures secondaires
   → Planche photographique de style
   → Style anchor injecté dans chaque prompt pour cohérence

6. CHARTE GRAPHIQUE (Claude — Brand Charter Writer)
   → Markdown structuré 15-25 pages :
     logo_usage | colors | typography | grid | photography | do_dont
   → Inclut toutes les URLs d'assets Supabase pour le PDF

7. EXPORT BRAND KIT
   → PDF charte graphique (Puppeteer sur Render)
   → ZIP complet : logos PNG (1x/2x/3x, 3 fonds), palette JSON + ASE,
     PDF charte, tous les mockups, README
   → Lien de partage Supabase (expiration configurable : 7j / 30j / permanent)
   → Email Resend avec lien de téléchargement
```

---

## 5. Fonctionnalités transversales

### 5.1 Système de voix

**Bibliothèque Publique**
- Voix ElevenLabs intégrées (multiples langues, genres, styles)
- Preview audio 3s avant sélection
- Filtres : langue, genre, style (narrateur, news, pub…)

**Bibliothèque Personnelle (Voix Clonées)**
- Clonage vocal via ElevenLabs Voice Cloning API
- Upload d'échantillon audio (minimum 30 secondes)
- Limite selon le plan (Starter : 2 voix / Pro et Entreprise : illimité)

### 5.2 Amélioration prompt par IA

Sur chaque image ou clip généré, l'utilisateur peut :
- Éditer le prompt directement (inline, sans modal)
- Cliquer "Améliorer via IA" → Claude analyse le prompt actuel + l'image + le feedback optionnel → retourne un prompt amélioré + explication en 1 phrase
- Comparer jusqu'à 3 versions avec slider avant/après
- Régénérer en batch (plusieurs scènes simultanément avec nouveaux paramètres globaux)

### 5.3 Re-render partiel

Chaque scène a son propre état dans Supabase. Modifier la scène 3 ne relance que les étapes 4→5→6 pour cette scène. Remotion reçoit la liste des clips avec la scène 3 mise à jour uniquement.

### 5.4 Historique & Gestion des projets

- Liste paginée des projets avec statut temps réel
- Status badge : En cours / Terminé / Erreur
- Preview thumbnail
- Actions : Télécharger, Continuer l'édition, Supprimer

### 5.5 Paiement double

**Stripe** (international)
- Cartes Visa, Mastercard, American Express
- Stripe Checkout hébergé (pas de formulaire custom)
- Stripe Customer Portal pour la gestion abonnement

**Moneroo** (Mobile Money Afrique)
- Orange Money (CI, SN, ML, BF, CM)
- Wave (CI, SN)
- MTN Mobile Money
- Moov Money

---

## 6. Plans tarifaires

| Plan | Prix | F1 Vidéos | F2 Vidéos | F3 Brand Kits | Voix clonées | Watermark |
|------|------|-----------|-----------|----------------|--------------|-----------|
| **Starter** | 0€ | 3/mois | 3/mois | Non disponible | 0 | Oui |
| **Pro** | 19€/mois | Illimité | Illimité | 5/mois | 2 | Non |
| **Entreprise** | 79€/mois | Illimité | Illimité | Illimité | Illimité | Non |

**Starter :** accès découverte, watermark CLYRO, résolution 720p max, stockage 7 jours
**Pro :** tout débloqué F1+F2, F3 partiel, 1080p + 4K export, stockage 90 jours
**Entreprise :** tout illimité, brand kit partageable équipe, API access, rendu prioritaire, stockage permanent, support prioritaire

---

## 7. Onboarding

### Flows d'entrée

**Signup classique ou Google OAuth**
1. Question unique : "Quel est votre usage principal ?" (créateur / marketer / agence)
2. Projet exemple pré-rempli et pré-généré selon l'usage
3. Stripe customer créé silencieusement en arrière-plan
4. Email Resend de bienvenue

**Projets exemples par usage**
- Créateur → F1 "5 faits sur l'espace" (cartoon 2D, images déjà générées, cliquer "Générer la vidéo")
- Marketer → F2 "Ad casque audio premium" (storyboard prêt, preview flux/schnell visible)
- Agence → F3 "Identité marque Volta" (3 directions créatives déjà affichées, choisir et lancer)

**Objectif :** 70% des nouveaux utilisateurs génèrent un premier résultat dans la session d'inscription. Time-to-first-result cible : < 3 minutes.

### Emails automatiques (3 max au launch)

1. Bienvenue avec lien vers le projet exemple
2. "Votre vidéo est prête" avec thumbnail et lien téléchargement
3. Relance si inactif 7 jours avec deep-link vers le projet en cours

---

## 8. Métriques de succès

| Métrique | Cible 3 mois | Alerte |
|----------|-------------|--------|
| Utilisateurs inscrits | 500 | — |
| Vidéos générées | 2 000 | — |
| Brand kits générés | 200 | — |
| Activation rate (1ère vidéo < 24h) | > 70% | < 50% |
| Conversion free → payant | > 8% | < 5% |
| Rétention D7 | > 40% | < 25% |
| Time-to-first-video | < 4 min | > 8 min |
| render_failed rate | < 5% | > 5% sur 1h |
| image_regenerated rate | < 30% | > 40% → réviser prompts Claude |
| NPS | > 40 | — |

---

## 9. Critères d'acceptation MVP

### Must Have (v1.0)
- [ ] Inscription/Connexion (email + Google OAuth)
- [ ] Module F1 : 3 styles minimum (Animation 2D, Stock+VO, Minimaliste)
- [ ] Pipeline voix off (bibliothèque publique ElevenLabs)
- [ ] Génération visuelle via fal.ai avec preview-first
- [ ] Assemblage Remotion Lambda + FFmpeg
- [ ] Sous-titres karaoke synchronisés
- [ ] Téléchargement MP4
- [ ] Historique des projets
- [ ] Paiement Stripe (plan Pro)
- [ ] Paiement Moneroo (plan Pro)
- [ ] Emails transactionnels (bienvenue, vidéo prête, confirmation paiement)
- [ ] Re-render partiel par scène

### Should Have (v1.1)
- [ ] Module F1 : 6 styles complets
- [ ] Clonage vocal (bibliothèque personnelle)
- [ ] Module F2 Motion Design complet
- [ ] Apple Sign-In
- [ ] Régénération en batch
- [ ] Comparaison avant/après (slider 3 versions)

### Nice to Have (v2.0)
- [ ] Module F3 Brand Kit
- [ ] SSO Entreprise
- [ ] API publique
- [ ] Templates de scripts prédéfinis
- [ ] Collaboration équipe (brand kits partagés)
- [ ] Exportation multi-format (vertical, horizontal, carré)
