"use client";

import { useState, useCallback } from "react";
import {
  Loader2,
  ChevronRight,
  Check,
  Download,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  X,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Archive,
  Share2,
  Copy,
  CheckCheck,
  ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { createBrowserClient } from "@/lib/supabase";
import type {
  BrandBrief,
  BrandAmbiance,
  BrandStrategy,
  BrandDirection,
  BrandAssets,
  BrandCharte,
  BrandStudioStep,
  BrandAnalysisResult,
  BrandLogos,
  BrandLogoConcept,
  ContradictionPath,
} from "@clyro/shared";

// ── Helpers ──────────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(
    message: string,
    public readonly data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function callApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error ?? `HTTP ${res.status}`, data);
  return data as T;
}

function hexToLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (v: number) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(l1: number, l2: number): number {
  const [lo, hi] = l1 < l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function wcagStatus(hex: string): { ok: boolean; ratio: number } | null {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex.trim())) return null;
  const l = hexToLuminance(hex.trim());
  const vsWhite = contrastRatio(l, 1);
  const vsBlack = contrastRatio(l, 0);
  const ratio = Math.max(vsWhite, vsBlack);
  return { ok: ratio >= 4.5, ratio };
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0,
    sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        hue = ((b - r) / d + 2) / 6;
        break;
      case b:
        hue = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: hue * 360, s: sat * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  const toHex = (val: number) =>
    Math.round((val + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function suggestAccessibleColor(
  foreground: string,
  targetRatio: number = 4.5,
): string {
  const fLum = hexToLuminance(foreground);
  const bgLum = fLum > 0.5 ? 1 : 0;
  const hsl = hexToHsl(foreground);
  let lo = 0,
    hi = 100,
    best = hsl.l;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const testHex = hslToHex(hsl.h, hsl.s, mid);
    const testLum = hexToLuminance(testHex);
    const ratio = contrastRatio(testLum, bgLum);
    if (ratio >= targetRatio) {
      best = mid;
      if (bgLum > 0.5) hi = mid;
      else lo = mid;
    } else {
      if (bgLum > 0.5) lo = mid;
      else hi = mid;
    }
  }
  return hslToHex(hsl.h, hsl.s, best);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AMBIANCE_OPTIONS: Array<{
  id: BrandAmbiance;
  label: string;
  desc: string;
  emoji: string;
}> = [
  {
    id: "luxe",
    label: "Luxe",
    desc: "Elegant, refined, timeless",
    emoji: "✨",
  },
  {
    id: "accessible",
    label: "Accessible",
    desc: "Warm, human, inclusive",
    emoji: "🤝",
  },
  { id: "tech", label: "Tech", desc: "Modern, innovative, refined", emoji: "⚡" },
  {
    id: "naturel",
    label: "Natural",
    desc: "Organic, sustainable, authentic",
    emoji: "🌿",
  },
  {
    id: "fun",
    label: "Fun",
    desc: "Colorful, expressive, irreverent",
    emoji: "🎉",
  },
  {
    id: "corporate",
    label: "Corporate",
    desc: "Professional, reliable, structured",
    emoji: "🏢",
  },
];

const STEPS: Array<{ key: BrandStudioStep; label: string }> = [
  { key: "brief", label: "Brief" },
  { key: "strategy", label: "Strategy" },
  { key: "logos", label: "Logos" },
  { key: "assets", label: "Visuals" },
  { key: "charte", label: "Guidelines" },
  { key: "export", label: "Export" },
];

const ASSET_LABELS: Record<string, string> = {
  mockup_business_card: "Business card",
  mockup_social_post: "Social media post",
  mockup_letterhead: "Letterhead",
  mockup_email_header: "Email banner",
  lifestyle_mockup: "Lifestyle mockup",
  pattern_url: "Textile pattern",
  brand_banner: "Web banner",
  illustration_url: "Editorial illustration",
  mockup_packaging: "Packaging / Box",
  og_image_url: "OG / Meta image",
};

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: BrandStudioStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-1 mb-8 flex-wrap">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-display font-semibold transition-all",
                done
                  ? "bg-purple-500/10 text-purple-500"
                  : active
                    ? "bg-purple-500 text-white shadow-sm"
                    : "bg-card text-[--text-muted]",
              )}
            >
              {done ? (
                <Check size={11} />
              ) : (
                <span className="w-4 text-center">{i + 1}</span>
              )}
              {active && <span>{step.label}</span>}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-4 h-px",
                  i < currentIdx ? "bg-purple-500" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Color Swatch ──────────────────────────────────────────────────────────────

function ColorSwatch({
  hex,
  label,
  size = "md",
}: {
  hex: string;
  label?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "rounded-lg border border-black/10 shadow-sm",
          size === "sm" ? "w-8 h-8" : "w-12 h-12",
        )}
        style={{ background: hex }}
        title={hex}
      />
      {label && (
        <span className="font-mono text-[11px] text-[--text-muted]">{label}</span>
      )}
    </div>
  );
}

// ── WCAG Inline Alert ─────────────────────────────────────────────────────────

function WcagInline({
  hex,
  onApply,
}: {
  hex: string;
  onApply?: (color: string) => void;
}) {
  if (!hex.trim()) return null;
  const result = wcagStatus(hex);
  if (!result) return null;
  if (result.ok) return null;
  const suggestedColor = suggestAccessibleColor(hex);
  const suggestedRatio = Math.max(
    contrastRatio(hexToLuminance(suggestedColor), 1),
    contrastRatio(hexToLuminance(suggestedColor), 0),
  );
  return (
    <div className="mt-1 space-y-2">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertTriangle size={11} className="text-amber-500 shrink-0" />
        <p className="text-[11px] text-amber-700">
          Low contrast ({result.ratio.toFixed(1)}:1 — WCAG AA requires 4.5:1).
        </p>
      </div>
      {onApply && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded-lg">
          <div
            className="w-5 h-5 rounded border border-black/10 shadow-sm shrink-0"
            style={{ background: suggestedColor }}
            title={suggestedColor}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-green-700 font-medium">
              Suggested color
            </p>
            <p className="text-[11px] text-green-600">
              {suggestedColor} ({suggestedRatio.toFixed(1)}:1)
            </p>
          </div>
          <button
            type="button"
            onClick={() => onApply(suggestedColor)}
            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[11px] font-medium rounded transition-colors shrink-0"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

// ── Analyst Modal ─────────────────────────────────────────────────────────────

function AnalystModal({
  analysis,
  onContinue,
  onEdit,
}: {
  analysis: BrandAnalysisResult;
  onContinue: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div
          className={cn(
            "flex items-center gap-3 px-6 py-5",
            analysis.is_ready ? "bg-green-50" : "bg-amber-50",
          )}
        >
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              analysis.is_ready ? "bg-green-100" : "bg-amber-100",
            )}
          >
            {analysis.is_ready ? (
              <Check size={20} className="text-green-600" />
            ) : (
              <AlertTriangle size={20} className="text-amber-500" />
            )}
          </div>
          <div>
            <p className="font-display font-bold text-foreground">
              {analysis.is_ready ? "Brief validated" : "Brief incomplete"}
            </p>
            <p className="text-xs text-[--text-muted]">
              Score : {analysis.brief_score}/100
            </p>
          </div>
          {/* Score bar */}
          <div className="ml-auto flex flex-col items-end gap-1">
            <div className="w-20 h-2 bg-border rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  analysis.brief_score >= 70 ? "bg-green-500" : "bg-amber-400",
                )}
                style={{ width: `${analysis.brief_score}%` }}
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-80 overflow-y-auto">
          {analysis.brief_quality === "insufficient" &&
            analysis.clarification_questions &&
            analysis.clarification_questions.length > 0 && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-red-500 mb-2">
                  Questions de clarification
                </p>
                <ul className="space-y-2">
                  {analysis.clarification_questions.map((q, i) => (
                    <li key={i} className="text-sm text-foreground flex gap-2">
                      <span className="text-red-400 shrink-0 mt-0.5">❓</span>{" "}
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          {analysis.contradictions.length > 0 && (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-red-500 mb-2">
                Contradictions détectées
              </p>
              <ul className="space-y-1">
                {analysis.contradictions.map((c, i) => (
                  <li key={i} className="text-sm text-foreground flex gap-2">
                    <span className="text-red-400 shrink-0">✗</span> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.questions.length > 0 && (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-amber-500 mb-2">
                Questions à clarifier
              </p>
              <ul className="space-y-1">
                {analysis.questions.map((q, i) => (
                  <li key={i} className="text-sm text-foreground flex gap-2">
                    <span className="text-amber-400 shrink-0">?</span> {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.suggestions.length > 0 && (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-blue-500 mb-2">
                Suggestions
              </p>
              <ul className="space-y-1">
                {analysis.suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-[--text-muted] flex gap-2">
                    <span className="text-blue-500 shrink-0">→</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-foreground transition-colors px-4 py-2.5"
          >
            <ArrowLeft size={14} /> Modifier le brief
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 flex items-center justify-center gap-2 bg-foreground text-white font-display font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-80 transition-opacity"
          >
            <ChevronRight size={14} />
            {analysis.is_ready
              ? "Generate strategy"
              : "Continue anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Contradiction Paths Modal ────────────────────────────────────────────────

function ContradictionPathsModal({
  paths,
  contradictions,
  onSelectPath,
  onEdit,
}: {
  paths: Array<{ label: string; description: string; resolution: string }>;
  contradictions: string[];
  onSelectPath: (resolution: string) => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-purple-50 flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-100">
            <AlertTriangle size={20} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-display font-bold text-foreground">
              Contradictions détectées
            </p>
            <p className="text-xs text-[--text-muted]">
              Sélectionne un chemin créatif pour les résoudre
            </p>
          </div>
        </div>

        {/* Contradictions list */}
        <div className="px-6 py-4 border-b border-border bg-purple-50/30">
          <p className="font-mono text-[11px] uppercase tracking-wider text-purple-600 mb-2">
            Contradictions détectées
          </p>
          <ul className="space-y-1">
            {contradictions.map((c, i) => (
              <li key={i} className="text-sm text-foreground flex gap-2">
                <span className="text-purple-500 shrink-0">⚡</span> {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Path cards */}
        <div className="px-6 py-6 space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[--text-muted] mb-4">
            2 chemins créatifs
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {paths.map((path, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPath(path.resolution)}
                className="group relative rounded-2xl border-2 border-border bg-white p-4 text-left transition-all hover:border-purple-400 hover:shadow-lg"
              >
                {/* Path label */}
                <p className="font-display font-bold text-foreground group-hover:text-purple-600 transition-colors mb-2">
                  {path.label}
                </p>

                {/* Description */}
                <p className="text-sm text-[--text-muted] mb-3">
                  {path.description}
                </p>

                {/* Resolution keywords */}
                <div className="flex flex-wrap gap-1.5">
                  {path.resolution.split(",").map((keyword, ki) => (
                    <span
                      key={ki}
                      className="px-2.5 py-1 bg-purple-100 text-purple-700 text-[11px] font-medium rounded-lg"
                    >
                      {keyword.trim()}
                    </span>
                  ))}
                </div>

                {/* Hover indicator */}
                <div className="absolute top-0 right-0 rounded-full w-0 h-0 group-hover:w-12 group-hover:h-12 bg-purple-100 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                  <ChevronRight size={16} className="text-purple-600" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3 bg-gray-50">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-foreground transition-colors px-4 py-2.5"
          >
            <ArrowLeft size={14} /> Modifier le brief
          </button>
          <div className="flex-1" />
          <p className="text-xs text-[--text-muted] self-center">
            Clique sur un chemin pour continuer
          </p>
        </div>
      </div>
    </div>
  );
}

// ── STEP 1: Brief Form ────────────────────────────────────────────────────────

function BriefForm({
  onSubmit,
  qualityIssues = [],
}: {
  onSubmit: (brief: BrandBrief) => void;
  qualityIssues?: string[];
}) {
  const [name, setName] = useState("");
  const [secteur, setSecteur] = useState("");
  const [cible, setCible] = useState("");
  const [valeurs, setValeurs] = useState(["", "", ""]);
  const [ambiance, setAmbiance] = useState<BrandAmbiance | null>(null);
  const [concurrents, setConcurrents] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [references, setReferences] = useState("");
  const [enforcedColors, setEnforcedColors] = useState("");

  const imposedHexes = enforcedColors
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  const canSubmit =
    name.trim() &&
    secteur.trim() &&
    cible.trim() &&
    valeurs.filter(Boolean).length >= 2 &&
    ambiance;

  function handleSubmit() {
    if (!ambiance) return;
    onSubmit({
      name: name.trim(),
      secteur: secteur.trim(),
      cible: cible.trim(),
      valeurs: valeurs.filter(Boolean),
      ambiance,
      concurrents: concurrents.trim() || undefined,
      logo_url: logoUrl.trim() || undefined,
      references: references.trim() || undefined,
      couleurs_imposees: enforcedColors.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-muted overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">Nom de la marque <span className="text-red-400">·</span></p>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Celeste, Nøvak, Bloom…"
            className="w-full bg-transparent text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none px-4 py-3"
          />
        </div>
        <div className="rounded-2xl border border-border bg-muted overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">Secteur d'activité <span className="text-red-400">·</span></p>
          </div>
          <input
            type="text"
            value={secteur}
            onChange={(e) => setSecteur(e.target.value)}
            placeholder="e.g.: Cosmetics, B2B SaaS, Restaurants…"
            className="w-full bg-transparent text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none px-4 py-3"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-muted overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">Cible principale <span className="text-red-400">·</span></p>
        </div>
        <input
          type="text"
          value={cible}
          onChange={(e) => setCible(e.target.value)}
          placeholder="e.g.: Women 25-40 years, upper class, urban, wellness enthusiasts"
          className="w-full bg-transparent text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none px-4 py-3"
        />
      </div>

      <div className="rounded-2xl border border-border bg-muted overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">3 valeurs de marque <span className="text-red-400">·</span></p>
        </div>
        <div className="flex gap-2 px-4 py-3">
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              type="text"
              value={valeurs[i]}
              onChange={(e) => {
                const next = [...valeurs];
                next[i] = e.target.value;
                setValeurs(next);
              }}
              placeholder={["Innovation", "Simplicity", "Confiance"][i]}
              className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500"
            />
          ))}
        </div>
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted] mb-3 block">
          Ambiance visuelle <span className="text-red-400">·</span>
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {AMBIANCE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAmbiance(opt.id)}
              className={cn(
                "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all",
                ambiance === opt.id
                  ? "border-purple-500 bg-purple-500/5"
                  : "border-border bg-card hover:border-purple-500/40",
              )}
            >
              <span className="text-xl">{opt.emoji}</span>
              <p className="font-display font-semibold text-xs text-foreground">
                {opt.label}
              </p>
              <p className="font-body text-[11px] text-[--text-muted] leading-tight">
                {opt.desc}
              </p>
              {ambiance === opt.id && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                  <Check size={9} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-muted overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">Concurrents à éviter</p>
          </div>
          <input
            type="text"
            value={concurrents}
            onChange={(e) => setConcurrents(e.target.value)}
            placeholder="ex: Nike, Apple, Zara…"
            className="w-full bg-transparent text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none px-4 py-3"
          />
        </div>
        <div className="rounded-2xl border border-border bg-muted overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">Marques de référence</p>
          </div>
          <input
            type="text"
            value={references}
            onChange={(e) => setReferences(e.target.value)}
            placeholder="ex: Glossier, Notion, Oatly…"
            className="w-full bg-transparent text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none px-4 py-3"
          />
        </div>
        <div className="rounded-2xl border border-border bg-muted overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">Enforced colors (HEX)</p>
          </div>
          <input
            type="text"
            value={enforcedColors}
            onChange={(e) => setEnforcedColors(e.target.value)}
            placeholder="#FF5733, #2C3E50…"
            className="w-full bg-transparent text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none px-4 py-3"
          />
          {imposedHexes.map((hex) => (
            <WcagInline
              key={hex}
              hex={hex}
              onApply={(suggestedColor: string) => {
                const updated = enforcedColors
                  .split(",")
                  .map((c: string) => (c.trim() === hex.trim() ? suggestedColor : c))
                  .join(", ");
                setEnforcedColors(updated);
              }}
            />
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-muted overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">Logo existant (URL)</p>
          </div>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://exemple.com/logo.png"
            className="w-full bg-transparent text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none px-4 py-3"
          />
        </div>
      </div>

      {qualityIssues.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-widest text-red-600 font-semibold flex items-center gap-1.5">
            <AlertTriangle size={12} /> Brief insuffisant — corrige ces points :
          </p>
          <ul className="space-y-1">
            {qualityIssues.map((issue, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-xs text-red-700"
              >
                <span className="mt-0.5 shrink-0">•</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="flex items-center gap-2 bg-foreground text-white font-display font-semibold text-sm px-6 py-3 rounded-xl disabled:opacity-40 hover:opacity-80 transition-opacity"
      >
        <Sparkles size={15} /> Analyser le brief
      </button>
    </div>
  );
}

// ── Direction Card ────────────────────────────────────────────────────────────

function DirectionCard({
  direction,
  selected,
  onSelect,
}: {
  direction: BrandDirection;
  selected: boolean;
  onSelect: () => void;
}) {
  const p = direction.palette;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative text-left rounded-2xl border-2 overflow-hidden transition-all hover:shadow-lg",
        selected
          ? "border-purple-500 ring-2 ring-purple-500/20"
          : "border-border hover:border-purple-500/40",
      )}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center z-10">
          <Check size={12} className="text-white" />
        </div>
      )}
      <div className="h-3 flex">
        {[p.primary, p.secondary, p.accent, p.neutral, p.background].map(
          (c, i) => (
            <div key={i} className="flex-1" style={{ background: c }} />
          ),
        )}
      </div>
      <div className="p-5 space-y-4" style={{ background: p.background }}>
        <div>
          <h3
            style={{ color: p.primary, fontWeight: 700, fontSize: 22 }}
            className="leading-tight"
          >
            {direction.name}
          </h3>
          <p style={{ color: p.neutral, fontSize: 12, marginTop: 4 }}>
            {direction.tagline}
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { hex: p.primary, label: "Primary" },
            { hex: p.secondary, label: "Secondary" },
            { hex: p.accent, label: "Accent" },
          ].map((s) => (
            <ColorSwatch key={s.hex} hex={s.hex} label={s.label} size="sm" />
          ))}
        </div>
        <div className="bg-white/30 rounded-lg px-3 py-2 space-y-0.5">
          <p className="font-mono text-[11px] text-[--text-muted] uppercase tracking-wider">
            Typographie
          </p>
          <p style={{ color: p.primary, fontSize: 14, fontWeight: 700 }}>
            {direction.typography.heading}
          </p>
          <p style={{ color: p.neutral, fontSize: 12 }}>
            {direction.typography.body}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {direction.keywords.map((kw) => (
            <span
              key={kw}
              className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium"
              style={{ background: `${p.accent}22`, color: p.accent }}
            >
              {kw}
            </span>
          ))}
        </div>
        <p className="text-xs leading-relaxed" style={{ color: p.neutral }}>
          {direction.mood.slice(0, 100)}…
        </p>
      </div>
    </button>
  );
}

// ── Hybrid Panel ──────────────────────────────────────────────────────────────

function HybridPanel({
  directions,
  onGenerate,
}: {
  directions: [BrandDirection, BrandDirection, BrandDirection];
  onGenerate: (paletteIdx: number, typoIdx: number, logoIdx: number) => void;
}) {
  const [paletteFrom, setPaletteFrom] = useState(0);
  const [typoFrom, setTypoFrom] = useState(1);
  const [logoFrom, setLogoFrom] = useState(0);

  const opts = directions.map((d, i) => ({ value: i, label: d.name }));

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-purple-500" />
        <p className="font-display font-semibold text-sm text-foreground">
          Créer une direction hybride
        </p>
      </div>
      <p className="text-xs text-[--text-muted]">
        Combine la palette, la typographie et le style de logo de différentes
        directions.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-1.5 block">
            Palette de
          </label>
          <select
            value={paletteFrom}
            onChange={(e) => setPaletteFrom(Number(e.target.value))}
            className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
          >
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-1.5 block">
            Typo de
          </label>
          <select
            value={typoFrom}
            onChange={(e) => setTypoFrom(Number(e.target.value))}
            className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
          >
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-1.5 block">
            Logo de
          </label>
          <select
            value={logoFrom}
            onChange={(e) => setLogoFrom(Number(e.target.value))}
            className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
          >
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onGenerate(paletteFrom, typoFrom, logoFrom)}
        className="flex items-center gap-2 text-sm font-display font-semibold text-purple-500 hover:opacity-70 transition-opacity"
      >
        <Sparkles size={13} /> Générer la direction hybride + logos
      </button>
    </div>
  );
}

// ── Logo Concept Card ─────────────────────────────────────────────────────────

function LogoConceptCard({
  concept,
  selected,
  onSelect,
  onSelectUrl,
  brandName,
  headingFont,
}: {
  concept: BrandLogoConcept;
  selected: boolean;
  onSelect: () => void;
  onSelectUrl: (url: string) => void;
  brandName?: string;
  headingFont?: string;
}) {
  const bgs = [
    {
      key: "logo_white_bg",
      label: "Fond blanc",
      bg: "#FFFFFF",
      url: concept.logo_white_bg,
      textColor: "#111111",
    },
    {
      key: "logo_brand_bg",
      label: "Fond couleur",
      bg: "#6366F1",
      url: concept.logo_brand_bg,
      textColor: "#FFFFFF",
    },
    {
      key: "logo_black_bg",
      label: "Fond noir",
      bg: "#000000",
      url: concept.logo_black_bg,
      textColor: "#FFFFFF",
    },
  ] as const;

  return (
    <div
      className={cn(
        "rounded-2xl border-2 overflow-hidden transition-all",
        selected
          ? "border-purple-500 ring-2 ring-purple-500/20"
          : "border-border",
      )}
    >
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="font-display font-semibold text-sm text-foreground">
          {concept.name}
        </p>
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
            selected
              ? "border-purple-500 bg-purple-500"
              : "border-border",
          )}
        >
          {selected && <Check size={10} className="text-white" />}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1 px-4 pb-4">
        {bgs.map(({ key, label, bg, url, textColor }) => (
          <div key={key} className="space-y-1">
            <div
              className="w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-purple-500/40 transition-all relative"
              style={{ background: bg }}
              onClick={() => url && onSelectUrl(url)}
              title={`Use as reference — ${label}`}
            >
              {url ? (
                <img
                  src={url}
                  alt={`${concept.name} — ${label}`}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <ImageIcon size={16} className="text-gray-400" />
              )}
              {brandName && (
                <div
                  className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-center"
                  style={{
                    fontFamily: headingFont ?? "inherit",
                    fontSize: "8px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    color: textColor,
                    background:
                      bg === "#FFFFFF"
                        ? "rgba(255,255,255,0.85)"
                        : bg === "#000000"
                          ? "rgba(0,0,0,0.7)"
                          : "rgba(0,0,0,0.35)",
                    textTransform: "uppercase",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {brandName}
                </div>
              )}
            </div>
            <p className="font-mono text-[11px] text-center text-[--text-muted]">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Asset Card ────────────────────────────────────────────────────────────────

function AssetCard({
  assetKey,
  label,
  url,
  brief,
  direction,
  referenceUrl,
  onRegenerated,
  onSetReference,
}: {
  assetKey: string;
  label: string;
  url?: string;
  brief: BrandBrief;
  direction: BrandDirection;
  referenceUrl?: string;
  onRegenerated: (key: string, newUrl: string) => void;
  onSetReference: (url: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  async function handleDownloadAsset(assetUrl: string) {
    setDownloading(true);
    try {
      const res = await fetch(assetUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = assetUrl.includes(".png")
        ? ".png"
        : assetUrl.includes(".jpg")
          ? ".jpg"
          : ".png";
      a.download = `${label.toLowerCase().replace(/\s+/g, "-")}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Download error.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleRegen() {
    setLoading(true);
    try {
      const data = await callApi<Record<string, string | undefined>>(
        "/api/brand-visuals",
        {
          brief,
          direction,
          referenceUrl,
        },
      );
      const newUrl = data[assetKey];
      if (newUrl) onRegenerated(assetKey, newUrl);
      else toast.error("No results for this asset.");
    } catch {
      toast.error("Regeneration error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">
          {label}
        </p>
        <div className="flex items-center gap-2">
          {url && (
            <button
              type="button"
              onClick={() => onSetReference(url)}
              className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5"
            >
              <ImageIcon size={9} /> Référence
            </button>
          )}
          <button
            type="button"
            onClick={handleRegen}
            disabled={loading}
            className="flex items-center gap-1 text-[11px] text-[--text-muted] hover:text-foreground transition-colors disabled:opacity-40"
          >
            {loading ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <RefreshCw size={10} />
            )}
            Regénérer
          </button>
        </div>
      </div>
      <div
        className="relative rounded-2xl overflow-hidden border border-border bg-card aspect-video flex items-center justify-center group cursor-pointer"
        onClick={() => {
          if (url && !loading) setLightboxOpen(true);
        }}
        aria-label={url ? `Agrandir ${label}` : undefined}
        tabIndex={url ? 0 : undefined}
        onKeyDown={
          url
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") setLightboxOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <Loader2 size={24} className="text-[--text-muted] animate-spin" />
        ) : url ? (
          <>
            <img src={url} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <ZoomIn size={24} className="text-white drop-shadow" />
            </div>
          </>
        ) : (
          <ImageIcon size={24} className="text-[--text-muted]" />
        )}
      </div>
      {url && (
        <button
          type="button"
          onClick={() => handleDownloadAsset(url)}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 text-xs text-blue-500 font-medium hover:underline disabled:opacity-50"
        >
          <Download size={10} /> {downloading ? "…" : "Download"}
        </button>
      )}
      {/* Lightbox */}
      {lightboxOpen && url && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            onClick={() => setLightboxOpen(false)}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
          <img
            src={url}
            alt={label}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-xs text-white/60 uppercase tracking-widest">
            {label}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Charte Section ────────────────────────────────────────────────────────────

function CharteSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-border rounded-2xl p-5 space-y-3">
      <h3 className="font-display font-bold text-foreground text-sm">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Main Brand Studio ─────────────────────────────────────────────────────────

export function BrandStudio() {
  const [step, setStep] = useState<BrandStudioStep>("brief");
  const [brief, setBrief] = useState<BrandBrief | null>(null);
  const [analysis, setAnalysis] = useState<BrandAnalysisResult | null>(null);
  const [strategy, setStrategy] = useState<BrandStrategy | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logos, setLogos] = useState<BrandLogos | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null); // selected concept name
  const [referenceUrl, setReferenceUrl] = useState<string | undefined>(
    undefined,
  );
  const [assets, setAssets] = useState<BrandAssets | null>(null);
  const [charte, setCharte] = useState<BrandCharte | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [briefIssues, setBriefIssues] = useState<string[]>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [contradictionPaths, setContradictionPaths] = useState<
    ContradictionPath[] | null
  >(null);

  const selectedDirection =
    strategy?.directions.find((d) => d.id === selectedId) ?? null;

  // ── Brief → Analyst ──

  async function handleBriefSubmit(b: BrandBrief) {
    setBrief(b);
    setLoading(true);
    setLoadingMsg("Brand Analyst evaluating your brief…");
    try {
      const result = await callApi<BrandAnalysisResult>(
        "/api/brand-analyst",
        b,
      );
      setAnalysis(result);
    } catch (err) {
      // Check if this is a 409 BRIEF_CONTRADICTION_DETECTED response
      if (
        err instanceof ApiError &&
        err.data.code === "BRIEF_CONTRADICTION_DETECTED"
      ) {
        const paths =
          (err.data.contradiction_paths as ContradictionPath[] | undefined) ??
          [];
        const contradictions =
          (err.data.contradictions as string[] | undefined) ?? [];
        setContradictionPaths(paths);
        // Show contradiction modal (will show when step === 'brief')
        setAnalysis({
          is_ready: false,
          brief_score: (err.data.brief_score as number) ?? 60,
          contradictions,
          has_contradiction: true,
          contradiction_paths: paths,
          questions: [],
          suggestions: [],
        } as BrandAnalysisResult);
      } else if (
        err instanceof ApiError &&
        err.data.code === "BRIEF_QUALITY_INSUFFICIENT"
      ) {
        const questions =
          (err.data.clarification_questions as string[] | undefined) ?? [];
        setBriefIssues(questions);
        // Show analyst modal with quality issues
        setAnalysis({
          is_ready: false,
          brief_quality: "insufficient",
          brief_score: err.data.brief_score ?? 40,
          contradictions: err.data.contradictions ?? [],
          questions: questions,
          suggestions: err.data.suggestions ?? [],
        } as BrandAnalysisResult);
      } else {
        // If analyst fails for other reasons, continue anyway
        setAnalysis(null);
        await generateStrategy(b);
      }
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }

  // ── Handle contradiction path selection ──

  async function handleSelectContradictionPath(resolution: string) {
    if (!brief) return;
    // Append the selected resolution to the brief's ambiance context
    const enhancedBrief: BrandBrief = {
      ...brief,
      ambiance: brief.ambiance,
      // Store the chosen resolution as a hidden context (via references field if needed)
      // For now, we'll pass it as part of a metadata approach or store it locally
    };
    // Clear the contradiction paths modal
    setContradictionPaths(null);
    setAnalysis(null);
    // Continue with the selected path by generating strategy with resolution context
    // We'll append the resolution to loadingMsg to provide context to the user
    setLoading(true);
    setLoadingMsg(
      `Claude génère 3 directions créatives (direction: ${resolution})…`,
    );
    try {
      // Re-call generateStrategy with enhanced context
      const data = await callApi<BrandStrategy>(
        "/api/brand-strategy",
        enhancedBrief,
      );
      setStrategy(data);
      setStep("strategy");
    } catch (err) {
      if (err instanceof ApiError && err.data.code === "BRIEF_QUALITY_GATE") {
        const issues = (err.data.issues as string[] | undefined) ?? [];
        setBriefIssues(issues);
        setStep("brief");
      } else {
        toast.error(
          err instanceof Error ? err.message : "Generation error.",
        );
      }
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }

  // ── Generate strategy (called after analyst confirms or skipped) ──

  async function generateStrategy(b: BrandBrief) {
    setAnalysis(null);
    setBriefIssues([]);
    setLoading(true);
    setLoadingMsg("Claude generating 3 creative directions…");
    try {
      const data = await callApi<BrandStrategy>("/api/brand-strategy", b);
      setStrategy(data);
      setStep("strategy");
    } catch (err) {
      if (err instanceof ApiError && err.data.code === "BRIEF_QUALITY_GATE") {
        const issues = (err.data.issues as string[] | undefined) ?? [];
        setBriefIssues(issues);
        // Scroll back to brief form so user sees the errors
        setStep("brief");
      } else {
        toast.error(
          err instanceof Error ? err.message : "Generation error.",
        );
      }
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }

  // ── Strategy → generate hybrid ──

  async function handleHybridGenerate(
    paletteIdx: number,
    typoIdx: number,
    logoIdx: number,
  ) {
    if (!strategy || !brief) return;
    setLoading(true);
    setLoadingMsg("Claude generating hybrid direction…");
    try {
      const hybrid = await callApi<BrandDirection>("/api/brand-hybrid", {
        directions: strategy.directions,
        palette_from: paletteIdx,
        typography_from: typoIdx,
        logo_from: logoIdx,
      });
      // Inject hybrid into a pseudo strategy clone
      const next = {
        ...strategy,
        directions: [
          strategy.directions[0],
          strategy.directions[1],
          strategy.directions[2],
        ],
      } as BrandStrategy;
      // Add hybrid as a 4th that replaces the selected or appended
      (next as any).hybrid = hybrid;
      setStrategy(next);
      setSelectedId(hybrid.id);
      toast.success("Hybrid direction generated.");

      // Auto-regenerate logos with the hybrid direction
      setLoadingMsg(
        "Auto-regenerating logos for hybrid direction…",
      );
      const logoData = await callApi<BrandLogos>("/api/brand-logos", {
        brief,
        direction: hybrid,
      });
      setLogos(logoData);
      setStep("logos");
      toast.success("Logos regenerated with hybrid direction.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hybridation error.");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }

  // ── Strategy → Logos ──

  async function handleDirectionToLogos() {
    if (!brief || !selectedDirection) return;
    setLoading(true);
    setLoadingMsg("fal.ai recraft-v3 generating 3 logo concepts × 3 backgrounds…");
    try {
      const data = await callApi<BrandLogos>("/api/brand-logos", {
        brief,
        direction: selectedDirection,
      });
      setLogos(data);
      setStep("logos");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Logo generation error.",
      );
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }

  // ── Logos → Assets ──

  async function handleLogosToAssets() {
    if (!brief || !selectedDirection) return;
    const selectedConcept = logos?.concepts.find(
      (c) => c.name === selectedLogo,
    );
    const logoUrl =
      selectedConcept?.logo_white_bg ?? selectedConcept?.logo_brand_bg;
    setLoading(true);
    setLoadingMsg("fal.ai generating 10 brand visuals in batches…");
    try {
      const data = await callApi<BrandAssets>("/api/brand-visuals", {
        brief,
        direction: selectedDirection,
        referenceUrl: logoUrl ?? referenceUrl,
      });
      setAssets(data);
      setStep("assets");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Asset generation error.",
      );
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }

  // ── Per-asset update ──

  const handleAssetRegenerated = useCallback((key: string, newUrl: string) => {
    setAssets((prev) => (prev ? { ...prev, [key]: newUrl } : prev));
  }, []);

  // ── Assets → Charte ──

  async function handleGenerateCharte() {
    if (!brief || !selectedDirection) return;
    setLoading(true);
    setLoadingMsg("Claude drafting complete brand guidelines…");
    try {
      const data = await callApi<BrandCharte>("/api/brand-charte", {
        brief,
        direction: selectedDirection,
      });
      setCharte(data);
      setStep("charte");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Guidelines generation error.",
      );
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }

  // ── Export PDF ──

  async function handleDownloadPdf() {
    if (!brief || !selectedDirection || !charte) return;
    try {
      const res = await fetch("/api/brand-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          direction: selectedDirection,
          charte,
          assets,
        }),
      });
      if (!res.ok) throw new Error();
      const html = await res.text();
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Popups blocked - allow popups");
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 800);
    } catch {
      toast.error("PDF generation error.");
    }
  }

  // ── Export ZIP ──

  async function handleDownloadZip() {
    if (!brief || !selectedDirection || !charte) return;
    try {
      const slug = brief.name.toLowerCase().replace(/\s+/g, "-");
      const res = await fetch("/api/brand-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          direction: selectedDirection,
          charte,
          assets: assets ?? {},
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-brand-kit.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Brand kit ZIP downloaded.");
    } catch {
      toast.error("ZIP download error.");
    }
  }

  // ── Share ZIP (upload to Supabase → signed URL) ──

  async function handleShareZip() {
    if (!brief || !selectedDirection || !charte) return;
    setSharing(true);
    try {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const res = await fetch("/api/brand-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          direction: selectedDirection,
          charte,
          assets: assets ?? {},
          userId: user?.id,
          share: true,
        }),
      });
      const data = (await res.json()) as { signedUrl?: string; error?: string };
      if (!res.ok || !data.signedUrl) throw new Error(data.error ?? "Error");
      setShareUrl(data.signedUrl);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Sharing error.",
      );
    } finally {
      setSharing(false);
    }
  }

  async function handleCopyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Export JSON ──

  function handleExportJson() {
    const exportData = {
      brief,
      strategy,
      direction: selectedDirection,
      logos,
      assets,
      charte,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${brief?.name?.toLowerCase().replace(/\s+/g, "-") ?? "brand"}-identity.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Brand kit exported as JSON");
  }

  // ── Loading overlay ──

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
          <Loader2 size={24} className="text-purple-500 animate-spin" />
        </div>
        <p className="font-display font-semibold text-foreground">
          {loadingMsg}
        </p>
        <p className="text-[--text-muted] text-sm">Cela prend 30–120 secondes…</p>
      </div>
    );
  }

  // ── Analyst modal overlay ──

  const showAnalyst = !!analysis && step === "brief";
  const showContradictions =
    analysis?.has_contradiction && contradictionPaths && step === "brief";

  return (
    <>
      {showContradictions && brief && contradictionPaths && (
        <ContradictionPathsModal
          paths={contradictionPaths}
          contradictions={analysis!.contradictions}
          onSelectPath={handleSelectContradictionPath}
          onEdit={() => {
            setAnalysis(null);
            setContradictionPaths(null);
          }}
        />
      )}
      {showAnalyst && !showContradictions && brief && (
        <AnalystModal
          analysis={analysis!}
          onContinue={() => generateStrategy(brief)}
          onEdit={() => setAnalysis(null)}
        />
      )}

      <div className="flex flex-col h-full overflow-y-auto px-8 py-8 max-w-4xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Identité de marque
          </h1>
          <p className="text-[--text-muted] text-sm mt-1">
            Brief → Strategy → Logos → Visuals → Guidelines → Export
          </p>
        </div>

        <Stepper current={step} />

        {/* ── STEP 1: Brief ── */}
        {step === "brief" && (
          <BriefForm onSubmit={handleBriefSubmit} qualityIssues={briefIssues} />
        )}

        {/* ── STEP 2: Strategy ── */}
        {step === "strategy" && strategy && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2">
                Voix de marque
              </p>
              <p className="text-sm text-foreground font-medium mb-3">
                {strategy.voice.tone}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[11px] text-green-600 uppercase tracking-wider mb-1.5">
                    ✓ À faire
                  </p>
                  <ul className="space-y-1">
                    {strategy.voice.dos.slice(0, 3).map((d, i) => (
                      <li key={i} className="text-xs text-foreground">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[11px] text-red-500 uppercase tracking-wider mb-1.5">
                    ✗ À éviter
                  </p>
                  <ul className="space-y-1">
                    {strategy.voice.donts.slice(0, 3).map((d, i) => (
                      <li key={i} className="text-xs text-foreground">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-4">
                Sélectionne ta direction créative
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {strategy.directions.map((dir) => (
                  <DirectionCard
                    key={dir.id}
                    direction={dir}
                    selected={selectedId === dir.id}
                    onSelect={() => setSelectedId(dir.id)}
                  />
                ))}
              </div>
            </div>

            {/* Hybrid panel — show if hybrid exists */}
            {(strategy as any).hybrid && (
              <div className="mt-2">
                <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-3">
                  Direction hybride
                </p>
                <DirectionCard
                  direction={(strategy as any).hybrid}
                  selected={selectedId === (strategy as any).hybrid.id}
                  onSelect={() => setSelectedId((strategy as any).hybrid.id)}
                />
              </div>
            )}

            <HybridPanel
              directions={strategy.directions}
              onGenerate={handleHybridGenerate}
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep("brief")}
                className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} /> Modifier le brief
              </button>
              <button
                type="button"
                onClick={handleDirectionToLogos}
                disabled={!selectedId}
                className="flex items-center gap-2 bg-foreground text-white font-display font-semibold text-sm px-6 py-2.5 rounded-xl disabled:opacity-40 hover:opacity-80 transition-opacity"
              >
                <ChevronRight size={14} /> Générer les logos
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Logos ── */}
        {step === "logos" && logos && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">
                3 concepts de logo × 3 fonds
              </p>
              <button
                type="button"
                onClick={handleDirectionToLogos}
                className="flex items-center gap-1.5 text-xs text-[--text-muted] hover:text-foreground transition-colors"
              >
                <RefreshCw size={12} /> Regénérer
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {logos.concepts.map((concept) => (
                <LogoConceptCard
                  key={concept.name}
                  concept={concept}
                  selected={selectedLogo === concept.name}
                  onSelect={() => setSelectedLogo(concept.name)}
                  onSelectUrl={(url) => {
                    setReferenceUrl(url);
                    toast.success("Set as reference image.");
                  }}
                  brandName={brief?.name}
                  headingFont={selectedDirection?.typography?.heading}
                />
              ))}
            </div>

            {referenceUrl && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                <img
                  src={referenceUrl}
                  alt="Reference"
                  className="w-8 h-8 rounded-lg object-contain border border-border"
                />
                <p className="text-xs text-foreground flex-1">
                  Image de référence sélectionnée pour les assets
                </p>
                <button
                  type="button"
                  onClick={() => setReferenceUrl(undefined)}
                >
                  <X size={14} className="text-[--text-muted]" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep("strategy")}
                className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} /> Changer de direction
              </button>
              <button
                type="button"
                onClick={handleLogosToAssets}
                className="flex items-center gap-2 bg-foreground text-white font-display font-semibold text-sm px-6 py-2.5 rounded-xl hover:opacity-80 transition-opacity"
              >
                <ChevronRight size={14} /> Générer les visuels
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Assets ── */}
        {step === "assets" && assets && brief && selectedDirection && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">
                Direction : {selectedDirection.name}
              </p>
              {referenceUrl && (
                <div className="flex items-center gap-1.5 text-xs text-[--text-muted]">
                  <img
                    src={referenceUrl}
                    alt="ref"
                    className="w-5 h-5 rounded object-contain border border-border"
                  />
                  Référence active
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {Object.entries(ASSET_LABELS).map(([key, label]) => (
                <AssetCard
                  key={key}
                  assetKey={key}
                  label={label}
                  url={(assets as any)[key]}
                  brief={brief}
                  direction={selectedDirection}
                  referenceUrl={referenceUrl}
                  onRegenerated={handleAssetRegenerated}
                  onSetReference={(url) => {
                    setReferenceUrl(url);
                    toast.success("Reference updated.");
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep("logos")}
                className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} /> Retour aux logos
              </button>
              <button
                type="button"
                onClick={handleGenerateCharte}
                className="flex items-center gap-2 bg-foreground text-white font-display font-semibold text-sm px-6 py-2.5 rounded-xl hover:opacity-80 transition-opacity"
              >
                <ChevronRight size={14} /> Générer la charte graphique
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 5: Charte ── */}
        {step === "charte" && charte && selectedDirection && (
          <div className="space-y-4">
            <CharteSection title="Color palette">
              <div className="flex flex-wrap gap-4">
                {charte.colors.map((c) => (
                  <div key={c.hex} className="flex items-center gap-3">
                    <ColorSwatch hex={c.hex} />
                    <div>
                      <p className="font-display font-semibold text-sm text-foreground">
                        {c.name}
                      </p>
                      <p className="font-mono text-xs text-[--text-muted]">
                        {c.hex} · {c.rgb}
                      </p>
                      <p className="text-xs text-[--text-muted] mt-0.5 max-w-48">
                        {c.usage}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CharteSection>

            <CharteSection title="Typography">
              <div className="space-y-3">
                {Object.entries(charte.typography).map(([level, t]) => (
                  <div
                    key={level}
                    className="flex items-start gap-4 py-2 border-b border-border last:border-0"
                  >
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[--text-muted] w-16 pt-0.5 shrink-0">
                      {level}
                    </span>
                    <div className="flex-1">
                      <p className="font-display font-semibold text-sm text-foreground">
                        {t.font}
                      </p>
                      <p className="font-mono text-xs text-[--text-muted]">
                        {t.weight} · {t.sizes}
                      </p>
                      <p className="text-xs text-[--text-muted] mt-0.5">
                        {t.usage}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CharteSection>

            <CharteSection title="Logo usage rules">
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold text-foreground">
                    Espace de protection :
                  </span>{" "}
                  <span className="text-[--text-muted]">
                    {charte.logo_rules.clear_space}
                  </span>
                </p>
                <div>
                  <p className="font-semibold text-foreground mb-1">
                    Fonds autorisés
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {charte.logo_rules.allowed_backgrounds.map((bg, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs"
                      >
                        {bg}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">
                    Interdits
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {charte.logo_rules.forbidden.map((f, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CharteSection>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CharteSection title="Page layout">
                <div className="space-y-2 text-sm text-[--text-muted]">
                  <p>
                    <span className="font-semibold text-foreground">
                      Grille :
                    </span>{" "}
                    {charte.layout.grid}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">
                      Espacement :
                    </span>{" "}
                    {charte.layout.spacing}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">
                      Marges :
                    </span>{" "}
                    {charte.layout.margins}
                  </p>
                </div>
              </CharteSection>
              <CharteSection title="Photography direction">
                <div className="space-y-2 text-sm text-[--text-muted]">
                  <p>{charte.photography.style}</p>
                  <p className="italic">{charte.photography.mood}</p>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {charte.photography.forbidden.map((f, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs"
                      >
                        ✗ {f}
                      </span>
                    ))}
                  </div>
                </div>
              </CharteSection>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep("assets")}
                className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} /> Retour aux visuels
              </button>
              <button
                type="button"
                onClick={() => setStep("export")}
                className="flex items-center gap-2 bg-foreground text-white font-display font-semibold text-sm px-6 py-2.5 rounded-xl hover:opacity-80 transition-opacity"
              >
                <ChevronRight size={14} /> Exporter le brand kit
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 6: Export ── */}
        {step === "export" && brief && selectedDirection && (
          <div className="space-y-6 max-w-lg">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-bold text-lg"
                  style={{ background: selectedDirection.palette.primary }}
                >
                  {brief.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-display font-bold text-foreground">
                    {brief.name}
                  </p>
                  <p className="text-xs text-[--text-muted]">
                    {selectedDirection.name} · {brief.secteur}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5">
                {[
                  selectedDirection.palette.primary,
                  selectedDirection.palette.secondary,
                  selectedDirection.palette.accent,
                  selectedDirection.palette.neutral,
                ].map((c, i) => (
                  <div
                    key={i}
                    className="flex-1 h-3 rounded-full"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {/* PDF */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!charte}
                className="flex items-center gap-3 w-full bg-foreground text-white font-display font-semibold text-sm px-5 py-3.5 rounded-xl hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                <FileText size={16} />
                <div className="text-left">
                  <p>Download brand guidelines PDF</p>
                  <p className="text-xs font-body font-normal opacity-70">
                    HTML → imprimer en PDF depuis le navigateur
                  </p>
                </div>
              </button>

              {/* ZIP */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={!charte}
                  className="flex items-center gap-3 flex-1 border border-border bg-white text-foreground font-display font-semibold text-sm px-5 py-3.5 rounded-xl hover:bg-card transition-colors disabled:opacity-40"
                >
                  <Archive size={16} />
                  <div className="text-left">
                    <p>Download brand kit ZIP</p>
                    <p className="text-xs font-body font-normal text-[--text-muted]">
                      Logos + mockups + palette.json + charte.html
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleShareZip}
                  disabled={!charte || sharing}
                  title="Share a download link"
                  className="flex items-center justify-center gap-1.5 border border-border bg-white text-foreground font-display font-semibold text-sm px-3.5 rounded-xl hover:bg-card transition-colors disabled:opacity-40"
                >
                  {sharing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Share2 size={16} />
                  )}
                </button>
              </div>

              {/* Share URL panel */}
              {shareUrl && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-xl">
                  <input
                    readOnly
                    value={shareUrl}
                    title="Lien de partage du brand kit"
                    aria-label="Lien de partage du brand kit"
                    className="flex-1 bg-transparent text-xs font-mono text-[--text-muted] truncate outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyShareUrl}
                    title="Copier le lien"
                    className="flex items-center gap-1 text-xs font-semibold text-purple-500 hover:opacity-70 transition-opacity shrink-0"
                  >
                    {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copier"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareUrl(null)}
                    title="Fermer"
                    className="text-[--text-muted] hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* JSON */}
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-3 w-full border border-border bg-white text-foreground font-display font-semibold text-sm px-5 py-3.5 rounded-xl hover:bg-card transition-colors"
              >
                <Download size={16} />
                <div className="text-left">
                  <p>Exporter en JSON</p>
                  <p className="text-xs font-body font-normal text-[--text-muted]">
                    Strategy + palette + typography + guidelines
                  </p>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setStep("brief");
                setBrief(null);
                setAnalysis(null);
                setStrategy(null);
                setSelectedId(null);
                setLogos(null);
                setSelectedLogo(null);
                setReferenceUrl(undefined);
                setAssets(null);
                setCharte(null);
              }}
              className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-foreground transition-colors"
            >
              <RefreshCw size={13} /> Créer une nouvelle identité
            </button>
          </div>
        )}
      </div>
    </>
  );
}
