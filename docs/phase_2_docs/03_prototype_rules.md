# 03 Prototype rules

A prototype exists so the user can SEE the layout and the flow before anything real is built.

- **FE only.** No backend, no server, no database, no API, no auth.
- **Fake data** from ONE module (faker-style, in memory or JSON). Later it can be swapped for sqlite or a real API. The prototype does not decide where a column or its data comes from.
- **Step 1, layout:** page structure, navigation and the main screens as a clickable wireframe.
- **Step 2, exact UX/UI of the FE:** components split by the planner, one consistent theme and style (colors, spacing, typography, light and dark tokens), all states (empty, loading, error), interactive navigation between screens.
- **Follows the flow and features of a reference product, not its pixels.** For reference sites (Instagram, Composio) the agents check the web for the FLOW and the feature set only.
- **Shown to the user, then feedback.** The planner updates the plan and the prototype from the feedback.
- The real build starts only after the user is happy.

## Seeing it: live preview vs Claude Artifact
- **Live preview (our default for a real prototype project):** a Vite/React project in `run_test/<app>`, started by `tools.ts preview` (Docker, link on 127.0.0.1) or the **bg running** badge in the Experiment Run session header (hover). The prototype is real code the FE team keeps building on, so nothing is thrown away. Works for any size and many pages.
- **Claude Artifact (good for small or medium prototypes and for sharing):** one self-contained page, shareable link, no server. Multi-file artifacts exist (several files published together), so a large prototype can also be published as a STATIC build (`vite build` output) when you want to hand someone a link.
- Rule of thumb: small prototype, quick look or sharing -> Artifact; many screens or a project that will become the real FE -> project + live preview, then (optional) publish the static build.
- Debug: the UI's Debug switch (D key) frames every component with its name, so a prototype page can be inspected page by page.

## Update 2026-11-13: how prototypes are built now
The default is a NO-BUILD prototype (Vue 3 from a CDN, plain files) started by `proto_init` (design kit + shell + stubs), filled by parallel builders and checked route by route by `preview`. No Vite project, no planning files first. Details, files and past-vs-now: `../PROTOTYPE_KIT.md`. The Vite + live preview route above is only for the REAL app.
