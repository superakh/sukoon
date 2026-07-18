# Sukoon Frontend — Snowpeak Overlay

This directory holds the **Sukoon overlay layer** that gets applied *on top of* the Snowpeak Astro theme. Snowpeak itself is not yet purchased — nothing under `snowpeak/` exists here. Everything under `src/` is Sukoon's own code and stays under our control forever.

The overlay is written so we **never edit Snowpeak's source**. When Snowpeak ships an update we can drop the new zip in and the overlay keeps working.

## Layout

```
cf/frontend/
├── snowpeak/                    (arrives later — untouched)
│   ├── src/
│   ├── astro.config.mjs
│   ├── package.json
│   └── tailwind.config.mjs      (or Tailwind v4 CSS-first config)
└── src/
    ├── styles/
    │   ├── sukoon-palette.css       Indian-dusk color tokens (@theme + :root)
    │   └── sukoon-typography.css    Fraunces + Inter Tight + Tiro Devanagari
    └── components/
        ├── CrisisBar.astro          EN+HI crisis helplines, top of every page
        ├── LangToggle.astro         EN / HI persisted to localStorage
        ├── DailyMantra.astro        SSR mantra card from /api/daily
        └── BottomNav.astro          Mobile 5-tab + floating SOS heart
```

## Integration steps — when Snowpeak arrives

### 1. Unpack Snowpeak

```bash
cd "/Users/mustafamun/Happy Minds SAAS/sukoon/cf/frontend"
unzip ~/Downloads/snowpeak-*.zip -d snowpeak/
cd snowpeak
npm install
```

You should now be able to run `npm run dev` and see the vanilla Snowpeak theme at http://localhost:4321.

### 2. Wire the overlay into Snowpeak's global CSS

Open Snowpeak's main global stylesheet (typically `snowpeak/src/styles/global.css` — check the file that is imported by `snowpeak/src/layouts/Layout.astro`). At the **top** of that file, add:

```css
@import '../../../src/styles/sukoon-palette.css';
@import '../../../src/styles/sukoon-typography.css';
```

The `@theme` block inside `sukoon-palette.css` overrides Snowpeak's Tailwind v4 color tokens (`--color-background`, `--color-primary`, `--color-accent`, `--color-card`, etc.) so every Snowpeak utility class (`bg-background`, `text-primary`, ...) automatically renders in our dusk palette — without touching a single Snowpeak component.

### 3. Mount the overlay components in Snowpeak's layout

Open Snowpeak's root layout (`snowpeak/src/layouts/Layout.astro` or the closest equivalent) and edit **only** the shell — do not change the theme's markup. At the top:

```astro
---
import CrisisBar   from '../../../src/components/CrisisBar.astro';
import LangToggle  from '../../../src/components/LangToggle.astro';
import BottomNav   from '../../../src/components/BottomNav.astro';
// (existing Snowpeak imports stay as-is)
---
```

Inside `<body>`, wrap Snowpeak's content:

```astro
<body>
  <CrisisBar />
  <LangToggle />

  <!-- existing Snowpeak header + <slot /> stay untouched -->

  <BottomNav />
</body>
```

### 4. Drop the DailyMantra on the home page

Wherever Snowpeak's index page has its hero section, add:

```astro
---
import DailyMantra from '../../../src/components/DailyMantra.astro';
---

<DailyMantra />
```

`DailyMantra` fetches `/api/daily` at request time. Add a Cloudflare Pages Function at `snowpeak/functions/api/daily.ts` (or `snowpeak/src/pages/api/daily.ts` if Snowpeak uses Astro endpoints) that returns the JSON shape documented at the top of `src/components/DailyMantra.astro`.

### 5. Build and deploy

Snowpeak already ships with the Cloudflare Pages adapter (`@astrojs/cloudflare`). From inside `snowpeak/`:

```bash
npm run build          # writes dist/
wrangler pages deploy dist/ --project-name sukoon
```

The build inlines both overlay stylesheets and bundles the four `.astro` components. Nothing about the deploy pipeline changes when Snowpeak updates — only re-run steps 2–4 against the new zip.

## What must NOT change without a design review

- The palette: no rose, no marigold, no extra warm hues. Whitespace instead.
- The crisis bar: dismissible only for the current pageload, never permanently.
- The mantra surface: still. No animated background.
- Fonts: Fraunces / Inter Tight / Tiro Devanagari Hindi.
- SOS button: inline SVG heart, never an emoji.

These are the round-3 lessons — encoded in code and in this README so we don't relearn them.
