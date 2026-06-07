/**
 * Templates système de photoshoot — Phase 4 du portage Pomelli.
 *
 * Catalogue managé par l'équipe (pas une table user-facing). Chaque entrée
 * porte un `prompt_template` qui sera passé à fal.ai (image-to-image via
 * image_prompt) en concaténant la palette de marque. Les 4 premiers
 * gardent la sémantique de l'ancien `brand-photoshoot.ts` ; les 5 nouveaux
 * étendent la couverture vers cosmétique / food / lifestyle / luxe.
 */

export interface PhotoshootTemplateDef {
  id:              string
  name:            string
  category:        'studio' | 'lifestyle' | 'editorial' | 'food' | 'luxury'
  description:     string
  prompt_template: string
}

export const PHOTOSHOOT_TEMPLATES: PhotoshootTemplateDef[] = [
  {
    id:          'studio',
    name:        'Studio',
    category:    'studio',
    description: 'Clean catalog shot on a seamless gradient backdrop.',
    prompt_template: 'Professional product photography on seamless white to gray gradient backdrop, soft studio lighting, 3-point light setup, commercial catalog shot, clean reflections on surface, shot on Phase One, 80mm, 8K',
  },
  {
    id:          'floating',
    name:        'Floating',
    category:    'studio',
    description: 'Product mid-air with a dramatic drop shadow.',
    prompt_template: 'Product floating in mid-air against a clean gradient background, dramatic shadow beneath, zero-gravity product photography, commercial advertising shot, professional studio lighting, 8K',
  },
  {
    id:          'ingredient',
    name:        'Ingredient',
    category:    'editorial',
    description: 'Flat-lay with the product surrounded by its ingredients.',
    prompt_template: 'Product surrounded by its key ingredients and components artfully arranged, overhead flat-lay composition, professional food and product photography, marble surface, natural window light, 8K',
  },
  {
    id:          'in_use',
    name:        'In Use',
    category:    'lifestyle',
    description: 'Lifestyle context, the product being used naturally.',
    prompt_template: 'Product being used in a lifestyle context, natural environment, warm ambient lighting, lifestyle brand photography, shallow depth of field, editorial style, 8K',
  },
  // ── Nouveaux templates Phase 4 ────────────────────────────────────────────
  {
    id:          'marble_luxe',
    name:        'Marble Luxe',
    category:    'luxury',
    description: 'Carrara marble surface, soft side light, premium feel.',
    prompt_template: 'Premium product photography on white Carrara marble surface with subtle veining, soft window side lighting, minimal composition, hint of golden hour, luxury editorial style, 8K',
  },
  {
    id:          'water_splash',
    name:        'Water Splash',
    category:    'studio',
    description: 'Splash freeze frame, dynamic energy, commercial.',
    prompt_template: 'Dynamic product photography with crystal clear water splash freeze-frame around the product, high-speed photography, white background, droplets caught mid-air, commercial advertising, 8K',
  },
  {
    id:          'food_editorial',
    name:        'Food Editorial',
    category:    'food',
    description: 'Rustic linen and warm shadows, magazine quality.',
    prompt_template: 'Editorial food photography of the product on rustic linen with herbs and natural ingredients scattered around, warm directional sunlight, soft shadows, shallow depth of field, magazine quality, 8K',
  },
  {
    id:          'cosmetic_pastel',
    name:        'Cosmetic Pastel',
    category:    'studio',
    description: 'Pastel paper backdrop with subtle props.',
    prompt_template: 'Beauty product photography on pastel paper backdrop, geometric props in muted tones, soft even lighting, minimalist composition, modern cosmetic brand aesthetic, 8K',
  },
  {
    id:          'urban_lifestyle',
    name:        'Urban Lifestyle',
    category:    'lifestyle',
    description: 'Concrete and warm sunset light in an urban scene.',
    prompt_template: 'Lifestyle product photography in an urban environment, concrete and steel textures, warm sunset side light, motion blur in background, editorial street style, 8K',
  },
]

/** Map id → template pour lookup rapide côté route. */
export const PHOTOSHOOT_TEMPLATE_MAP: Record<string, PhotoshootTemplateDef> = Object.fromEntries(
  PHOTOSHOOT_TEMPLATES.map((t) => [t.id, t]),
)

/** Le shape public renvoyé par GET /brand/photoshoots/templates — sans le prompt
 *  qui reste interne (on n'expose pas notre prompt engineering). */
export function publicTemplate(t: PhotoshootTemplateDef) {
  return { id: t.id, name: t.name, category: t.category, description: t.description }
}
