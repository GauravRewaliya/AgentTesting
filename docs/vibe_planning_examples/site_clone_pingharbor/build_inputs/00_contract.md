---
audience: dev
title: Contract: pages, linking rules, page recipe
summary: the website contract every builder gets (routes -> files, linking rules, component classes)
---
> Builder input, copied verbatim from the harness store of the first run (paths like `_ref/...` and `pictures/...` point into that store; the same text files are in this folder).

# PingHarbor: website contract
A real multi-page WEBSITE (sections, themes, motion), no build, Vue 3 from a CDN. `index.html`, `css/site.css`, `js/site.js` are DONE: do not edit them. Brand tokens (accent, font, dark background) live in `css/theme.css`.

## Pages (one file each group; the owner edits ONLY its file and its `css/pages-<file>.css`)
| route | page | file |
|---|---|---|
| #/home | Screens.Home | js/screens/part-1.js |
| #/blog | Screens.Blog | js/screens/part-1.js |
| #/article | Screens.Article | js/screens/part-2.js |
| #/features | Screens.Features | js/screens/part-2.js |
| #/download | Screens.Download | js/screens/part-3.js |

The header and footer already link to EVERY page above (the kit builds them from this list), the theme follows the system (light / dark) with a toggle, and `.reveal` content animates in on scroll. Replace every stub (it says TODO).

## Linking rules (a dead link is a defect)
- Every link is `<a href="#/route">` (a route above, or `#/blog/<slug>` for an article of the Blog page) or a full https URL. NEVER `href="#"`. A button goes somewhere (`@click="$go('/features')"`) or does something (`$toast('Thanks')`).
- Detail pages live in the SAME page: `#/blog/my-post` shows `Screens.Blog` with `this.$route.parts = ['blog','my-post']`; branch in the template (`v-if="post"` article, `v-else` the list; an unknown slug shows "Article not found"). EVERY card / title / "Read more" of a list links to its own detail view, and the article links back and to related articles.
- Sections of one page: they are stacked in the page itself; a nav item never needs an in-page anchor.

## Page recipe (a finished, professional look)
Each page = 3-6 `<section class="section">` (alternate `.alt`), each with `.section-head` (`.eyebrow`, h2, p) and real content: `.hero`, `.grid-3 > .card.feature` (`.ico` + h3 + p), `.steps > .step`, `.stats > .stat`, `.logos > .logos-track` (marquee, duplicate the items once), `.grid-3 > .card.plan` (`.price`, `.checks`), `.card.quote`, `.faq > details > summary + p`, `.cta-band`, `.post-grid > a.card.post-card` (`.post-thumb-wrap > .post-thumb`, `.post-body` with `.post-meta`, `.post-title`, `.post-excerpt`), `.prose` for article text, `.form` + `.input`. Add `class="reveal"` (and `d1`..`d4` for stagger) to cards and headings so they animate on scroll. Use `.grad` on one headline word. Icons: `<ui-icon name="bolt">` (arrow bell bolt chart check clock code cloud download file globe heart lock mail moon play search shield star sun users zap layers target).
Buttons `.btn .btn-primary .btn-lg .btn-ghost`, `.pill`, `.chip`, `.tag`, `.muted`, `.center`, `.row`, `.stack`, `.container`, `.narrow`. Mock content is original, believable, specific (never lorem ipsum, never TODO); 4-8 posts with dates, authors, categories.

## Blog slugs (the ONLY six)
`security-headers-2026`, `ai-crawler-robots`, `saas-status-pages`, `tls-certificates-2026`, `windows-uptime-guide`, `welcome-to-the-blog`. Defined by the Blog page (part-1); every other page links only to these. The full table (title, date, author) is in `02_brief_home_blog.md` and `03_brief_features_article.md`. Never invent another slug.

## Quality bar (meet it in the FIRST pass: the audit checks exactly this, a failed audit costs a paid fix round of every builder)
- **Contrast 4.5:1 or better for ALL text**, light and dark. Small accent text (eyebrows, dates, chips, "OFFLINE", "last 24 checks") on a light surface uses `#047857`, never `#10b981`/`#059669`. Muted text on light: `#5d646f` or darker.
- **Phone tap targets at least 40x40 px** (every link, button, chip, footer link; use padding, not just font size).
- **No text under 12 px.**
- **Heading order without skips:** h1 > h2 > h3 (a card title under an h2 is h3, never h4; use a styled `div` when you only want the look).
- **Reveal must always finish:** an element hidden for the scroll reveal must become visible when it enters the screen on a phone too (no element left at opacity 0). Check the last section of your page.
- `<meta name="description">` is the kit's job per page; do not remove it.
- Before you report: `node --check` your js, run the kit's `proto_check`, and confirm every `href` / `$go` target exists.
