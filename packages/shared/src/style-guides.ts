/**
 * CLYRO — Visual style guides for storyboard generation.
 *
 * Single source of truth for the per-style visual descriptions
 * that get injected into Claude's storyboard prompt. Used by:
 *   - apps/api/src/services/claude.ts (backend storyboard)
 *   - apps/web/app/api/generate-storyboard/route.ts (Next.js hub flow)
 *
 * Both must stay in sync — a thinner description here means weaker
 * image prompts and visibly worse output. Don't trim casually.
 *
 * Routing rule: styles that route to flux/schnell (most of these)
 * MUST NOT request readable text in the image — schnell renders it
 * illegibly. Only `whiteboard`, `infographie`, `motion-graphics`
 * route to Ideogram v2 (text-capable) and may include short labels.
 */

export const STYLE_VISUAL_GUIDE: Record<string, string> = {
  // ── Faceless — Catégorie 1 : Narratif & Immersif (schnell) ──────────
  'cinematique':      'cinematic lighting, 8k hyper-realistic, anamorphic wide shot, dramatic chiaroscuro, 35mm film grain — movie still quality, NO illustration, NO visible text or letters in frame',
  'stock-vo':         'National Geographic style, natural light, realistic textures, real-world documentary scene — fully photorealistic, no illustration, no cartoon, NO signs or readable text in frame',
  // ── Faceless — Catégorie 2 : Explicatif & Didactique ────────────────
  // whiteboard → Ideogram v2 (text-heavy)
  'whiteboard':       'hand-drawn sketch on whiteboard, black marker on plain white — NO color fills, NO shading, rough strokes only, RSA Animate educational style — handwritten single-word labels and arrows are OK (rendered via Ideogram)',
  // stickman / minimaliste / flat-design → schnell, NO text
  'stickman':         'black stick figures and geometric shapes on white background, RSA animate bonhommes style — NO fills, NO gradients, NO text, bold expressive line drawing, symbolic minimal storytelling',
  'minimaliste':      'simple black line art on white background, minimalist stickman/stick-figure illustration — NO fills, NO gradients, NO text or labels, ultra clean linework only',
  'flat-design':      'flat vector illustration, bold solid colors, no shadows, no gradients, Dribbble-quality SVG aesthetic — modern digital design, geometric shapes, vibrant palette, NO visible text or readable labels',
  // infographie → Ideogram v2 (readable percentages OK)
  'infographie':      'flat icon infographic, data visualization chart with simple bar/donut/line graph, color-coded sections, isometric perspective — professional B2B editorial design, readable axis labels and short percentage callouts are OK (rendered via Ideogram)',
  // 3d-pixar, animation-2d → schnell, NO text
  '3d-pixar':         'Pixar-style 3D CGI render, claymation texture, rounded adorable characters, soft studio lighting, rich vibrant colors — Disney Pixar movie quality, no photorealism, NO visible text in frame',
  'animation-2d':     'flat vector 2D cartoon illustration, bold outlines, vibrant saturated colors — absolutely NO photorealism, no 3D, NO readable text, traditional animation frame',
  // motion-graphics → Ideogram v2 (bold animated typography OK)
  'motion-graphics':  'flat design motion graphics, geometric shapes, vibrant vector colors, kinetic composition — tech brand, high-end ad quality, bold typographic headline (1-3 words max, rendered via Ideogram)',
  // ── Motion styles — all schnell ─────────────────────────────────────
  'corporate':        'clean corporate business illustration, navy blue / white palette, minimal geometric shapes — professional B2B, NO visible text in frame',
  'dynamique':        'high-energy composition, motion blur, neon accents on dark background, diagonal lines — sports / action, NO readable text',
  'luxe':             'luxury brand photography, gold and black palette, bokeh, marble surfaces — high-fashion editorial, NO visible text or typography',
  'fun':              'playful cartoon, candy-colored palette, bubbly rounded shapes, confetti — kawaii cheerful style, NO visible text',
}

/**
 * Safe accessor — returns the per-style guide or a sensible default
 * when the style is unknown / not in the map.
 */
export function getStyleVisualGuide(style: string): string {
  return STYLE_VISUAL_GUIDE[style] ?? 'professional visual composition'
}
