# UX flow and designs: files and formats
Folder: the one your task names, else `run_test/plan/02_ux/` (the plan format keeps UX there).

## flow.md (always)
- `## Who` one line per kind of user and what they want.
- `## The flow` a table: step, the person does, the person sees, screen. Entry to goal, then the one error or empty path that matters.
- `## Screens` per screen: purpose, components, states (default, empty, loading, error), exact labels, where it leads. One short block each; when builders will build the screens in parallel (or the task asks): also `screens/<name>.md`, one file per screen, so each builder owns one file. Otherwise the blocks here are enough.
- `## Taken / invented` which screens and features come from the requirements and which you added to make the flow work (keep that list short).
- An optional mermaid `flowchart` of the steps.

## themes.md (a design was asked for; not for plan only)
One section per design, headed `Design A`, `Design B` ...: mood in one line, palette as roles (page, surface, text, muted, primary, accent; light and dark), type (heading and body), shape (radius, border, shadow), density, and one line on what makes it different from the others. N designs asked = N sections, default 1.

## designs.html (a design was asked for)
ONE self-contained file: no build, no libraries, a few lines of script. Light and dark, readable at 390 px.
1. `<section id="themes">` first: one card per design with the MAIN screen drawn in that design's palette and type, real labels, the design's name. Cards sit side by side (a row that wraps). Clicking a card selects that design.
2. `<section id="prototype">` below it: the flow clickable screen to screen (a hash router, a few lines), in the selected design. Every button and link on the flow goes somewhere.
The wording is the same in every design; only the look and layout change.

## Do not
Write app code (.ts .vue .tsx, components), add features, restyle only the colour and call it a design, or stop at a plan when designs were asked.
