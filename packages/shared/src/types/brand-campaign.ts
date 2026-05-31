/**
 * Brand Campaigns — Phase 3 du portage Pomelli.
 *
 * Modèle persistant : une Campagne contient plusieurs Créatives, chacune
 * conservant son historique de versions pour l'éditeur (Phase 3.4).
 *
 * Tables SQL : brand_campaigns, brand_creatives, brand_creative_versions
 * (cf. supabase/migrations/20260602000000_brand_campaigns.sql).
 */

export type CampaignAspectRatio = '9:16' | '1:1' | '4:5'

export type CampaignStatus = 'draft' | 'generating' | 'done' | 'error'

export interface BrandCampaign {
  id:           string
  brand_kit_id: string
  user_id:      string
  title:        string
  description:  string | null
  prompt:       string
  product_id:   string | null
  asset_ids:    string[]
  aspect_ratio: CampaignAspectRatio
  status:       CampaignStatus
  metadata:     Record<string, unknown>
  created_at:   string
  updated_at:   string
}

/** Visibilité par bloc — piloté par les toggles œil du Creative Editor. */
export interface CreativeBlocksVisible {
  header:       boolean
  description:  boolean
  cta:          boolean
}

export interface BrandCreative {
  id:               string
  campaign_id:      string
  user_id:          string
  image_url:        string
  prompt:           string | null
  header_text:      string | null
  description_text: string | null
  cta_text:         string | null
  blocks_visible:   CreativeBlocksVisible
  current_version:  number
  position:         number
  created_at:       string
  updated_at:       string
}

/** Snapshot complet d'une créative à un instant donné. Append-only. */
export interface BrandCreativeVersion {
  id:           string
  creative_id:  string
  user_id:      string
  version_num:  number
  /** Snapshot complet : { image_url, header_text, description_text,
   *  cta_text, blocks_visible } à minima. Le shape est libre pour pouvoir
   *  évoluer sans migration. */
  snapshot:     Record<string, unknown>
  created_at:   string
}

// ── Payloads d'API ──────────────────────────────────────────────────────────

export interface CreateCampaignPayload {
  brand_kit_id: string
  prompt:       string
  /** Titre éditable — facultatif, Claude le proposera sinon. */
  title?:       string
  product_id?:  string
  asset_ids?:   string[]
  aspect_ratio?: CampaignAspectRatio
}

/** Réponse de POST /brand/campaigns : la campagne créée en `status=generating`.
 *  Le front poll GET /brand/campaigns/:id pour suivre l'avancement. */
export interface CreateCampaignResponse {
  campaign: BrandCampaign
}

export interface CampaignWithCreatives {
  campaign:  BrandCampaign
  creatives: BrandCreative[]
}

export interface UpdateCreativePayload {
  header_text?:      string | null
  description_text?: string | null
  cta_text?:         string | null
  blocks_visible?:   Partial<CreativeBlocksVisible>
  position?:         number
}
