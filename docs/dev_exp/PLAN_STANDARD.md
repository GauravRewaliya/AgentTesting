# The plan package: how we present a plan to stakeholders

A plan is a **proposal the person signs off on**, then a **contract the builders build from**. Those are two readers with two different jobs, so one folder holds two layers. This is how a real architecture team works: a short deck-like pack for the people who decide, and a build pack underneath for the people who deliver.

| layer | reader | question it answers | how it looks |
|---|---|---|---|
| **Decide** (top of every page) | owner, sponsor, reviewer | What do I get? How will it look? What does it cost me in decisions? How will we both know it is done? | plain words, tables, pictures, no file names, no tool names |
| **Build** (inside `<!-- dev -->` ... `<!-- /dev -->`) | builders, the lead | What exactly do I write, in which file, against which numbers? | file trees, contracts, commands, EARS rules |

The plan viewer (`docs/dev_exp/plan_viewer`) hides every `dev` block in **Stakeholder** mode and shows it in **Builder** mode. If a sentence would confuse a non-developer, it belongs in a dev block.

## The pack (one folder, in reading order)

| # | file | for | what a stakeholder finds there |
|---|---|---|---|
| 1 | `README.md` | decide | **Executive summary** (one paragraph), **scope in / out**, **what you get** (feature catalog), **roadmap** (phases with a demo each), **decisions needed from you**, **risks**, **how we will know it is done**, how to review |
| 2 | `01_experience.md` | decide | **Who uses it** (personas), **user journey** (steps and what they see), **wireframes** (clickable `wireframes/*.html`), look and feel, motion, content rules |
| 3 | `02_architecture.md` | decide + dev | **System context** (what is inside, what is outside), **components and layers**, **data model**, **key flows** (sequence and state diagrams), **non-functional targets** (speed, accessibility, security), **tech choices with the reason** |
| 4 | `PHASES.md` | decide + dev | **Roadmap table** (phase, outcome in one line, demo, depends on, size), per phase: **what you will be able to do**, **acceptance checks**, **out of this phase**; the task table is a dev block |
| 5 | `pending.md` | decide | questions only the person can answer, each with our default and what changes if they disagree |
| 6 | `build_inputs/` | dev | contract, design system, briefs, data (never read by stakeholders) |
| 7 | `CONTEXT.txt` | dev | files every builder gets in front of its first prompt |

Small job (one screen, one change): README only, with the same first five headings of the summary. The pack grows with the project; it never gets messier.

## Rules for the Decide layer

1. **Outcome before mechanism.** First line of every page: what this page lets the reader decide or check.
2. **No internal words.** Never: file names, `T04`, `pnpm`, `tsc`, tool names, agent names, session ids. Say "the camera tour" not `camera/tour_rig.js`.
3. **Every claim is checkable.** An acceptance check is a click path and what must appear, or a number. "Looks good" is not a check.
4. **Say what is real, guessed or invented**, in a column, not a footnote. A guess carries its fallback ("if X is not possible we do Y and tell you").
5. **Show, do not describe.** Layout = wireframe. Structure = diagram. Order of delivery = roadmap table. Data = a small ER diagram or table. Use Mermaid for diagrams (the viewer renders it) and a self-contained `.html` for wireframes (no network, grey boxes, real labels).
6. **Decisions are first-class.** One table: id, question, our default, why, what changes if you say no, state (`open` / `agreed`). Open decisions sit on the front page.
7. **Phases are demos, not task lists.** A phase is finished when a stakeholder can *see something new work*. Name the demo ("open the page, press Explore, the camera flies stop 1 to 3").
8. **Scale by splitting, not by growing.** More than about 150 lines, or more than one reader: make a folder with its own README index (screens, modules, epics). The front page stays one screen of reading.
9. **Change control.** Say how to ask for a change (Ask Claude on the page), that the plan file is edited, and that `git diff docs/` shows exactly what moved. A scope change names the phase it lands in.

## Diagram kit (what to draw, in this order)

| question | picture | Mermaid |
|---|---|---|
| What is in the system and what is not? | system context | `flowchart` with a boundary `subgraph` |
| What are the parts and who talks to whom? | component / layer view | `flowchart LR` with one `subgraph` per layer |
| What data exists? | data model | `erDiagram` |
| What happens when the user does X? | key flow | `sequenceDiagram` |
| What states can it be in? | state machine | `stateDiagram-v2` |
| In what order is it delivered? | roadmap | table (phases) plus `flowchart LR` of dependencies |

A diagram has at most about 12 boxes. Name the boxes in user words and put the file in the dev block.

## Status words (same everywhere)

`planning` = still being written or facts missing · `planned` = split into tasks, **nothing built yet** · `in progress` · `review` (built, waiting for the person) · `done` (the person accepted it).

## How the lead talks to the person

The same split applies to messages. See `agents/lead/.claude/CLAUDE.md`, section *Talking to the person*. Short form: **Outcome, Evidence, Needs from you, Next**, in that order, in the person's words.

## Checklist before a plan goes to a stakeholder

- [ ] The first screen of README answers: what is it, what do I get, what do you need from me.
- [ ] Every phase has a demo a person can run.
- [ ] At least one wireframe or diagram per layer that matters (screens, parts, data, key flow).
- [ ] Open decisions and risks are on the front page, with defaults.
- [ ] No internal word in a Decide block (search for `pnpm`, `.js`, `T0`, `agent`).
- [ ] Builder material is inside dev blocks and `plan_lint` passes.
