---
audience: dev
title: Layout: Home
summary: section by section layout of the reference home page
---
> Builder input, copied verbatim from the harness store of the first run (paths like `_ref/...` and `pictures/...` point into that store; the same text files are in this folder).

# Layout: Home (#/home), reference upw-home (pictures/ relative to this store)
Container ~1200px, sections padded ~96px top/bottom (desktop), 2-col hero/split = 1fr 1fr, gap ~64px. Light: white bg, alt sections #f7f8fa. Footer #0b0d10. Accent green #10b981.

## section-1 Hero (pictures/desktop-light-section-01.png, 834px)
- bg: white with faint dot grid, top-left to right.
- left col: pill "NEW · works with your AI assistant" (green dot tag "NEW" + chevron); h1 72px/700, 3 lines, tight leading; accent words on line 2-3 ("your" / "sites").
- sub: 4 lines, muted (rgb 59,68,83).
- buttons: primary green "Download for Windows" (icon + label, r=8px); black store badge "Download from the Microsoft Store" (drawn in css, not the svg); ghost link "See features ↓".
- trust row: 3 checks: "Windows 10 & 11", "11.0 MB", "No telemetry".
- version chip: dot + "v1.0.0 · Released Oct 19 2026 · 11 MB download" (mono, small).
- right col: app window mock (r=12px, shadow): top bar with 3 dots + title; search input + "Add site" button; table header "STATUS · LAST 24H"; 40-column heatmap, 9 rows of site names (green cells, 1 red and 2 orange cells); below 2 list rows: "UpWatchr · https://upwatchr.io · every 60s · 142ms · Online" with green dot.
- animation: window rises (reveal-up), heatmap cells fade in row by row (stagger 20ms), one red cell pulses (live-pulse).

## section-2 Features (#features, pictures/desktop-light-section-02.png, 1364px)
- head centred-left: pill "What it does"; h2 48px/700, 2 lines, accent on "Nothing you don't."; sub 2 lines muted, max 540px.
- grid, 2 columns top block: left = tall card (mock), right = 2 stacked cards.
- top-left card "Real-time status, no refresh" (tag "LIVE" top-right): icon, h3, 2-line text, 3 status rows (dot, name, url/HTTP line, pill ONLINE/ONLINE/OFFLINE red) on a #f7f8fa inset.
- right card A "Multi-channel alerts" (icon, h3, 2-line text). right card B "Local-first" (icon, h3, 1-line text).
- row 2: 3 equal cards: "Advanced HTTP", "Instant", "Uptime history" (icon, h3, 2-line text each).
- row 3: 2 equal cards: "Local status page", "Free, forever" (second card has green tint gradient bg + border accent).
- card r=16px, border 1px #e5e7eb, padding 24px, icon tile 36px r=8 green tint.
- animation: cards `.reveal` stagger d1..d4; hover lifts 4px + accent border.

## section-3 AI assistants (#ai-assistants, pictures/desktop-light-section-03.png, 760px)
- 2 cols, left text, right chat mock. bg white.
- left: pill "NEW · MCP server"; h2 48px 2 lines accent "in your AI assistant."; para 4 lines; checklist 4 items (green check icon); ghost button "How it works ›" (-> #/features).
- right: card (border, r=12px, bg #fafbfc): bubble right "YOU" "What went down while I was asleep?"; assistant bubble with 2-line answer; 2 tool chips in mono ("› watchlist_history" "› watchlist_uptime"); bubble right "Check the staging API now."; tool chip "› watchlist_check_site"; assistant short reply "It's back: 200 OK in 184 ms."
- animation: messages appear one by one on scroll (fade-up, d1..d4).

## section-4 Alerts (#notifications, pictures/desktop-light-section-04.png, 1023px, bg #f7f8fa)
- head centred-left: pill "Alerts"; h2 48px accent "but only how I want."; sub 2 lines.
- row of 5 equal cards: icon, h3 (Popup, Email, Webhook, Telegram, Local app), 3-line text. r=16px.
- below: 3 mock panels (equal, r=12px, mono text 11-12px): "Windows tray toast" (red left bar, title "Production API is offline", URL, "HTTP 503 · 142 ms"); "Telegram message" (red dot + bold line + link + small line); "Webhook JSON" (code block, 7 keys).
- centred footnote: "Every channel has a Send test button…" (1 line, small, muted; "Send test" bold).

## section-5 Browser view (pictures/desktop-light-section-05.png, 729px)
- 2 cols: left text, right browser mock. bg white.
- left: pill "Optional · localhost only"; h2 48px 2 lines accent "in a browser."; para 3 lines; checklist 4 items (one has mono code "127.0.0.1").
- right: browser window (r=12px, shadow): title bar with 3 dots + address "127.0.0.1:8080"; heading "PingHarbor — Status" + "● 6 sites · live refresh · 1s"; 5 rows: dot, name, method+url (mono), pill Offline (red) / Online (green), latency on right.
- animation: rows slide in (d1..d4), status dot pulses.

## section-6 How it works (#how-it-works, pictures/desktop-light-section-06.png, 598px, bg #f7f8fa)
- head: pill "How it works"; h2 48px accent "peace of mind."; sub 1 line.
- 3 equal cards: big number "01/02/03" 40px accent, h3, 2-line text. r=16px.

## section-7 Sister apps (#ecosystem, pictures/desktop-light-section-07.png, 622px, bg white)
- head: pill "Our projects"; h2 48px accent "our workshop."; sub 2 lines.
- row of 5 equal cards (r=16px): app icon 28px (drawn svg tile, distinct colour), name bold, 2-line desc, "Visit ›" green link.

## section-8 Download (#download, pictures/desktop-light-section-08.png, 1109px, bg white, radial green glow behind top)
- centred: pill with check "Available now"; h2 48px accent "Start watching."; sub 2 lines.
- buttons: primary "Download for Windows", store badge; meta line (mono, small): "v1.0.0 · Released Oct 19 2026 · 11 MB · Windows 10 & 11 · 64-bit · free forever · no accounts, no telemetry".
- 2 panels (equal, r=16px border, text left-aligned):
  - left "Other ways to install": 1 para; black code box "PS> winget install pingharbor" + Copy button; link "Package page ↗".
  - right "Verify what you downloaded": hash box (64 hex chars, mono, 2 lines) + Copy; PowerShell box "Get-FileHash .\PingHarbor-Setup.exe -Algorithm SHA256" + Copy; 3-line text on signing; "Right-click → Properties → Digital Signatures".
- Copy buttons: `$toast('Copied')`.

## section-9 Latest posts (pictures/desktop-light-section-09.png, 981px, bg white)
- head row: left pill "From the blog", h2 48px accent "measured.", sub 1 line; right: link "View all articles →" (-> #/blog).
- 2 equal cards (r=16px, border): thumb 16:9 dark (#0e1318) with logo chip, tag line, big 2-line title and a line icon (shield / robot-off), footer caption; body: category (green) · date, h3 2-line, excerpt 3 lines, "7 min read" muted.
- both cards link to #/blog/<slug> (see brief).

## section-10 Footer (kit footer, pictures/desktop-light-section-10.png, 756px, bg #0b0d10)
- kit builds header/footer from PROTO.md: do NOT build a footer in the page.
- Footer extras visible in picture (kit may already show them): 4 link columns (PRODUCT, FREE TOOLS, MORE, CONTACT); sister-app card (icon, "Also by the same developer", title, desc, "Visit ↗").
