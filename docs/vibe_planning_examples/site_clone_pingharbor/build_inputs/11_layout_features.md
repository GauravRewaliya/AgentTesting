---
audience: dev
title: Layout: Features
summary: layout of the reference features area
---
> Builder input, copied verbatim from the harness store of the first run (paths like `_ref/...` and `pictures/...` point into that store; the same text files are in this folder).

# Layout: Features page (source: upw-home sections #2, #3, #4, #5, #6; no `.hero` picture: header is #2's head)
Theme: light bg #fff / alt #f7f8fa; dark bg ~#0e1318, cards ~#12171d, border #262c34, text #c9d1d9. Accent green. Content width ~1248px at 1440, gutters 96px. Card radius 16px, gap ~20px.

## section-1 Hero (no alt)
- picture: `pictures/desktop-light-section-02.png` (top 320px)
- left aligned, max-width 660px, padding-top 96px, bottom 64px
- chip (pill, green tint, 11px caps): "Features"
- h1 2 lines, 56px/700, tight tracking (-0.03em); one phrase in `.grad` (green)
- sub 18px/1.6, max 560px, muted
- buttons: primary-lg "Download PingHarbor", ghost "Read the blog"

## section-2 Feature grid (bento, bg #fff)
- pictures: `pictures/desktop-light-section-02.png` (cards area)
- head: chip + h2 40px/700 + p (2 lines); see hero
- grid 2 cols (equal) for row 1 and row 3; row 2 = 3 equal cols; gap 20px
- row 1: LEFT card spans 2 rows (height ~434px), RIGHT = 2 stacked cards (~210px each)
  - LEFT "Live status" card: icon tile 48px top-left, pill "LIVE" top-right (pulsing green dot), h3, p, then 3 mock rows (grey, 8px radius): dot + name bold + mono line "HTTP 200 · 142 ms" + pill ONLINE / ONLINE / OFFLINE (red tint)
  - RIGHT top: "Alerts on every channel"; RIGHT bottom: "Private by design"
- row 2: 3 cards "Flexible requests" | "Fast to start" | "Long-term history"
- row 3: 2 cards "Optional status page" | "Free, always" (tinted green gradient, border green)
- each card: icon tile 40px (green tint, 8px radius), h3 18px/600, p 15px/1.6 muted, 2-3 lines
- icon names: LEFT bolt/clock; alerts bell; privacy lock; requests globe; fast zap; history chart; status layers; free heart

## section-3 Alerts (bg #f7f8fa)
- pictures: `pictures/desktop-light-section-04.png`
- head centered-left: chip "Alerts", h2 2 lines, p 2 lines
- 5 cards in one row (equal), height ~110px: icon 32px, h3 15px/600, p 13px 3 lines: Popup | Email | Webhook | Telegram | Local app
- below: 3 mock panels, equal, height ~150px, 1px border, header strip (mono 11px label):
  1 "Tray popup": red left bar, bold "Production API is offline", URL line, mono "HTTP 503 · 142 ms"
  2 "Telegram message": red dot line + bold title, link line, mono "GET · HTTP 503 · 142 ms"
  3 "Webhook payload": code block, 8 lines JSON: siteName, url, method, previousStatus, newStatus, statusCode, responseTimeMs
- footer note centered 12px muted: "Every channel has a Send test button, so you can preview the alert."

## section-4 Assistant + browser (two rows, bg #fff)
- row A (2 cols, text left / mock right, vertically centered):
  - left: chip "New · MCP server", h2 2 lines, p 4 lines, 4 check bullets (green check icon, 14px), ghost button "Setup guide"
  - right: chat panel 420px, bg #f7f8fa, radius 16px, 4 bubbles: user (right, pill), assistant (left, card), tool chip (mono 11px, pill), assistant
- row B (text right / mock left, mirrored): `pictures/desktop-light-section-05.png`
  - left: browser window mock (dot bar, address "127.0.0.1:8080", title "PingHarbor · Status"), 5 rows: name + mono URL + pill Online/Offline/Timeout
  - right: chip "Optional · local only", h2 2 lines, p 3 lines, 4 check bullets

## section-5 Steps (bg #f7f8fa)
- pictures: `pictures/desktop-light-section-06.png`
- head: chip "How it works", h2 1 line, p 1 line
- 3 cards in a row (`.steps > .step`): big number 40px green "01/02/03", h3, p 2 lines; cards equal height ~150px, radius 16px

## section-6 CTA band (bg #fff)
- pictures: `pictures/desktop-light-section-08.png` (top 300px, scaled down)
- centered block, max 640px: pill "Free download", h2 40px, p 2 lines, buttons: primary-lg "Download PingHarbor" + ghost "Read the blog"
- bottom: small line "Windows 10 and 11 · no account · no telemetry" (mono 12px muted)

## Motion (all sections)
- `.reveal` on chips, h2, card rows, mock panels; stagger d1..d4 by 80ms; reveal-up keyframe (translateY 24px to 0, opacity 0 to 1, ~600ms ease-out)
- hover: cards lift 2px + border tint (transition 200ms); mock rows static
- live dot pulse (keyframe pulse, 2s loop); mock status rows flash once on enter
