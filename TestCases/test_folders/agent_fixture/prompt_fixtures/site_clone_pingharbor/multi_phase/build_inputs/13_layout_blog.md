---
audience: dev
title: Layout: Blog list
summary: layout of the reference blog list
---
> Builder input, copied verbatim from the harness store of the first run (paths like `_ref/...` and `pictures/...` point into that store; the same text files are in this folder).

# Layout: Blog (#/blog), reference upw (pictures/ relative to this store)
Container ~700px centred for the list (text column ~684px). Section padding ~96px top. Light: white bg. Dark: #0b0d10 page, cards are rows (no boxes).

## section-1 Blog header + article list (pictures/desktop-light-section-01.png, 2654px)
- header block (centred): radial green glow behind (r~520px, faint, top of page, dark: deeper green).
  - pill with edit icon: "Articles & Updates" (r=999px, green tint border).
  - h1 "BLOG" 48px/700, tight tracking, centred.
  - 3 filter chips in a row, centred, gap 12px: "Research", "Guides", "Announcements" (r=8px, 1px border, 15px/600, padding 8px 16px). Click toggles a category filter; selected chip gets accent border.
- list: 6 rows, each vertically stacked, gap ~48px, hairline divider (gradient fade, centre-heavy) between rows.
  - meta line: date "Nov 04, 2026" (muted, 14px) · dot · category (green, 14px/500).
  - h2 22-24px/700, 2 lines, max width ~684px; optional small category icon at line end (green, 20px). One row is 3 lines long.
  - excerpt 16px muted, 2-3 lines.
  - bottom row: button "Read article →" (green #059669-ish fill, white 16px, r=6px, padding 12px 24px) left; "By <author>" muted 14px right.
  - each row is a link: whole title + button go to #/blog/<slug>.
- rows (order):
  1. Research · Nov 04, 2026 · shield icon · 3-line excerpt
  2. Research · Nov 04, 2026 · bot icon
  3. Research · Nov 04, 2026 · list-x icon · 2-line excerpt
  4. Research · Nov 04, 2026 · certificate icon · 3-line title
  5. Guides · Oct 09, 2026 · timer icon
  6. Announcements · Sep 28, 2026 · logo-mark icon · 1-line excerpt
- animation: header fades up; each row `.reveal` with stagger d1..d4 (repeat per 4 rows); glow slow drift.

## section-2 Download CTA card (pictures/desktop-light-section-02.png, 342px)
- centred card: max width ~560px, white, 1px border, r=8px, padding 32px.
- h3 24px/700 centred "Try the local-first one".
- sub 2 lines, 14px muted, centred.
- primary green button (small, 14px, r=6px) "Download PingHarbor free" -> `$go('/download')`.
- Card sits 60px under the list, the section bg white; under it page bottom.

## section-3 Footer (kit, pictures/desktop-light-section-03.png, 756px, dark #0b0d10)
- kit footer (PROTO.md): do not build it in the page.

## Filter behaviour
- chips filter the 6 rows client-side by category; 0 selected = all rows.
