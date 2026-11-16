---
audience: dev
title: Brief: Download
summary: builder 3
---
> Builder input, copied verbatim from the harness store of the first run (paths like `_ref/...` and `pictures/...` point into that store; the same text files are in this folder).

# Brief: part-3 (js/screens/part-3.js) - Screens.Download (#/download)
Project: `run_test/pingharbor/`. Brand: PingHarbor (new name). Edit only `js/screens/part-3.js` and `css/pages-part-3.css`. Layout detail: `run_test/_ref/upw-home/layouts/download.md`. Look: `run_test/_ref/upw-home/pictures/desktop-light-section-08.png`, `desktop-light-section-06.png`, `desktop-dark.png`, `mobile.png`.
No reference page exists for /download: build it from home sections #8 and #6 (listed below). Assets: none needed (the store badge svg is NOT used; draw the store button). Icons: `download`, `check`, `copy` (use `layers` if `copy` is missing), `arrow`.

## Section 1 - hero (layout section-1; picture section-08 top)
- Kit: `section.section > .container.narrow.center > .hero`. Glow: `.hero::before` radial accent 18%, blur 80px.
- Pill: `.pill` with `ui-icon name="check"` + "Available now".
- H1 (`.reveal`, `.grad` on the last phrase): "Grab PingHarbor. Then stop refreshing."
- Sub: "PingHarbor runs on Windows. Add your first URL and you have a working uptime monitor in under a minute, free and without an account."
- Buttons: `.btn .btn-primary .btn-lg` "Download for Windows" -> `@click="$toast('Installer download started')"`. Store button `.btn .btn-dark .btn-lg` (draw, do not use the badge image) "Get it from the Microsoft Store" -> `@click="$toast('Microsoft Store listing opens at launch')"`.
- Meta: `.chip` "v1.4.0" (mono, green dot) + muted "Released November 2, 2026 · 11.0 MB download".
- Requirements (`.muted`, centered): "Windows 10 and 11 · 64-bit · Free forever · No accounts, no telemetry".

## Section 2 - install and verify (layout section-2; picture section-08 middle)
- Plain `section.section` (no alt). `.grid-2` of two `.card` (equal height), each `.reveal`.
- Card A "Other ways to install": `h3` + `p` "The package manager fetches the same signed installer and checks its SHA-256 before it runs." + code block (`pre.code`, `PS> choco install pingharbor`, `button.btn.btn-ghost` "Copy" -> `$toast('Copied')`, clipboard write). No external link (no real URL in the brief; leave it out).
- Card B "Verify what you downloaded": `h3`; code block with a 64-char mock hash over two lines "9C4E7A21B8D05F36E1A2C7948B0D3F5A6E21C9B7D4F08A3E5B2C6D19F7A8E04" (uppercase, mono, wrap) + Copy -> toast; `p` "Run this in PowerShell and compare:"; code block `PS> Get-FileHash .\PingHarbor-Setup.exe -Algorithm SHA256` (3 lines) + Copy; `p` "Signed by Northquay Labs Ltd. (Gdańsk, Poland), issued by Microsoft ID Verified CS AOC CA 03. The signing name is the one the Microsoft Store and Chocolatey list as the publisher." (bold the publisher); `p` "Right-click the installer, open Properties, then the Digital Signatures tab. The timestamp keeps the signature valid after the certificate expires." (bold the path).

## Section 3 - what happens next (layout section-3; picture section-06, alt bg)
- `section.section.alt`; `.section-head` `.eyebrow` "What happens next", H2 "Three steps after the install." with `.grad` on "after the install."; p "Setup takes a minute. The monitoring keeps going for as long as you keep the app running."
- `.grid-3 > .card.feature.reveal d1..d3`, each: mono `01` / `02` / `03` (`.step-num`), h3, p:
  1. "Run the installer" - "Setup takes under a minute and places a tray icon next to the clock."
  2. "Add your first site" - "Paste a URL, name it, and pick how often to check it."
  3. "Let it watch" - "PingHarbor tells you the moment a site changes state, then goes quiet."

## Section 4 - closing band (layout section-4)
- `.cta-band.reveal`: H2 "Want to see it before you install?"; p "Compare the features or read how the app is built." Buttons: `.btn .btn-ghost` "See the features" -> `$go('/features')`; `.btn .btn-ghost` "Read the blog" -> `$go('/blog')`.

## Copy rules
- Every sentence above is original; keep the length. Do not reuse reference wording. Brand is PingHarbor everywhere (no "UpWatchr").
- Version, date, size and hash are mock sample values: keep them plausible and consistent.

## Link map (every target must exist in PROTO.md)
| element | target |
|---|---|
| Download for Windows | `$toast('Installer download started')` |
| Microsoft Store button | `$toast('Microsoft Store listing opens at launch')` |
| Copy (x3) | clipboard write + `$toast('Copied')` |
| See the features | `$go('/features')` (`#/features`) |
| Read the blog | `$go('/blog')` (`#/blog`) |
| Header / footer | built by the kit (already link to every route) |

## Motion and states
- `.reveal` on every heading, card and band; stagger d1..d4 on the hero children and the three steps.
- Copy: after click the label shows "Copied" for 1.5s.
- Dark theme: follow the kit tokens (no hard-coded white); glow stays accent at lower opacity.
- Mobile (<768px): hero H1 40px; both buttons full width; cards stack; command blocks scroll horizontally (`overflow-x:auto`).

## Done when
- No `href="#"`, no TODO text, no lorem. The stub comment in part-3.js is removed.
