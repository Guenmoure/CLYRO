import type { BrandBrief, BrandDirection, BrandCharte } from '@clyro/shared'

/** Escape HTML special characters to prevent XSS in text content. */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Validate and sanitize a CSS hex color value (e.g. #ff0000). Returns fallback on invalid input. */
function safeHex(value: string, fallback = '#888'): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback
}

/** Sanitize a CSS font-family name — strip anything that could break out of quotes. */
function safeFont(name: string): string {
  return name.replace(/['"\\;{}()]/g, '')
}

/** Sanitize a URL for use in src/href — only allow http(s) and data:image. */
function safeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return esc(url)
  if (/^data:image\//i.test(url)) return url
  return ''
}

export function buildCharteHtml(
  brief: BrandBrief,
  direction: BrandDirection,
  charte: BrandCharte,
  logoUrl?: string,
): string {
  const colors = charte.colors ?? []
  const colorSwatches = colors.map(c => `
      <div class="swatch">
        <div class="swatch-box" style="background:${safeHex(c.hex)}"></div>
        <div class="swatch-info">
          <strong>${esc(c.name)}</strong><br/>
          <code>${esc(c.hex)}</code> · <code>${esc(c.rgb)}</code><br/>
          <small>${esc(c.usage)}</small>
        </div>
      </div>`).join('')

  const typRows = Object.entries(charte.typography ?? {}).map(([level, t]) => `
      <tr>
        <td class="level">${esc(level)}</td>
        <td><strong>${esc(t.font)}</strong></td>
        <td>${esc(t.weight)}</td>
        <td>${esc(t.sizes)}</td>
        <td>${esc(t.usage)}</td>
      </tr>`).join('')

  const headingFont = safeFont(direction.typography.heading)
  const bodyFont = safeFont(direction.typography.body)
  const primary = safeHex(direction.palette.primary)
  const neutral = safeHex(direction.palette.neutral, '#666')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Charte Graphique — ${esc(brief.name)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(headingFont)}:wght@400;700&family=${encodeURIComponent(bodyFont)}:wght@400;500&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'${bodyFont}',sans-serif; color:#1a1a1a; background:#fff; }
  .page { max-width:794px; margin:0 auto; padding:48px; }
  @media print { .page { padding:24px; } }

  /* Cover */
  .cover { display:flex; flex-direction:column; justify-content:center; min-height:400px; padding:60px 0; border-bottom:3px solid ${primary}; margin-bottom:48px; }
  .cover-brand { font-family:'${headingFont}',sans-serif; font-size:64px; font-weight:700; color:${primary}; line-height:1; }
  .cover-tagline { font-size:18px; color:${neutral}; margin-top:12px; font-style:italic; }
  .cover-meta { margin-top:32px; display:flex; gap:32px; font-size:13px; color:#666; }

  /* Sections */
  .section { margin-bottom:48px; page-break-inside:avoid; }
  .section-title { font-family:'${headingFont}',sans-serif; font-size:24px; font-weight:700; color:${primary}; border-bottom:2px solid ${primary}22; padding-bottom:8px; margin-bottom:24px; }

  /* Palette */
  .swatches { display:flex; flex-wrap:wrap; gap:24px; }
  .swatch { display:flex; gap:16px; align-items:flex-start; width:calc(50% - 12px); }
  .swatch-box { width:60px; height:60px; border-radius:8px; border:1px solid rgba(0,0,0,.1); flex-shrink:0; }
  .swatch-info strong { font-size:15px; }
  .swatch-info code { font-size:12px; background:#f5f5f5; padding:1px 6px; border-radius:3px; }
  .swatch-info small { font-size:11px; color:#666; display:block; margin-top:4px; line-height:1.4; }

  /* Typography table */
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; padding:8px 12px; background:${primary}11; font-family:'${headingFont}',sans-serif; }
  td { padding:8px 12px; border-bottom:1px solid #f0f0f0; vertical-align:top; }
  .level { font-weight:700; text-transform:uppercase; font-size:11px; color:${primary}; }

  /* Tags */
  .tags { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
  .tag { padding:4px 12px; border-radius:20px; font-size:12px; }
  .tag-green { background:#e6f9f0; color:#1a7f4f; border:1px solid #a3d9c0; }
  .tag-red { background:#fff0f0; color:#c0392b; border:1px solid #f5c6c6; }

  /* Palette strip */
  .palette-strip { display:flex; height:24px; border-radius:8px; overflow:hidden; margin-bottom:32px; }
  .palette-strip div { flex:1; }

  /* Footer */
  .footer { border-top:1px solid #eee; padding-top:24px; margin-top:64px; font-size:11px; color:#999; display:flex; justify-content:space-between; }
</style>
</head>
<body>
<div class="page">

  <!-- Cover -->
  <div class="cover">
    ${logoUrl ? `<img src="${safeUrl(logoUrl)}" alt="${esc(brief.name)} logo" style="height:80px;object-fit:contain;object-position:left;margin-bottom:24px;"/>` : ''}
    <div class="cover-brand">${esc(brief.name)}</div>
    <div class="cover-tagline">${esc(direction.tagline)}</div>
    <div class="cover-meta">
      <span>Secteur : ${esc(brief.secteur)}</span>
      <span>Direction : ${esc(direction.name)}</span>
      <span>Cible : ${esc(brief.cible)}</span>
    </div>
  </div>

  <!-- Palette strip -->
  <div class="palette-strip">
    ${[direction.palette.primary, direction.palette.secondary, direction.palette.accent, direction.palette.neutral, direction.palette.background].map(c => `<div style="background:${safeHex(c)}"></div>`).join('')}
  </div>

  <!-- Couleurs -->
  <div class="section">
    <div class="section-title">Palette de couleurs</div>
    <div class="swatches">${colorSwatches}</div>
  </div>

  <!-- Typographie -->
  <div class="section">
    <div class="section-title">Système typographique</div>
    <table>
      <thead><tr><th>Niveau</th><th>Police</th><th>Graisse</th><th>Tailles</th><th>Usage</th></tr></thead>
      <tbody>${typRows}</tbody>
    </table>
  </div>

  <!-- Logo -->
  <div class="section">
    <div class="section-title">Règles d'usage du logo</div>
    <p><strong>Espace de protection :</strong> ${esc(charte.logo_rules?.clear_space ?? '—')}</p>
    <p style="margin-top:16px;font-weight:600">Fonds autorisés</p>
    <div class="tags">${(charte.logo_rules?.allowed_backgrounds ?? []).map(b => `<span class="tag tag-green">${esc(b)}</span>`).join('')}</div>
    <p style="margin-top:16px;font-weight:600">Interdits</p>
    <div class="tags">${(charte.logo_rules?.forbidden ?? []).map(f => `<span class="tag tag-red">✗ ${esc(f)}</span>`).join('')}</div>
  </div>

  <!-- Layout -->
  <div class="section">
    <div class="section-title">Mise en page</div>
    <p><strong>Grille :</strong> ${esc(charte.layout?.grid ?? '—')}</p>
    <p style="margin-top:8px"><strong>Espacement :</strong> ${esc(charte.layout?.spacing ?? '—')}</p>
    <p style="margin-top:8px"><strong>Marges :</strong> ${esc(charte.layout?.margins ?? '—')}</p>
  </div>

  <!-- Photography -->
  <div class="section">
    <div class="section-title">Direction photographique</div>
    <p>${esc(charte.photography?.style ?? '')}</p>
    <p style="margin-top:8px;font-style:italic;color:#666">${esc(charte.photography?.mood ?? '')}</p>
    <div class="tags" style="margin-top:12px">${(charte.photography?.forbidden ?? []).map(f => `<span class="tag tag-red">✗ ${esc(f)}</span>`).join('')}</div>
  </div>

  <div class="footer">
    <span>${esc(brief.name)} — Charte Graphique</span>
    <span>Généré avec CLYRO · ${new Date().toLocaleDateString('fr-FR')}</span>
  </div>
</div>
</body>
</html>`
}
