# docs/planning: what the PLANNING agent writes

Dynamic, not a fixed checklist: the lead decides if a planner is needed (small clear jobs skip it), the planner writes only the files the task needs, and has the FE team make a quick prototype the user can iterate on. Add one line per decision to `decisions.md`; give requirements ids (R1..) when it helps tracing.

For a big task the lead does NOT start building. It first calls the **planning agent**, which reads the request (and the existing code) and persists a plan here, so every later agent (and the user) works from the same files and nobody has to guess how to split the work.

One folder per project: `docs/planning/<project>/`

| file | content |
|---|---|
| `00_brief.md` | goal, users, scope, non-goals, assumptions, open questions for the user |
| `01_architecture.md` | stack, modules, folders, boundaries, flags/config, how it is run and deployed |
| `02_ux_flow.md` | screens, navigation, states (empty/loading/error), wireframe links (artifact), copy |
| `03_data_model.md` | DB tables/collections, relations, migrations, seed data, API contracts and types |
| `04_code_flow.md` | request/data flow between modules, key interfaces (types first), error handling |
| `05_work_split.md` | independent work packages: owner agent, files it may touch, inputs, outputs, done-check |
| `06_test_plan.md` | task catalog + expected result per task, QA checks, negative cases |
| `../PHASES.md` | waterfall order of delivery (see below) |

Guidelines (judgment, not locks)
- The wireframe/prototype goes to the user (an Artifact page) before work is split; update it from their feedback until they are happy.
- Types and interfaces are defined in `03`/`04` first, so builders in parallel never disagree (and the type checker catches it before code runs).
- Every work package in `05` lists the files it owns; two packages never own the same file.
- The plan is persisted in files, not in chat: a new agent gets only the path, not a summary.

## Borrowed from loopferry (kept small)
- **Status header** on every plan file so any agent can resume after a break: `> Status: draft | agreed | building | done  ·  Updated: YYYY-MM-DD`. The planner keeps it current.
- **`decisions.md` entries** use a mini-ADR: `D-NN title | Status | Context (1 line) | Decision | Consequences`. A decision that outlives the task is never edited, only superseded by a new D-NN.
- **Folder guides:** `05_work_split.md` gives each package a short `AGENTS.md` in its folder (what it is, stack, rules, how to check). A builder reads the guide of the folder it changes. (`CLAUDE.md` can be a symlink to it.)
- **`pending.md`** (optional): open questions only the USER can answer, one line each; the lead reads it before reporting.
- **Learnings:** if an agent had to work something out (a gotcha, a command), it adds one line to `learnings.md` in the plan folder instead of only saying it in chat.
- **PHASES.md** has a "Public API added" column per phase (files, types, endpoints a later phase may rely on).

## The structure grows on demand (planner creates, splits, moves)
A file stays one file until it is too big or has independent parts. Then the planner turns it into a folder.

```
02_ux_flow.md                    # small app: one file
02_ux/                           # big app: split by area
  README.md                      # index: one line + link per part
  01_auth.md   02_feed.md   03_dm.md
  components/                    # shared parts: NavBar.md, PostCard.md
  theme.md                       # tokens: color, spacing, type
```

Rules (keep every file short: facts, tables, pseudo-code; no theory)
- Split when a file passes ~150 lines or two teams need different parts. Merge back when a part stays tiny.
- One owner per file; one topic per file; the folder `README.md` is the index.
- Links are relative md links, written like `[feed]` + `(02_ux/02_feed.md)`; each file opens with a 1-line purpose and ends with `See also:` links.
- Check after a move (free): `bun test_harness/core/check_plan_links.ts docs/planning/<project>`.
- Moving or renaming a file = fix EVERY link to it in the same step. Find them with `grep -rn "<old name>" docs/planning/<project>/`; none may be left (also in `PHASES.md`, `05_work_split.md`, `decisions.md`).
- The planner is read-only: it tells `ux-designer` / `builder` (with `--writes docs/planning/<project>/**`) what to create or move.

```
plan_structure(project):
  for file in plan_files:
    if lines(file) > 150 or parts_need_different_owners(file):
      folder = mkdir(strip_ext(file)); split(file -> folder/NN_<topic>.md); write folder/README.md (index)
      replace_links(old=file, new=folder/README.md)        # grep, fix all
  assert no_broken_links(project)                          # grep every ](path) exists
```
