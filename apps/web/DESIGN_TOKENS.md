# CLYRO Design Tokens

This document captures the standardized design tokens and patterns used across the CLYRO web app. Use it as the source of truth when building or auditing UI.

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
'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500'
```

Form inputs pair `focus-visible:border-blue-500` with the ring; icon buttons and
nav items use just the ring. Never use `outline-none` without a replacement — it
removes keyboard visibility and breaks WCAG 2.4.7.

## Color tokens

CSS custom properties defined in `globals.css`:

| Token               | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `--foreground`      | Primary text                               |
| `--text-secondary`  | De-emphasised text (headings, labels)      |
| `--text-muted`      | Metadata, placeholders, disabled states    |
| `--border`          | Default border, dividers                   |
| `--muted`           | Subtle surface (cards within cards)        |
| `--background`      | App background                             |

Reach for these tokens rather than hardcoding `text-gray-500` / `border-zinc-200`.
Dark mode is handled at the token level, so component code stays theme-neutral.

Accent gradients live in component code and follow this pattern (see `EmptyState`):

```ts
'from-blue-500/15 to-purple-500/15 text-blue-500'
'from-emerald-500/15 to-blue-500/15 text-emerald-500'
'from-amber-500/15 to-orange-500/15 text-amber-500'
```

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
