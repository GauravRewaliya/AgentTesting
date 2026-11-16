# 02 Motion
> Status: draft · Updated: 2026-11-16 · Capture found NO motion on the login page (0 @keyframes, no scroll-reveal).

| where | animation | trigger | duration / easing | source |
|---|---|---|---|---|
| all buttons, nav items, rows | background/border colour fade | hover | 120ms ease-out | invented |
| modal / drawer | fade + 8px slide-up / slide-in from right | open/close | 160ms ease-out | invented |
| toast | slide-in from bottom-right, auto-hide 3s | `$toast` | 160ms | kit default |
| Home stats | count-up of the number | mount | 600ms ease-out, once | invented (home.md) |
| Home bars | height grows from 0 | mount / tab switch | 300ms ease-out | invented |
| theme switch | colours cross-fade | toggle | 150ms | invented |
| everything | `prefers-reduced-motion: reduce` turns all of the above off | - | - | rule |

Rule: no looping or decorative animation. If the user later supplies the real product's motion (logged-in capture), replace the "invented" rows and bump `decisions.md`.
