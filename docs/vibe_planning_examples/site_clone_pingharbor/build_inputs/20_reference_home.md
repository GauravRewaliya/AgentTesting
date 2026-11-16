---
audience: dev
title: Reference capture: home
summary: what the harness measured on the reference home page (tokens, sections, motion)
---
> Builder input, copied verbatim from the harness store of the first run (paths like `_ref/...` and `pictures/...` point into that store; the same text files are in this folder).

# Reference: https://upwatchr.io (captured by the harness, not a model summary)
Use it as the LOOK to match: layout, spacing, type scale, colours, motion, theme behaviour. The brand name is renamed and every text is written fresh (original copy). LOOK at the pictures with Read (folder pictures/): FIRST overview-1.png ... (contact sheets: 4 sections each, numbered #N like the list below; 3 of them: 3 Reads instead of 12), then a single desktop-light-section-NN.png only where you need detail; desktop-light-full.png (whole page) (ONE PICTURE PER SECTION, the list below says which is which), desktop-dark.png and mobile.png (FIRST SCREEN only: fast, the colours and the phone header; the light contact sheets carry the layout). The store is organised: STORE.md (index), MAP.md (mind map), assets/ (real images by role), layouts/ and briefs/ (lookup agent).

- title: UpWatchr - Local-first uptime monitoring for Windows &#xB7; Free | description: Free, native Windows app that watches your websites and services. Multi-channel alerts (email, webhook, Telegram, popup). No accounts, no cloud, no telemetry.
- theme: prefers-color-scheme: dark; has a theme toggle button
- fonts: DM Sans (4); ui-monospace (3)
- top colours: #fff (13), #10b981 (5), #22d3ee (5), #c9d1d9 (4), #0e7490 (4), #059669 (3), #047857 (3), #0e1318 (3), #262c34 (3), #f87171 (2), #065f46 (2), #000 (2)
- radius: 999px (11), .5rem (7), .375rem (5), .625rem (3)
- css variables (first 24): --tw-translate-x:0; --tw-translate-y:0; --tw-translate-z:0; --tw-rotate-x:initial; --tw-rotate-y:initial; --tw-rotate-z:initial; --tw-skew-x:initial; --tw-skew-y:initial; --tw-space-y-reverse:0; --tw-border-style:solid; --tw-gradient-position:initial; --tw-gradient-from:#0000; --tw-gradient-via:#0000; --tw-gradient-to:#0000; --tw-gradient-stops:initial; --tw-gradient-via-stops:initial; --tw-gradient-from-position:0%; --tw-gradient-via-position:50%; --tw-gradient-to-position:100%; --tw-leading:initial; --tw-font-weight:initial; --tw-tracking:initial; --tw-shadow:0 0 #0000; --tw-shadow-color:initial
- motion: hover/transition effects, @keyframes (9), scroll reveal, backdrop blur, gradients | keyframes: pulse, row-flash-on, row-flash-off, tick-in, aurora-drift-1, aurora-drift-2, scan, live-pulse, reveal-up
- computed: body font DM Sans, text rgb(59, 68, 83), page bg rgb(255, 255, 255), button/accent bg rgb(16, 185, 129), 10 sections, page height 8833px, scroll-reveal: yes
## Sections, top to bottom (what a person sees scrolling down: build ALL of them, same order and components)
- #1 <section> y=57 h=834 | "Know the moment your sites go down." (72px/700) | bg rgb(255, 255, 255) | no card grid | buttons: Download for Windows | 9 icons/images |  | animated  -> pictures/desktop-light-section-01.png
- #2 <section #features> y=891 h=1364 | "Everything you need. Nothing you don't." (48px/700) | bg rgb(255, 255, 255) | 8 cards | 8 icons/images |  | animated | radius 16px  -> pictures/desktop-light-section-02.png
- #3 <section #ai-assistants> y=2255 h=760 | "Your watchlist, in your AI assistant." (48px/700) | bg rgb(255, 255, 255) | no card grid | buttons: How it works | 5 icons/images |  | animated  -> pictures/desktop-light-section-03.png
- #4 <section #notifications> y=3015 h=1023 | "Notify me - but only how I want." (48px/700) | bg rgb(247, 248, 250) | 5 cards | 5 icons/images |  | animated | radius 16px  -> pictures/desktop-light-section-04.png
- #5 <section> y=4039 h=729 | "Your watchlist, in a browser." (48px/700) | bg rgb(255, 255, 255) | no card grid | 6 icons/images |  | animated  -> pictures/desktop-light-section-05.png
- #6 <section #how-it-works> y=4767 h=598 | "Three steps to peace of mind." (48px/700) | bg rgb(247, 248, 250) | 3 cards | 0 icons/images |  | animated | radius 16px  -> pictures/desktop-light-section-06.png
- #7 <section #ecosystem> y=5365 h=622 | "More from our workshop." (48px/700) | bg rgb(255, 255, 255) | 5 cards | 10 icons/images |  | animated | radius 16px  -> pictures/desktop-light-section-07.png
- #8 <section #download> y=5987 h=1109 | "Stop checking. Start watching." (48px/700) | bg rgb(255, 255, 255) | no card grid | buttons: Download for Windows / Copy / Copy | 10 icons/images |  | animated  -> pictures/desktop-light-section-08.png
- #9 <section #latest-posts> y=7097 h=981 | "What we measured." (48px/700) | bg rgb(255, 255, 255) | no card grid | 3 icons/images |  | animated  -> pictures/desktop-light-section-09.png
- #10 <footer> y=8078 h=756 | "FTPie - one place for all your cloud storage" (18px/600) | bg rgb(11, 13, 16) | 4 cards | 2 icons/images |  | animated  -> pictures/desktop-light-section-10.png
## Header links
- Up Watchr -> /
- Features -> /#features
- Alerts -> /#notifications
- How it works -> /#how-it-works
- Free tools -> /tools
- Blog -> /blog
- AI assistants New -> /mcp
- English -> /
- Deutsch -> /de/
- Fran&#xE7;ais -> /fr/
- Italiano -> /it/
- Espa&#xF1;ol -> /es/
- Download -> /releases/UpWatchr-Setup.exe
- English -> /
## Footer links
Features | Alerts | How it works | Download | Windows Server Monitor | AI assistants (MCP) | Blog | Comparisons | vs UptimeRobot | vs Uptime Kuma | vs Pingdom | vs StatusCake | HTTP status checker | SMTP test | Telegram chat ID finder | SLA & uptime calculator | All tools | FTPie | RSSly | TabChart | Snoq | Contact & support | FAQ | Privacy Policy
## Headings, top to bottom
- h1: Know the moment your sites go down.
- h2: Everything you need. Nothing you don't.
- h3: Real-time status, no refresh
- h3: Multi-channel alerts
- h3: Local-first
- h3: Advanced HTTP
- h3: Instant
- h3: Uptime history
- h3: Local status page
- h3: Free, forever
- h2: Your watchlist, in your AI assistant.
- h2: Notify me - but only how I want.
- h3: Popup
- h3: Email
- h3: Webhook
- h3: Telegram
- h3: Local app
- h2: Your watchlist, in a browser.
- h2: Three steps to peace of mind.
- h3: Add a site
- h3: Pick channels
- h3: Forget about it
- h2: More from our workshop.
- h2: Stop checking. Start watching.
- h3: Other ways to install
- h3: Verify what you downloaded
- h2: What we measured.
- h3: Security headers in 2026: we checked the 10,000 most popular websites
- h3: Who blocks AI crawlers? We read the robots.txt of the 10,000 most popu
- h3: FTPie - one place for all your cloud storage
