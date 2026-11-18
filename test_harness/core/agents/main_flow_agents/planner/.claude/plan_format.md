# The plan format (what a buildable plan contains)

One folder, `run_test/plan/`. Two readers: the PERSON judges it (feature catalog, look and feel, Done when), the DEVELOPER builds from it (recipe, contract, owners, quality bar). `audience:` in each file's frontmatter says which (`user`, `dev`, `both`). `team plan_lint` checks all of this for free.

| file | reader | holds |
|---|---|---|
| `README.md` (under 12 KB, the lead reads it in full; every section has real content, not just a heading) | both | frontmatter (`audience`, `title`, `status`); **Build recipe** (numbered, short: where it is built, the kit command, who owns which files, how to verify, what NOT to do); **What is it**; **What you get** (feature catalog table: id, feature, what you see or do, phase, status); **Look and feel** (numbers: colours, type, spacing, motion table); **Quality bar** (checks that can be measured: contrast 4.5:1, tap targets 40 px, no text under 12 px, heading order, 0 console errors); a Team table (who does which tasks) |
| `PHASES.md` | both | a phase table; per phase: goal, a task table (`T01`, what, owner, needs; each builder task names the files it owns, no file in two tasks), and **Done when** = 5 to 10 checks a browser or command can run, each with a concrete number, route, quoted text or colour (a click path and what must appear, a number, a colour) ; **Not in this build** so nobody builds later phases |
| `build_inputs/` or `0N_*.md` | dev | `00_contract.md` (routes, data shapes, names every builder must agree on, a quality bar for builders), design system, one brief per builder with its layouts; screens as `02_ux/screens/<screen>.md` for an app |
| `CONTEXT.txt` | dev | one path per line (relative to `run_test/`): the files EVERY builder needs (contract, design system, theme, motion, `<project>/PROTO.md`). The harness puts them in front of each builder's first prompt, so no builder spends tool turns reading them. Per-builder briefs are not listed: the task names them |
| `## Research` in the README (or `research.md`) | both | 2 to 4 sources with URL, what each told you, and the one thing it changed in the plan; what you could not see (a login wall, no access) and therefore marked invented |
| `pending.md` | person | questions only the person can answer, one line each, with your default |

Rules that came from real builds (each one removed a paid fix round):
- Put the quality bar into what BUILDERS read (the contract), not only into a task after the audit. A rule the builder first meets in the audit costs a second round of every builder.
- Balance the work: about equal parts per builder (screens or pages), file names exactly as the kit creates them (`proto_init` names files from the nav; check its output). One builder with half the screens is the critical path.
- One owner per file. Shared things (theme, shell, router, kit files) belong to nobody: builders never edit them.
- What the kit does (so you can name files exactly): `proto_init --kind site --nav "A, B, C"` makes the shell and one `js/screens/part-N.js` + `css/pages-part-N.css` per 2 pages in nav order (5 pages = 3 files); `--kind app` groups about 4 screens per file (at most 4 files); `Group>Label` in the nav puts a group's screens in one file. It also writes `PROTO.md` (contract, classes, icons, helpers). The last nav item becomes the header button.
- Say what is captured, user-given or invented, per screen. Invented screens get a line why they are plausible.
- Done when is the contract with the person: steps a browser can run, never "looks good". Include one check per feature that matters (a click and what appears) and a persistence check (reload).
- The plan IS the planning for the builders: no "write a plan" task inside it, no wireframe step, no placeholder pages. Each builder delivers finished pages in one pass.
- Keep every file short (facts, tables, numbers). Over about 150 lines or two teams needing different parts: split into a folder with a README index.

## The stakeholder layer
Each page: a DECIDE part on top (plain words: no file names, `T04`, `pnpm`, tool or agent names), then the BUILD part inside `<!-- dev -->` ... `<!-- /dev -->`.
- **README, in order:** Executive summary -> What is it -> **Scope** -> **What you get** -> **Roadmap** (phase, outcome, demo, depends on, size) -> **Decisions** (id, default, what changes if no, state) -> **Risks** -> Quality bar; then ONE dev block: Build recipe, Team, Research.
- **Pictures:** `01_experience.md` (personas, the visit step by step, `wireframes/screens.html` = one file with tabs and real labels, embedded as `![alt](wireframes/screens.html)`, look, motion); `02_architecture.md` (context, layers, `erDiagram`, `sequenceDiagram` / `stateDiagram-v2`, targets, tech choices with reasons).
- **PHASES.md:** roadmap table; per phase: goal, what the person can do, plain Acceptance, Not in this phase; tasks and technical Done when in a dev block. Only the person's "accept" opens the next phase.
