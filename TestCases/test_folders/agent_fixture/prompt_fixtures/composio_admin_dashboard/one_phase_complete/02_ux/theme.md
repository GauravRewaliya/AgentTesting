# AgentDeck design system (whole site)
Source: reference LOOK (login page only: #fcfcfc light, #000 buttons, #191919 dark card, #b1a9ff and #5753c6 accents, IBM Plex Mono) + typical agent-platform dashboard structure. Not captured: the dashboard screens (see layouts/*.md, "built from structure").

## Where it lives
- Override the kit tokens in `css/pages-part-N.css` (loads after kit.css): `:root` variables and the shell rules (sidebar light, not the kit's dark #0f172a). Builder of build screens does NOT repeat shell rules; it only adds its own classes in `css/pages-part-N.css`.
- Dark theme: `html[data-theme="dark"]` sets the same variables to the dark set below. Toggle lives in Settings > Appearance (kit has no global toggle, see REPORT).

## Palette (role: light / dark)
- page bg: #fcfcfc / #000000
- surface (cards, tables): #ffffff / #191919
- surface-2 (table head, hover, footer): #f6f6f6 / #212121
- border: #e8e8e8 / #2e2e2e; border-strong (inputs): #d6d6d6 / #414141
- text: #000000 / #fcfcfc; text-2: #2e2e2e / #d6d6d6; muted: #6b6b6b / #9a9a9a
- primary (buttons): #000000 text #ffffff / bg #ffffff text #000000; hover #2e2e2e / #e8e8e8; active #414141 / #d6d6d6
- accent (links, focus, active nav): #5753c6 / #b1a9ff
- accent-weak (active nav bg, chips, step.active): #f1f0ff / #2a2640
- success #1f9d55 (text #137a40, weak #e9f8ef); warning #c77700 (weak #fff6e5); danger #d92d20 (weak #fdecea); info = accent family
- Map kit names: --primary = button colour (black), --primary-text = accent #5753c6, --primary-weak = accent-weak.

## Type
- UI: Inter (stand-in for the reference's licensed sans; do not copy a proprietary font file), fallback system-ui. Mono: IBM Plex Mono (code, keys, ids, numbers in logs). Load both with one `@import` in `css/pages-part-N.css` if a CDN is allowed; else use fallbacks.
- Scale: h1 24px/32px 600; h2 18px 600; h3 14px 600; body 14px/22px; small 12px/16px; stat value 28px 600 tabular-nums.
- Headings are sentence case; labels 13px 500; table headers 12px 500 muted, no uppercase tracking (override kit's uppercase).

## Spacing, shape, depth
- 4px rhythm: 4 8 12 16 24 32 48 (kit s1..s7). Container: content max 1280px, padding 24px (16px phone).
- Shell: sidebar 232px, topbar 56px, sidebar bg #fcfcfc with 1px right border; nav item 32px high, radius 6px, active = accent-weak bg + accent text.
- Radius: controls 6px, cards 8px, badges 999px, code blocks 6px.
- Shadow: none on cards (border only); modals 0 16px 40px rgba(0,0,0,.18).
- Controls: button height 32px (btn-sm 28px); inputs 36px; focus ring 2px accent.

## Header and footer
- Topbar: breadcrumb left (kit), search box centre-right with ⌘K hint (text only), right: docs link, notification bell (ui-icon bell), avatar with initials "AM" (muted circle). Theme toggle icon sits here only if the kit allows; otherwise in Settings.
- No marketing footer in the dashboard; the Docs screen has its own in-page contents column.

## Theme behaviour
- Follows system on first visit (prefers-color-scheme), then the Settings choice in localStorage key `agentdeck-theme`. Switch is instant: no transition on colours (avoid flashes), 150ms only on hover.

## Motion catalog (keep it small)
- Stats count up once on mount (600ms ease-out). Bars grow from 0 (400ms, 40ms stagger). Table rows fade in 120ms on filter change. Modal/drawer: fade 150ms + translate 8px. Toast: slide up 200ms. Respect prefers-reduced-motion: disable all.
- No scroll-reveal (dashboard).

## Tone of the copy (write fresh; never the reference text)
- Short, plain, imperative buttons: "Create", "Connect", "Copy key", "Revoke". Explain errors in one sentence with the next step. Numbers in tables right-aligned, mono for ids and keys. Examples of mock data: workspace "Acme Inc.", user "Alex Morgan", tool names in SCREAMING_SNAKE (GITHUB_CREATE_ISSUE, SLACK_SEND_MESSAGE, GMAIL_SEND_EMAIL).

## Brand
- Name AgentDeck. Mark: 24px black rounded square with a white two-cell glyph drawn in CSS/SVG (no third-party logo, no reference asset). Favicon: none supplied.
