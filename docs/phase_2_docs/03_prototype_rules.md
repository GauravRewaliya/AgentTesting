# 03 Prototype rules

A prototype exists so the user can SEE the layout and the flow before anything real is built.

- **FE only.** No backend, no server, no database, no API, no auth.
- **Fake data** from ONE module (faker-style, in memory or JSON). Later it can be swapped for sqlite or a real API. The prototype does not decide where a column or its data comes from.
- **Step 1, layout:** page structure, navigation and the main screens as a clickable wireframe.
- **Step 2, exact UX/UI of the FE:** components split by the planner, one consistent theme and style (colors, spacing, typography, light and dark tokens), all states (empty, loading, error), interactive navigation between screens.
- **Follows the flow and features of a reference product, not its pixels.** For reference sites (Instagram, Composio) the agents check the web for the FLOW and the feature set only.
- **Shown to the user, then feedback.** The planner updates the plan and the prototype from the feedback.
- The real build starts only after the user is happy.
