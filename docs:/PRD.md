# PRD.md — Product Requirements Document

**Projet :** CLYRO
**Version :** 1.0 MVP
**Date :** Mars 2026
**Statut :** En développement

---

## 1. Vision produit

### Problème
Les créateurs de contenu et équipes marketing perdent des dizaines d'heures par semaine à produire des vidéos. Faire appel à une agence coûte cher. Les outils actuels sont soit trop complexes, soit trop limités.

### Solution
CLYRO automatise la production vidéo de bout en bout grâce à l'IA :
- Entrée : un script ou un brief
- Sortie : une vidéo MP4 professionnelle prête à publier

### Proposition de valeur
> « De ton script à ta vidéo en moins de 10 minutes. Sans caméra, sans monteur, sans agence. »

---

## 2. Modules produit

### Module 1 — Faceless Videos

Génération de vidéos pour chaînes YouTube/TikTok/Instagram sans apparition à l'écran.

**6 styles disponibles :**

| Style | Description | Usage typique |
|-------|-------------|---------------|
| Animation 2D | Personnages et décors animés cartoon | Éducatif, storytelling |
| Stock + VO | Images/vidéos stock + voix off professionnelle | News, tutoriels |
| Minimaliste | Typographie animée, design épuré | Citations, tips |
| Infographie animée | Données visualisées en mouvement | Finance, stats |
| Whiteboard | Animation tableau blanc style dessin | Explicatif, formation |
| Cinématique | Plans cinéma, ambiance épique | Motivation, lifestyle |

**Workflow utilisateur (v5 — validé) :**
```
1. ENTRÉE
   ├─ Option A : Script texte → choix voix (bibliothèque publique OU voix clonée)
   └─ Option B : Fichier audio (voix off pré-enregistrée)

2. STORYBOARD (Claude AI)
   → Découpage automatique en scènes
   → Affichage du prompt visuel pour chaque scène
   → L'utilisateur peut ÉDITER le prompt avant génération

3. GÉNÉRATION VISUELS (fal.ai)
   → Génération selon le style choisi
   → Affichage du prompt utilisé
   → L'utilisateur peut RÉGÉNÉRER chaque scène individuellement

4. ASSEMBLAGE (FFmpeg + Remotion)
   → Sync audio/vidéo
   → Ajout musique de fond (volume 15%)
   → Sous-titres optionnels
   → Export MP4 HD

5. TÉLÉCHARGEMENT
   → Preview dans le navigateur
   → Téléchargement MP4
   → Sauvegarde dans l'historique
```

---

### Module 2 — Motion Graphics

Génération de vidéos pub/marketing avec identité de marque.

**Formats supportés :**
- Réseaux sociaux : 9:16 (Stories/Reels), 1:1 (Feed), 16:9 (YouTube)
- Publicité : 6s bumper, 15s, 30s, 60s

**Workflow (v1 — validé) :**
```
1. BRIEF & FORMAT
   → Objectif (pub, présentation, teaser, promo)
   → Format cible + durée
   → Upload brief ou description textuelle

2. IDENTITÉ DE MARQUE
   → Logo upload
   → Couleurs principales (hex)
   → Police de titre
   → Style général (Corporate, Dynamique, Luxe, Fun)

3. STORYBOARD (Claude AI)
   → Découpage en scènes avec timing
   → Prompt visuel affiché + éditable par scène

4. GÉNÉRATION (fal.ai + Remotion)
   → Visuels par scène (fal.ai)
   → Éléments graphiques de marque (Remotion)
   → Affichage prompt utilisé + option régénération par scène

5. VOIX OFF (optionnel)
   → Choix voix ElevenLabs ou upload audio
   → Sync automatique avec le timing des scènes

6. ASSEMBLAGE FINAL (FFmpeg)
   → Mix vidéo + audio
   → Overlay animations de marque
   → Export MP4 selon format cible
```

---

## 3. Fonctionnalités transversales

### 3.1 Système de voix (double bibliothèque)

**Bibliothèque Publique**
- Voix ElevenLabs intégrées (multiples langues, genres, styles)
- Preview audio avant sélection
- Filtres : langue, genre, style (narrateur, news, pub...)

**Bibliothèque Personnelle (Voix Clonées)**
- Clonage vocal via ElevenLabs Voice Cloning API
- Upload d'échantillon audio (minimum 30 secondes)
- Stockage sécurisé par utilisateur (Supabase)
- Limite selon le plan (Starter : 2 voix / Studio : illimité)

### 3.2 Historique & Gestion des projets
- Liste de toutes les vidéos générées
- Status en temps réel (En cours / Terminé / Erreur)
- Re-génération depuis un projet existant
- Suppression (soft delete)

### 3.3 Paiement double

**Stripe** (international)
- Cartes Visa, Mastercard, American Express
- Webhooks : `payment_intent.succeeded`, `customer.subscription.*`
- Route backend : `POST /webhook/stripe`

**Moneroo** (Mobile Money Afrique)
- Orange Money (Côte d'Ivoire, Sénégal, Mali, Burkina Faso, Cameroun)
- Wave (Côte d'Ivoire, Sénégal)
- MTN Mobile Money
- Moov Money
- Route backend : `POST /webhook/moneroo`

---

## 4. Plans tarifaires

| Plan | Prix | Crédits vidéo | Voix clonées | SSO |
|------|------|---------------|--------------|-----|
| **Free** | 0€ | 3 à l'inscription | 0 | ✗ |
| **Starter** | 19€/mois | 30/mois | 2 | ✗ |
| **Studio** | 49€/mois | Illimité | Illimité | ✓ |

*Packs de crédits supplémentaires disponibles à l'unité.*

---

## 5. Parcours utilisateur (User Journey complet)

```
[Landing Page clyro.app]
         ↓
   Voir démo / features
         ↓
   CTA "Essayer gratuitement"
         ↓
[Page Inscription signup.html]
   ├─ Google OAuth
   ├─ Apple Sign-In
   ├─ Email/Password
   └─ SSO Entreprise
         ↓
   Email de confirmation (Resend)
         ↓
[Dashboard — Onboarding]
   → Choix du module (Faceless ou Motion)
   → Tooltip guide de 3 étapes
         ↓
[Création première vidéo]
   → Workflow module sélectionné
   → Génération en temps réel avec progress bar
         ↓
[Preview + Téléchargement]
   → Vidéo MP4 disponible
   → Prompt à upgrader si crédits épuisés
         ↓
[Page Tarifs / Checkout]
   → Choix plan + moyen de paiement
   → Stripe ou Moneroo
         ↓
[Dashboard Pro débloqué]
```

---

## 6. Critères d'acceptation MVP

### Must Have (v1.0)
- [ ] Inscription/Connexion (email + Google OAuth)
- [ ] Module Faceless Videos : 3 styles minimum (Animation 2D, Stock+VO, Minimaliste)
- [ ] Pipeline voix off (bibliothèque publique ElevenLabs)
- [ ] Génération visuelle via fal.ai
- [ ] Assemblage FFmpeg basique
- [ ] Téléchargement MP4
- [ ] Historique des vidéos
- [ ] Paiement Stripe (plan Starter)
- [ ] Paiement Moneroo (plan Starter)
- [ ] Emails transactionnels (confirmation, facture)

### Should Have (v1.1)
- [ ] Module Faceless : 6 styles complets
- [ ] Clonage vocal (bibliothèque personnelle)
- [ ] Module Motion Graphics
- [ ] Apple Sign-In
- [ ] Packs de crédits à l'unité
- [ ] Sous-titres automatiques

### Nice to Have (v2.0)
- [ ] SSO Entreprise
- [ ] API publique
- [ ] Templates de scripts prédéfinis
- [ ] Collaboration équipe
- [ ] Exportation multi-format (vertical, horizontal, carré)

---

## 7. Métriques de succès

| Métrique | Cible 3 mois |
|----------|-------------|
| Utilisateurs inscrits | 500 |
| Vidéos générées | 2 000 |
| Conversion free → payant | > 8% |
| Rétention M1 | > 40% |
| NPS | > 40 |
