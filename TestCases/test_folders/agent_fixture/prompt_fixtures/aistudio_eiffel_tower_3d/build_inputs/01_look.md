---
audience: dev
title: Eiffel Tower 3D - look and content
status: planned
---
# Look (build input: tokens, scene and light numbers, camera poses, timings, ids)
> Real values of the original app (taken from its style, scene, light and camera code). Sections 1 to 8; the stops and texts are in `02_stops_and_text.md` (sections 9 to 11).

## 1. Palette tokens (CSS custom properties on `:root`)
| token | value | use |
|---|---|---|
| `--bg-museum-canvas` | `#121212` | frame, boot veil, header |
| `--surface-plate-plinth` / `-elevated` / `-active` | `#1c1c1c` / `#292929` / `#363636` | dark plates |
| `--surface-dark-placard` | `rgba(20,20,20,.93)` | dark caption card |
| `--border-plate-subtle` / `-interactive` | `#383838` / `#737373` | borders |
| `--text-on-dark-primary` / `-secondary` / `-muted` | `#f5f5f5` / `#d4d4d4` / `#a3a3a3` | text on dark |
| `--accent-on-dark-vellum` / `-iron` | `#ffffff` / `#bdbdbd` | accents on dark |
| `--bg-vellum-paper` | `#f2f2f2` | light paper |
| `--surface-vellum-card` / `-inset` | `#ffffff` / `#e6e6e6` | light cards |
| `--surface-photo-placard` | `rgba(255,255,255,.94)` | photo placard |
| `--border-vellum-subtle` / `-interactive` | `#d4d4d4` / `#737373` | borders on light |
| `--text-on-light-primary` / `-secondary` / `-muted` | `#121212` / `#383838` / `#595959` | text on light |
| `--accent-on-light-iron` | `#141414` | accent on light |
| `--focus-ring-on-dark` / `-on-light` | `#ffffff` / `#121212` | focus ring |
| `--radius-gallery` | `2px` (sharp = `0`) | corners |
| `--shadow-placard-light` / `-dark` | `0 8px 24px rgba(0,0,0,.18)` / `0 10px 28px rgba(0,0,0,.44)` | placards |
| `--ease-museum` | `cubic-bezier(.22,1,.36,1)` | all UI easing |
No glassmorphism, no external fonts, no CDN.

## 2. Fonts (system stacks only)
- `--font-serif`: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, "Times New Roman", serif (headlines, captions, title).
- `--font-sans`: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif (buttons, labels).
- `--font-mono`: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace (debug drawer, facts line).
- Boot veil: eyebrow 11 px, letter-spacing .18em, uppercase, `#a3a3a3`; title `clamp(20px, 2.6vw, 28px)`, weight 400, letter-spacing .06em; rule 48 x 1 px `#737373`.

## 3. Breakpoints
`max-width: 960px`, `768px` (header 34 px high, top 10 px, right 12 px), `720px` (hide `#museum-brand-plaque`), `600px` (placard `bottom: 94px`, `max-height: min(56vh, calc(100dvh - 156px))`, scrolls), `min-width: 769px` (bar shifts when debug drawer is open). 390 px phone is guessed (no own rule; it falls under 600).

## 4. Scene and light numbers (real, daytime preset)
Renderer: antialias, ACES Filmic tone mapping, exposure 1.05 (initial 1.04), pixel ratio `min(devicePixelRatio, 2)` (1 on software WebGL), PCF shadows, `shadowMap.autoUpdate = false`.
| item | value |
|---|---|
| sky / fog colour | `#e6e2da` (zenith `#d2cec6`, mid `#e2dfd8`, nadir `#d4cfc5`); fog 380 to 2100 m |
| sun | `#fffaf0`, intensity 2.95, position (-238, 312, -304); shadow map 4096 (1024 software), near 85, far 690, bias -0.00022, normalBias 0.024 |
| hemisphere | sky `#efede8`, ground `#cfc7b8`, 0.96 |
| rim / fill | `#dfe3e8` 0.62 at (210,145,190) / `#ebe6dc` 0.36 at (-160,180,240) |
| point lights | arches 95, floor 1 = 45, floor 2 = 35, lantern point 220 + spot 180 (distance 80 / 62 / 52, decay 2) |
| env intensity | 0.76 |
Rule: every scene material has emissive `0x000000`, intensity 0, no emissive map, no additive blending; `auditZeroEmissive(scene)` must report 0 offenders.

## 5. Hero camera poses (stop 12; position / target / fov)
| id | EN label | position | target | fov |
|---|---|---|---|---|
| overview (finale) | Overview - Full 300 m Elevation | 240, 52, 440 | 0, 134, 0 | 42 |
| plinths_shoes | Detail I - Masonry Plinths and Cast Shoes | 76, 11, 78 | 38, 7.5, 38 | 36 |
| arch_frieze | Detail II - 74 m Arch and 72 Scientists Frieze | 52, 44, 118 | 0, 52, 0 | 36 |
| second_platform | Detail III - 116 m Second Stage and Le Figaro | 46, 122, 68 | 0, 118, 0 | 38 |
| campanile_phare | Detail IV - 300 m Lantern and Electric Lighthouse | 34, 286, 48 | 0, 289, 0 | 35 |
Portrait screens (aspect under 0.80) use fov 56 for the finale and 54 for the overview. Unit: metres.

## 6. Photo cameras (solved poses, `data/catalog/photo_cameras_3d.json`; build your own file with these numbers)
| photo | step | position (m) | fov |
|---|---|---|---|
| 55 plate | 11 | 0, 156, 3600 | 8.3 |
| 13 | 0.55 | -47.14, 3.95, -30.27 | 41.4 |
| 09 | 1.5 | -64.89, 3.35, 33.29 | 52.8 |
| 51 | 3.55 | -26.97, 49.66, 27.20 | 28.2 |
| 23 | 3.6 | 19.61, 4.44, 405.87 | 11.3 |
| 14 | 4.85 | 4.00, 9.94, 363.21 | 18.6 |
| 01 | 5.66 | -1.23, 6.96, 256.96 | 39.1 |
| 46 | 6.52 | 0.03, 4.46, 265.16 | 44.6 |
| 18 | 11 | -3.33, 0.8, 539.98 | 32.1 |
| 36 | 11 | 0.55, 2.8, -63.71 | 41.2 |
| 38 | 11 | -1.56, 2.8, -28.49 | 50.8 |
The original app also stores quaternions and a rising-front view offset per photo; not copied here (guessed: a look-at the tower with the same fov is close enough; flag it).

## 7. Timings (real unless marked)
Boot veil fade 0.45 s; beat A yield 1.1 s (hero 0.45 s); beat C dissolve 1.3 s; beat D hold 2.6 s (stop with a photo); finale hold 4.0 s (stop 12 and stops without a photo); reveal cross-fade 0.65 s; header rule `museumRuleSweep` 1.8 s ease-in-out infinite (translateX -100% to 100%); a free camera fly-to defaults to 1100 ms. Reduced motion (the original app rule): all animation and transition durations 0.01 ms, iterations 1.

## 8. Element ids and keys (real)
`#stage-viewport` (main, aria-label 'La Tour de 300 Mètres 1887-1889 Exhibition Stage') > `#world-canvas`, `#portal-overlay-root`, `#vignette-layer`; `#museum-ui-root` > `#museum-brand-plaque` (`#brand-plaque-title` 'La Tour de 300 Mètres', `#brand-plaque-sub` '1887-1889 Archival Exhibition'); `#boot-veil` (role status): eyebrow 'Paris · Champ-de-Mars · 1887-1889', title 'La Tour de 300 Mètres'. Buttons: `#btn-landing-explore` ('Explore' / 'Explorer'), `#btn-lang-toggle` ('EN · FR'), `#btn-walkthrough-prev`, `#btn-walkthrough-play`, `#btn-walkthrough-next`, `#btn-walkthrough-reveal`, `#btn-zen-enter`, `#btn-zen-exit`; bar `#exhibition-walkthrough-bar`. Keys: Enter / Space start or play, Arrow Right / Left next / previous stop, Home / End first / last (stop rail), V pure view, Ctrl+Shift+D debug drawer. URL params: `?stop=N`, `?photo=`, `?lang=`, `?intro=0`, `?autoplay=1` (guessed to keep only `stop`, `lang`, `intro`). `<title>` 'Eiffel Tower 3D Experience'.
