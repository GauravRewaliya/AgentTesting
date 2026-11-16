---
audience: dev
title: Layout: Article (not captured)
summary: reference-free spec for the article page
---
> Builder input, copied verbatim from the harness store of the first run (paths like `_ref/...` and `pictures/...` point into that store; the same text files are in this folder).

# Layout: Article page (NO REFERENCE PICTURE)
Not captured: the upw store has only the blog list (`upw` #1-#3) and no article detail page. Nothing below is measured from the site. It is the reference-free spec for `#/article` (a standalone sample article), built on the blog's tokens (DM Sans, accent green, card radius 16px, chip/pill style from `upw` #1). Builders: use the PROTO recipe (`.prose`, `.post-grid`, `.cta-band`) and no picture.

## section-1 Article header (bg #fff)
- back link ghost, 14px, "← All articles" -> `#/blog`
- chip (category) "Guides"
- h1 2-3 lines, 48px/700, tight tracking, max 760px
- meta row 14px muted: avatar circle 32px with initials, author name, "Nov 04, 2026", "6 min read"
- hero image frame: 16:9, radius 16px, mock: 24-cell status strip (green / one red / one amber cell) on a dark tile

## section-2 Article body (bg #fff)
- `.narrow` column ~680px, centered, 18px/1.75 body
- lead paragraph 22px/1.5 muted
- 4 h2 (28px/700, margin-top 48px), 1 ordered list (3 items), 1 callout (green tint box, 16px radius, bold lead-in), 1 mono code block (13px, 4 lines), 1 pull quote (border-left 3px accent)
- bottom row: tag chips (3) + share text row (no live buttons: `$toast('Link copied')`)

## section-3 Author + next (bg #f7f8fa)
- author card: avatar 56px, name, one-line bio, link `#/blog` ("All articles")
- h2 "Keep reading" 32px, `.post-grid` 3 cards: `a.card.post-card` with `.post-thumb`, `.post-meta`, `.post-title`, `.post-excerpt`; links `#/blog/<slug>`

## section-4 CTA band (bg #fff)
- `.cta-band` centered: h2 2 lines, p 1 line, primary "Download PingHarbor" -> `#/download`

## Motion
- `.reveal` on h1, meta, body paragraphs, cards (stagger d1..d4); reveal-up 600ms
- reading progress bar: 2px accent line top of viewport, width = scroll %
