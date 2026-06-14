# CLYRO Design Tokens

This document captures the standardized design tokens and patterns used across the CLYRO web app. Use it as the source of truth when building or auditing UI.

## Visual identity (HeyGen-inspired, light-first)

- **Default theme is LIGHT** (`defaultTheme="light"` in `theme-provider.tsx`); dark mode stays available via the toggle.
- **App background** is soft neutral grey `#F7F7F8`; **surfaces (cards, sidebar, topbar, modals) are white** with 1px `#E5E7EB` borders and soft shadows (`shadow-sm` / `shadow-card`).
- **Primary / accent is violet** `#6D4AFF` (`--primary`, `brand` in Tailwind). Hover `#5B3BE0` (`brand-hover`). Pale violet surface `#F0EDFF` (`--accent`, `brand-soft`) for active nav items and selections, paired with `--accent-foreground` `#5B3BE0`.
- Primary buttons are solid violet with white text; secondary buttons are white with a thin border.
- All UI text is sans-serif (Inter via `font-display` / `font-body`); JetBrains Mono only for technical micro-labels.
- Contrast (light mode): `#6D4AFF` on white = 5.16:1 (AA normal text), `#5B3BE0` on `#F0EDFF` = 5.8:1, body `#111827` on white = 17.7:1, secondary `#4B5563` = 7.6:1, muted `#6B7280` = 4.8:1.

## Radius

Use Tailwind's radius scale with the following intent per element class:

| Element                                | Class        | Value  |
| -------------------------------------- | ------------ | ------ |
| Inline pill, badge, small chip         | `rounded-md` | 6 px   |
| Form input, small button               | `rounded-lg` | 8 px   |
| Primary / icon button, nav item        | `rounded-xl` | 12 px  |
| Card, panel, modal, empty-state        | `rounded-2xl`| 16 px  |
| Full circle (avatar, status dot)       | `rounded-full` | 9999 px |

Avoid mixing radii inside the same card — keep siblings consistent.

## Text sizes

| Context                                      | Class         | Pixel |
| -------------------------------------------- | ------------- | ----- |
| Metadata / micro-labels (avoid going below)  | `text-[11px]` | 11 px |
| Secondary metadata, count badges             | `text-xs`     | 12 px |
| Body text, form labels                       | `text-sm`     | 14 px |
| Default paragraph                            | `text-base`   | 16 px |
| Card title                                   | `text-lg`     | 18 px |
| Page h1                                      | `text-xl`     | 20 px |
| Dashboard hero / empty-state title           | `text-2xl`    | 24 px |

Never use `text-[10px]` or below for anything a user needs to read — it fails WCAG
reading-size expectations and is hostile on dense dashboards.

## Icon sizes (Lucide `size` prop)

| Context                           | Size |
| --------------------------------- | ---- |
| Inline with small text            | 12   |
| Inline with body, nav dots        | 14   |
| Button content (default)          | 16   |
| Card hero, dropdown leading icon  | 20   |
| Empty-state, modal header         | 24   |
| Empty-state `size="lg"`           | 32   |

## Touch targets

Interactive elements must be **≥ 40 × 40 px**. For compact icon buttons use either:

- `w-10 h-10` directly, or
- a smaller visual element plus a pseudo-element to expand the hit area:
  ```tsx
  className="relative w-6 h-6 after:absolute after:inset-[-6px]"
  ```

The visible icon may remain smaller; what matters is the hit region.

## Focus states

Every interactive element must show a visible focus ring when navigated via keyboard.
Use the standardized pattern:

```ts
'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
```

Form inputs pair `focus-visible:border-primary` with the ring; icon buttons and
nav items use just the ring (`ring-ring/50`). Never use `outline-none` without a
replacement — it removes keyboard visibility and breaks WCAG 2.4.7.

**Selection state** (cards, options, styles) uses `ring-brand` or `ring-primary`
to indicate the active/selected item — this is distinct from the focus ring.

## Color tokens

CSS custom properties defined in `globals.css`:

| Token                 | Purpose                                    | Light value |
| --------------------- | ------------------------------------------ | ----------- |
| `--background`        | App background (soft grey)                 | `#F7F7F8`   |
| `--card`              | Surfaces — cards, sidebar, topbar, modals  | `#FFFFFF`   |
| `--foreground`        | Primary text                               | `#111827`   |
| `--text-secondary`    | De-emphasised text (headings, labels)      | `#4B5563`   |
| `--text-muted`        | Metadata, placeholders                     | `#6B7280`   |
| `--border`            | Default border, dividers                   | `#E5E7EB`   |
| `--muted`             | Subtle surface (hover, cards within cards) | `#F3F4F6`   |
| `--primary` / `brand` | Violet primary — CTAs, active accents      | `#6D4AFF`   |
| `--accent`            | Pale violet — active nav, selections       | `#F0EDFF`   |
| `--accent-foreground` | Text/icon on pale violet                   | `#5B3BE0`   |
| `--ring`              | Focus ring                                 | `#6D4AFF`   |

Reach for these tokens rather than hardcoding `text-gray-500` / `border-zinc-200`.
Dark mode is handled at the token level (dark primary is `#7C5CFF`), so component
code stays theme-neutral. When an opacity modifier is needed (`/10`, `/15`…), use
the literal-hex `brand` scale (`bg-brand/10`) — CSS-var tokens ignore alpha
modifiers.

Accent gradients live in component code and follow this pattern (see `EmptyState`):

```ts
'from-brand/15 to-violet-500/15 text-brand'
'from-emerald-500/15 to-blue-500/15 text-emerald-500'
'from-amber-500/15 to-orange-500/15 text-amber-500'
```

Per-module feature colors (`feature.faceless` blue, `feature.motion` violet,
`feature.avatar` pink, `feature.brand` teal, `feature.autopilot` amber) are kept
for icon tiles and status chips — only generic chrome uses the violet brand.

## Accessibility requirements

Every page / component must satisfy:

1. **Semantic landmarks** — one `<h1>` per page, section headings stepped logically.
2. **Dialog contract** — modals use `role="dialog"`, `aria-modal="true"`, and
   `aria-labelledby` pointing at the title. Escape closes the modal.
3. **State announcements** — expandable cards use `aria-expanded`, toggle buttons
   use `aria-pressed`, icon-only buttons have `aria-label`.
4. **Empty / loading states** — use the shared `<EmptyState>` component with
   `role="status"` (already baked in).
5. **Localized strings** — no hardcoded English in JSX; route through
   `t('key')` from `useLanguage()`.

## Languages

Two independent language lists exist and must not be conflated:

- **UI language** (`LanguageSwitcher.tsx`) — `en`, `fr`, `es`, `de`, `pt`.
  Controls the dashboard interface.
- **Video / narration language** (`studio/new/page.tsx LANGUAGES` const) — 12
  languages supported by the HeyGen + ElevenLabs pipeline. Controls the
  generated video's spoken language.

When adding a new UI language, also add a new block in `lib/translations.ts`.
When adding a new narration language, extend the `LANGUAGES` const only.

## Components to reach for

| Need                       | Component                                  |
| -------------------------- | ------------------------------------------ |
| Zero / empty state         | `components/ui/empty-state.tsx`            |
| Button with variants       | `components/ui/button.tsx`                 |
| Card shell                 | `components/ui/card.tsx`                   |
| Copyable code              | `components/ui/copy-button.tsx`            |
| Page-level nav             | `components/layout/Sidebar.tsx`            |
| Language switching         | `components/ui/LanguageSwitcher.tsx`       |

Prefer extending these over inventing new one-offs.
