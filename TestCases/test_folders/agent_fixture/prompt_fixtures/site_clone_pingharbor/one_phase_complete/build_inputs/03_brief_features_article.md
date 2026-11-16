---
audience: dev
title: Brief: Features and Article
summary: builder 2
---
> Builder input, copied verbatim from the harness store of the first run (paths like `_ref/...` and `pictures/...` point into that store; the same text files are in this folder).

# Brief: part-2 (`js/screens/part-2.js`, `css/pages-part-2.css`)
Brand: PingHarbor (new name). Design: match the look of `upw-home` and `upw` (light + dark via theme tokens in `css/theme.css`; never hard-code page colours). Copy: original, written fresh, never the reference's sentences. Layouts: `../_ref/upw-home/layouts/features.md`, `../_ref/upw/layouts/article.md` (no picture: reference-free).

## Route #/features : Screens.Features (`this.$route`, no parts)
Source: `upw-home` pictures + `layouts/features.md`. No raster assets: draw every mock in HTML/CSS (no images). Kit: `.hero`, `.grid-3 > .card.feature`, `.steps > .step`, `.cta-band`, `.reveal d1..d4`, `.chip`, `.pill`, `.btn`.

### Section 1 Hero (`layouts/features.md#section-1`, picture `upw-home/pictures/desktop-light-section-02.png`)
- chip: "Features"
- h1: "The monitoring you want. Without the clutter." (`.grad` on "Without the clutter.")
- sub: "PingHarbor checks your sites from your own machine and tells you the moment something changes. No setup project, no tiers."
- buttons: `.btn .btn-primary .btn-lg` "Download PingHarbor" -> `@click="$go('/download')"`; `.btn .btn-ghost` "Read the blog" -> `#/blog`

### Section 2 Feature bento (`layouts/features.md#section-2`)
- head: chip "What it does"; h2 "Everything you need, and a little less."; p "No dashboards to learn. Nothing to upgrade. Monitoring that runs on your machine."
- 8 cards (`.grid-3 > .card.feature`, bento per layout; LEFT card spans 2 rows):
  1. "Live status, no refresh" | "Each site is checked on its own schedule. Changes appear without reloading the page." | mock: 3 rows: "Checkout API" HTTP 200 · 142 ms ONLINE; "Docs site" HTTP 200 · 98 ms ONLINE; "Staging" HTTP 503 · - OFFLINE
  2. "Alerts on every channel" | "Popup, email, webhook or Telegram. Switch each one on separately."
  3. "Private by design" | "Your data stays on your machine. No account, no cloud sync, no tracking."
  4. "Flexible requests" | "Any method, custom headers and body, basic auth, expected status codes and per-site timeouts."
  5. "Fast to start" | "A small native Windows app. Quick to install, quick to open, light on memory."
  6. "Long-term history" | "Every status change is saved, so charts can show uptime per site and overall."
  7. "Optional status page" | "A local page with live refresh. Add a password if you want one."
  8. "Free, always" | "No paid tier, no trial clock, no upsell." (`.card.plan`-style tint)
- icons: bolt, bell, lock, globe, zap, chart, layers, heart (`<ui-icon name="…">`)

### Section 3 Alerts (`layouts/features.md#section-3`, picture `desktop-light-section-04.png`, `.section.alt`)
- chip "Alerts"; h2 "Alerts that fit how you work."; p "Every channel is independent. Pick the ones you want and leave the rest off."
- 5 small cards (equal): "Popup" (bell) "Native desktop toast with the site name, URL and latency." | "Email" (mail) "Any SMTP server. Subject and body include the status and the last response." | "Webhook" (code) "POST a JSON payload with the site, method, status code and timing." | "Telegram" (send) "Paste a bot token, send a message to your chat. The chat ID is detected for you." | "Local app" (play) "Run a script or program with the status as arguments."
- 3 mock panels: "Tray popup" (red bar: "Production API is offline", `https://api.example.com/health`, `HTTP 503 · 142 ms`); "Telegram message" ("🔴 Production API is offline" + link + `GET · HTTP 503 · 142 ms`); "Webhook payload" (JSON: siteName "Production API", url, method "GET", previousStatus "Online", newStatus "Offline", statusCode 503, responseTimeMs 142)
- note: "Every channel has a Send test button, so you can preview the exact alert."

### Section 4 Assistant and browser (`layouts/features.md#section-4`, picture `desktop-light-section-03.png` + `desktop-light-section-05.png`)
- row A: chip "New · MCP server"; h2 "Your watchlist, inside your AI assistant."; p "Ask your assistant which sites are down, what changed overnight and how long it lasted. It answers from the history PingHarbor keeps."
  - bullets: "Works with Claude, Cursor and VS Code." | "Read-only: it can check sites, not remove them." | "API keys and tokens are never shared with the assistant." | "One-click setup for the common clients."
  - ghost button "Setup guide" -> `$go('/download')`
  - chat mock: user "What went down while I was asleep?"; assistant "Two things. staging-api was offline from 03:12 to 03:40, 28 minutes with 502 errors. Everything else stayed up."; user "Check staging-api now."; tool chip `pingharbor_check_site`; assistant "It's back: 200 OK in 184 ms."
- row B (mirrored): chip "Optional · local only"; h2 "Your watchlist, in a browser tab."; p "Turn it on in settings and PingHarbor serves a small status page on localhost. Open it from any browser on your machine."
  - bullets: "Bound to 127.0.0.1, never exposed to your network." | "Live refresh every few seconds, no reload." | "Optional password gate, set in settings." | "Read-only: the web view cannot add or remove sites."
  - browser mock: title "PingHarbor · Status", address "127.0.0.1:8080"; rows: "Office NAS" (Timeout, red), "Checkout API" (Online), "Docs site" (Online), "Staging" (Offline, red), "Search cluster" (Online)

### Section 5 Steps (`layouts/features.md#section-5`, picture `desktop-light-section-06.png`, `.section.alt`)
- chip "How it works"; h2 "Three steps and you're covered."; p "Set-up takes a minute. The rest runs in the background."
- `.steps`: "01 Add a site" "Paste a URL, name it and choose how often to check. Sixty seconds is the default." | "02 Pick channels" "Popup is on by default. Add email, webhook or Telegram in a few clicks." | "03 Forget about it" "PingHarbor lives in the tray. When a site changes state, you will know."

### Section 6 CTA (`layouts/features.md#section-6`, picture `desktop-light-section-08.png`)
- `.cta-band`: chip "Free download"; h2 "Start with one URL."; p "No account, no trial, no telemetry. Add a site and it is watched within a minute."
- buttons: primary "Download PingHarbor" -> `$go('/download')`; ghost "Read the blog" -> `#/blog`
- mono line: "Windows 10 and 11 · no account · no telemetry"

## Route #/article : Screens.Article (`this.$route.parts` not used; standalone sample)
Source: `layouts/article.md` (no reference picture: NOT captured, not briefed from the site). Use the PROTO recipe.
- section 1 header: "← All articles" -> `#/blog`; chip "Guides"; h1 "Checking uptime from your own machine: the trade-offs"; meta: author "Mara Lind", "Nov 04, 2026", "6 min read"
- section 2 body: `.prose` ~680px: lead paragraph, 4 h2 sections, numbered list, callout, mono code block, pull quote. Original text, about 700 words.
- section 3: author card + "Keep reading" `.post-grid`, 3 cards: links to `#/blog/security-headers-2026`, `#/blog/windows-uptime-guide`, `#/blog/saas-status-pages` (pick only from the six slugs below)
- section 4: `.cta-band` -> `$go('/download')`

## Shared blog slugs (the ONLY six; part-1 `Screens.Blog` provides these detail views at `#/blog/<slug>`; no other slug may be linked)
| slug | title (original) | date | category | author |
|---|---|---|---|---|
| security-headers-2026 | Where security headers stand in 2026, after scanning 10,000 top sites | Nov 04, 2026 | Research | Elena Marsh |
| ai-crawler-robots | Which sites turn away AI crawlers? A robots.txt survey | Nov 04, 2026 | Research | Elena Marsh |
| saas-status-pages | A year of SaaS status pages: what 47 services admitted | Nov 04, 2026 | Research | Jonas Keller |
| tls-certificates-2026 | TLS certificates in 2026: are sites ready for shorter lifetimes? | Nov 04, 2026 | Research | Jonas Keller |
| windows-uptime-guide | How to read real uptime on Windows, and why the number misleads | Oct 09, 2026 | Guides | Elena Marsh |
| welcome-to-the-blog | Welcome to the PingHarbor blog | Sep 28, 2026 | Announcements | Jonas Keller |

## Global rules for this file
- every `href` is `#/…` from PROTO.md or `#/blog/<slug>` above; no `#` only, no in-page anchors
- `.reveal` on every heading, card and mock panel; stagger d1..d4
- theme: all colours via tokens; check both light and dark (dark: panel bg one step lighter than page, border from tokens)
- prefers reduced motion: disable reveal and pulse
