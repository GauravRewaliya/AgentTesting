---
audience: dev
title: Design system brief
summary: palette light/dark, type scale, layout, header, footer, theme, motion catalogue, tone of copy
---
> Builder input, copied verbatim from the harness store of the first run (paths like `_ref/...` and `pictures/...` point into that store; the same text files are in this folder).

# DESIGN SYSTEM (from upw + upw-home; brand = PingHarbor, copy always original)
Sources: `REF.md`, `raw/styles.css` (tokens), `pictures/overview-1.png` (blog), `../upw-home/pictures/overview-1..3.png` (home).

## Palette (role: light | dark)
- page bg: #ffffff | #0b0d10
- alt section bg (stripes): #f7f8fa | #11141a
- chip / hover fill: #edf0f5 | #1a1e26
- card / menu surface: #ffffff | #14171e
- border: #e5e8ed | #1f242d ; strong border (ghost btn, chip): #cdd2db | #2a3038
- heading text: #0b1220 | #f5f7fa
- body text: #3b4453 | #b6bcc8
- muted text (dates, author, meta): #5d646f | #8a92a0
- accent (eyebrow text, highlight words, links, status): #059669 | #10b981
- accent text on light (small labels): #047857
- button fill: #047857 (light) | #10b981 (dark); button hover: #065f46 | #34d399
- button label: #ffffff | #052e1b
- accent soft (eyebrow pill fill): #d1fae5 | #064e3b
- danger / offline: #dc2626 | #f87171
- footer: always #0b0d10 with body #b6bcc8 (footer stays dark in both themes)
- Rule: accent is ONE green, used for ~5% of pixels: eyebrow, one highlighted word in each H2, buttons, dates-categories.

## Type
- Sans: DM Sans (400/500/600/700). Mono: ui-monospace, "JetBrains Mono", Consolas (code, JSON, hashes).
- Hero H1: 72px / 700 / leading 1.0-1.05 / tracking -0.025em (desktop); mobile ~40px.
- Section H2: 48px / 700 / leading 1.1 / tracking -0.025em (mobile ~32px). Blog hero "BLOG": 48px / 700.
- Card H3 / list title: 18-24px / 600 / leading 1.25; blog title 24px.
- Body lead: 18px / 400 / leading 1.6, max ~36em. Body: 16px / leading 1.6. Excerpt: 16px muted.
- Meta / labels: 14px (date, author); eyebrow pill: 12px / uppercase / tracking 0.1em.
- Scale tokens used: 0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.875, 2.25, 3, 3.75, 4.5rem.

## Layout
- Header container: max 80rem (1280px), padding 16px; content 1248px wide at 1440 viewport.
- Prose / blog column: ~684px centred (max 42rem + gutters); card grids inside 80rem.
- Grids: 3 cols (feature 8 cards = 4 + 4 pattern; steps = 3 cols), 5-col row for 5 small tiles; collapse to 1 col < 768px.
- Section rhythm: ~96px top and bottom on desktop, ~64px mobile (estimate from contact sheets; not measured in store).
- Gap between cards 16-24px; card padding 24px; list rows separated by 1px border + 32px gap.
- Radius: pill 999px (chips, status pills, eyebrow); buttons 8px (.5rem); cards 16px (1rem); small tiles / inputs 6px / 10px; icon tile 8px.
- Shadows: almost none at rest; card hover: 0 0 0 1px accent@18%, 0 18px 40px -22px accent@45%, 0 4px 16px -8px #0000 40%.
- Hero wraps: mock app window (shadow + 1px border + 12px radius) on the right, copy left.

## Header (sticky, 56px tall, bottom border)
- Left: logo mark (round, 40px) + wordmark "Ping" in heading colour + "Harbor" in accent, weight 700.
- Centre-right links 15px / 500, body colour: Features, Alerts, How it works, Free tools, Blog, AI assistants + "NEW" tag (accent, 11px).
- Right: theme toggle (36px square, 8px radius, border), language chip "EN" with flag + chevron (only if a locale switch is needed; else omit), Download button (accent, 40px tall).
- Background: page bg at ~85% alpha, backdrop-filter blur 8px. Mobile: hamburger, menu slides down (max-height .3s ease-out).

## Footer (dark both themes)
- 4 columns with 12px uppercase headings: Product, Free tools, More, Contact; 14px links, 10px gaps.
- Under columns: one "also from us" card (border #1f242d, radius 16px, icon tile, 1 title, 1 line, external-link button).
- Bottom bar: copyright left, green status dot "All systems normal" centre, "Built in ..." right; 12px muted.

## Theme behaviour
- Default: follow prefers-color-scheme; toggle sets class `dark-theme` on <html> (light = no class).
- Persist choice in localStorage key `theme` ("light" | "dark"); apply before first paint to avoid flash.
- Swap any hero screenshot: light and dark image variants (both shown via CSS, one hidden).
- Gradient text in light mode uses accent -> teal -> cyan; in dark mode the accent alone.
- Background glows: radial accent glow at 8-12% alpha behind hero and blog heading only.

## Motion catalogue
- Scroll reveal: [data-reveal] / [data-reveal-group] children start opacity 0; when IntersectionObserver adds `.is-in`: reveal-up = opacity 0->1, translateY 16px->0, .7s cubic-bezier(.22,.61,.36,1), backwards fill, stagger via --reveal-delay (step ~80-120ms). Only when html has `js-reveal` AND prefers-reduced-motion is no-preference.
- Live status dots: live-pulse 1.6s ease-out infinite; pulse 2.4s infinite on badges.
- Mock grid rows: row-flash-on / row-flash-off 1.1s when a cell changes; tick-in .3s for new log lines.
- Backdrop glow: aurora-drift-1 22s / drift-2 28s, ease-in-out infinite, slow translate.
- Scan line: scan 3.4s infinite across the mock window.
- Hover: buttons change fill + 4px accent@18% ring + 0 6px 16px -6px accent@70% shadow (.15s); cards translateY(-2px) + accent border (.15s); eyebrow arrow nudges 2px on hover (.15s).
- Mobile menu: max-height .3s ease-out, visibility delay.
- Reduce motion: no transforms, no loops; keep opacity fades only.

## Tone of copy (write new, same length and meaning)
- Short declaratives, second-person, plain verbs ("Know the moment your sites go down.").
- Two-part H2 with a contrast: "Everything you need. Nothing you don't." -> highlight the second half in accent.
- Numbers in copy (counts, sizes, percentages) make claims concrete; no hype adjectives.
- Eyebrow pill labels: 1-3 words, uppercase ("OUR PROJECTS", "FROM THE BLOG").
- Buttons: verb + object ("Read article", "Download for Windows"); arrow "→" for reading links.
- Brand: PingHarbor only; never reuse UpWatchr, FTPie, RSSly, TabChart or Snoq names/logos.
