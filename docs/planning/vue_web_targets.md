# Prototype target for now: Vue 3 on the web
Decision (user, 2026-11-16): prototype everything we can as a **Vue web page** (the no-build kit from `proto_init`: Vue 3 CDN). Something Android/iOS-only that has no web version is NOT built: it is written in the plan, reviewed on paper, tagged `native-only`. Expo Go stays possible later for the same plan; for now the clickable thing is a web page.

Rule of thumb: if a browser can show the behaviour (pointer drag, CSS animation, canvas, Web Audio, backdrop-filter), prototype it; if it needs a device API (haptics, native blur, native GPU device, Android-only view), tag `native-only`.

| example | Vue web version | `web-approx` stand-ins | `native-only` (not built) |
|---|---|---|---|
| linear_tab_bar | `TabBar.vue`, `TabBarPill.vue`, `SearchBar.vue`, `MenuPanel.vue`; pointer events for drag; CSS springs (`linear()` easing or a tiny JS spring) | glass = `backdrop-filter: blur()` + masked gradient border instead of expo-blur | haptics, worklet threads (`scheduleOnRN`), device keyboard animation |
| enzo_clerk_toast | `ToastProvider.vue` (provide/inject), `StackedToast.vue`, `useToast.ts` composable; spring via Web Animations | backdrop gradient with CSS mask | `index.android.tsx` backdrop variant, haptics, status-bar handling |
| wavelet_spotify_clone | already web (React): same module split as Vue SFCs (`Sidebar.vue`, `PlayerBar.vue` ...) + plain `player.ts`/`color.ts` kept as is | none | none |
| creative_browser_templates | stay plain JS/Canvas/Three (no framework needed); optional Vue panel only for sliders/toggles | none | none (mic needs localhost/https) |
| composio dashboard | the proto kit is already Vue 3 CDN | none | none |

Tag consequence: a `native-only` row stays in `user_read.md` (so the user sees it was considered) but has NO task and NO test; it appears under "Not included (on purpose)".
