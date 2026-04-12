import type { BrandBrief, BrandDirection, BrandCharte } from '@clyro/shared'

export function buildCharteHtml(
  brief: BrandBrief,
  direction: BrandDirection,
  charte: BrandCharte,
  logoUrl?: string,
): string {
  const colors = charte.colors ?? []
  const colorSwatches = colors.map(c => `
      <div class="swatch">
        <div class="swatch-box" style="background:${c.hex}"></div>
        <div class="swatch-info">
          <strong>${c.name}</strong><br/>
          <code>${c.hex}</code> · <code>${c.rgb}</code><br/>
          <small>${c.usage}</small>
        </div>
      </div>`).join('')

  const typRows = Object.entries(charte.typography ?? {}).map(([level, t]) => `
      <tr>
        <td class="level">${level}</td>
        <td><strong>${t.font}</strong></td>
        <td>${t.weight}</td>
        <td>${t.sizes}</td>
        <td>${t.usage}</td>
      </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Charte Graphique — ${brief.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(direction.typography.heading)}:wght@400;700&family=${encodeURIComponent(direction.typography.body)}:wght@400;500&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'${direction.typography.body}',sans-serif; color:#1a1a1a; background:#fff; }
  .page { max-width:794px; margin:0 auto; padding:48px; }
  @media print { .page { padding:24px; } }

  /* Cover */
  .cover { display:flex; flex-direction:column; justify-content:center; min-height:400px; padding:60px 0; border-bottom:3px solid ${direction.palette.primary}; margin-bottom:48px; }
  .cover-brand { font-family:'${direction.typography.heading}',sans-serif; font-size:64px; font-weight:700; color:${direction.palette.primary}; line-height:1; }
  .cover-tagline { font-size:18px; color:${direction.palette.neutral}; margin-top:12px; font-style:italic; }
  .cover-meta { margin-top:32px; display:flex; gap:32px; font-size:13px; color:#666; }

  /* Sections */
  .section { margin-bottom:48px; page-break-inside:avoid; }
  .section-title { font-family:'${direction.typography.heading}',sans-serif; font-size:24px; font-weight:700; color:${direction.palette.primary}; border-bottom:2px solid ${direction.palette.primary}22; padding-bottom:8px; margin-bottom:24px; }

  /* Palette */
  .swatches { display:flex; flex-wrap:wrap; gap:24px; }
  .swatch { display:flex; gap:16px; align-items:flex-start; width:calc(50% - 12px); }
  .swatch-box { width:60px; height:60px; border-radius:8px; border:1px solid rgba(0,0,0,.1); flex-shrink:0; }
  .swatch-info strong { font-size:15px; }
  .swatch-info code { font-size:12px; background:#f5f5f5; padding:1px 6px; border-radius:3px; }
  .swatch-info small { font-size:11px; color:#666; display:block; margin-top:4px; line-height:1.4; }

  /* Typography table */
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; padding:8px 12px; background:${direction.palette.primary}11; font-family:'${direction.typography.heading}',sans-serif; }
  td { padding:8px 12px; border-bottom:1px solid #f0f0f0; vertical-align:top; }
  .level { font-weight:700; text-transform:uppercase; font-size:11px; color:${direction.palette.primary}; }

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
    ${logoUrl ? `<img src="${logoUrl}" alt="${brief.name} logo" style="height:80px;object-fit:contain;object-position:left;margin-bottom:24px;"/>` : ''}
    <div class="cover-brand">${brief.name}</div>
    <div class="cover-tagline">${direction.tagline}</div>
    <div class="cover-meta">
      <span>Secteur : ${brief.secteur}</span>
      <span>Direction : ${direction.name}</span>
      <span>Cible : ${brief.cible}</span>
    </div>
  </div>

  <!-- Palette strip -->
  <div class="palette-strip">
    ${[direction.palette.primary, direction.palette.secondary, direction.palette.accent, direction.palette.neutral, direction.palette.background].map(c => `<div style="background:${c}"></div>`).join('')}
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
    <p><strong>Espace de protection :</strong> ${charte.logo_rules?.clear_space ?? '—'}</p>
    <p style="margin-top:16px;font-weight:600">Fonds autorisés</p>
    <div class="tags">${(charte.logo_rules?.allowed_backgrounds ?? []).map(b => `<span class="tag tag-green">${b}</span>`).join('')}</div>
    <p style="margin-top:16px;font-weight:600">Interdits</p>
    <div class="tags">${(charte.logo_rules?.forbidden ?? []).map(f => `<span class="tag tag-red">✗ ${f}</span>`).join('')}</div>
  </div>

  <!-- Layout -->
  <div class="section">
    <div class="section-title">Mise en page</div>
    <p><strong>Grille :</strong> ${charte.layout?.grid ?? '—'}</p>
    <p style="margin-top:8px"><strong>Espacement :</strong> ${charte.layout?.spacing ?? '—'}</p>
    <p style="margin-top:8px"><strong>Marges :</strong> ${charte.layout?.margins ?? '—'}</p>
  </div>

  <!-- Photography -->
  <div class="section">
    <div class="section-title">Direction photographique</div>
    <p>${charte.photography?.style ?? ''}</p>
    <p style="margin-top:8px;font-style:italic;color:#666">${charte.photography?.mood ?? ''}</p>
    <div class="tags" style="margin-top:12px">${(charte.photography?.forbidden ?? []).map(f => `<span class="tag tag-red">✗ ${f}</span>`).join('')}</div>
  </div>

  <div class="footer">
    <span>${brief.name} — Charte Graphique</span>
    <span>Généré avec CLYRO · ${new Date().toLocaleDateString('fr-FR')}</span>
  </div>
</div>
</body>
</html>`
}
