---
audience: dev
title: Layout: Download
summary: layout of the reference download area
---
> Builder input, copied verbatim from the harness store of the first run (paths like `_ref/...` and `pictures/...` point into that store; the same text files are in this folder).

# Layout: Download page (#/download)
Source: no standalone download page in the reference; the page is built from home section #8 `Stop checking. Start watching.` (`pictures/desktop-light-section-08.png`) plus home #6 (`pictures/desktop-light-section-06.png`) and the closing band pattern. Page bg light (#fff), alt section #f7f8fa. Dark: page bg #0e1318 family, cards #161b22, borders #262c34.

## section-1 Hero download (picture: desktop-light-section-08.png, top 0-520px)
- Centered column, max width ~720px, padding-top ~120px, bottom ~80px. Radial green glow behind the hero (accent #10b981 at ~18% opacity, blur 80px, ~600px wide).
- Pill eyebrow with check icon, mono-caps 11px, accent border, `AVAILABLE NOW`-style label (centered, 16px gap below).
- H1 ~56px/700, tracking -0.03em, two lines max, last phrase in accent gradient (`.grad`).
- Sub line 18px, text colour rgb(59,68,83), max width ~470px, 2 lines, centered.
- Button row (gap 12px): primary green button `Download for Windows` (height 48px, radius 8px, icon download left, bg #10b981, hover darker #059669) + dark store-style button (height 48px, radius 8px, bg #0b0d10, white text, 2 lines: small "Get it from the" / large "Microsoft Store"; draw it, do NOT use the store badge svg).
- Meta chip row: mono version chip (`v1.4.0`, green dot, radius 6px, 12px mono) + text "Released November 2, 2026 · 11.0 MB download" (14px muted).
- Requirements line (13px muted, centered): "Windows 10 & 11 · 64-bit · Free forever · No accounts, no telemetry".

## section-2 Install + verify (picture: desktop-light-section-08.png, 520-980px)
- 2 cards side by side, gap 20px, each ~420px wide, radius 16px, border 1px #e5e7eb, padding 24px, equal height (min 300px). Stacks to 1 column under 768px.
- Card A `Other ways to install`: title 16px/600, body 14px muted (2 lines), code block (bg #0b0d10, radius 8px, mono 13px, prompt `PS>` in cyan #22d3ee, Copy button right inside block, ghost 28px high), then one text link with external-arrow icon. Card body leaves empty space at bottom (cards equal height).
- Card B `Verify what you downloaded`: code block with 2-line 64-char hash (mono 12px, wraps) + Copy; label line 14px muted "Run this in PowerShell and compare:"; code block `PS> Get-FileHash` 3 lines + Copy; paragraph 14px muted with a bold publisher name; paragraph with bold menu path.
- Card B is the taller card (the left stays shorter with empty space).

## section-3 Steps (picture: desktop-light-section-06.png, alt bg)
- Eyebrow pill `WHAT HAPPENS NEXT` (accent-tinted, 11px caps), H2 40px/700 with last phrase in accent gradient, sub line 16px muted.
- 3 cards in a row (gap 24px, radius 16px, padding 24px, white on alt bg), each: mono number `01`/`02`/`03` 40px in accent at 60% opacity with soft glow, h3 18px/600, body 14px muted, 2 lines.

## section-4 Closing band (no picture; same language as home #9 header)
- Centered block, padding 80px 0, H2 36px/700 one line, sub line 16px muted, 2 buttons: ghost `See the features` and ghost `Read the blog`.

## Motion
- Hero children fade up in sequence (reveal, d1..d4, 16px translate, 600ms ease-out).
- Cards reveal on scroll with 80ms stagger; Copy buttons: hover bg lightens, click shows check icon for 1.5s.
- Primary button hover: lift 1px + shadow `0 8px 24px rgba(16,185,129,.25)`.

## Mobile (picture: mobile.png)
- Hero H1 40px, buttons stack full width (48px each), cards stack, code blocks scroll horizontally inside the block (no wrap for the command).
