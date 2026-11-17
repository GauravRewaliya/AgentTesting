# Progress and Found: internal notes (this project only, not for sharing)
Moved out of ProgressAndFound.md so that file reads without project access.

Where to read more
|- docs/RUN_FINDINGS.md   full issue catalog (H1-H18, P1-P4, C1-C4, X1-X6)
|- docs/POINTS.md         what the harness must have + status
|- docs/PROJECT_MEMORY.md commands, background jobs, preview, settings
|- docs/PROTOTYPE_KIT.md  no-build prototype flow, lock lease, quick static check
|- docs/QA_ISSUES.md      QA / docker / video issues
|- TestCases/test_folders/TODO.md   open work

Plain words in ProgressAndFound.md -> real names here
|- start all copies at once       = `fork_all --from <id> --tasks [...]`, then one `wait`
|- real check (QA)                = `qa_check`; quick static check = `proto_check`
|- one short command wrapper      = `team <cmd>`
|- shared context list            = `run_test/plan/CONTEXT.txt`; kit reference = appended to `PROTO.md`
|- project folder                 = `run_test/<project>/`
|- session choice                 = `--session new | <agent_id> | fork:<agent_id>`
|- look at the sub agent          = `agent_peek`, `attention` field of `wait`
|- background job                 = `bg_start`, `bg_list`, `bg_log --tail N`, `bg_stop`; store `<store>/bg/`
|- report                         = `report_issue_to_admin` -> `admin_issues.jsonl`
|- master / sub agent / harness   = lead / builder, planner, ... / the f1_multiagent code

TODO phases (TestCases/test_folders/TODO.md): [topic] -> what
|- [planning]            -> done: planner + plan_lint; open: PHASES.md waterfall, LSP for sub agents, multi-phase product, clone with captured reference, feedback loop with the person
|- [fewer calls]         -> decided: keep harness fan-out (site_build is ONE command); progress from tool events, no model-written lines; done: status without paid resume
|- [why slow and costly] -> found: lead waited in a hidden queue, UI cost missed the lead; done: slots 3 + "queued", cost from events, balanced plan
|- [review of actions]   -> done: idle resumes, lead prompt 32 KB -> 6.6 KB, denied alias form, quality bar in plan
|- [tool surface]        -> found: thinking time tiny, cost = wasted calls; done: `team <cmd>`, chapters; decided: do NOT split tools.ts
|- [plans + hardening]   -> open: NES plans, parked AI plans, builds of ready plans, docker watchdog, admin issues UI, version pins vs pnpm age

Open points
|- bg_log has `--tail` but no `--grep` / `--since`
|- no push "finished" message to the agent that started a bg job
|- hung-CLI watchdog not yet in the docker runner
|- whole-task "took longer than planned" report, admin issues page in the UI
|- loop_ferry.json (qa.is_enable / notes / note_file) and the default-context JSON for the master are proposed, not built
|- no lead-level test case yet for: exceeding call limits, two builders on one file, QA missing a bug, blank page counted ok
|- unlisted agents are not refused in every case setup
|- git branch per phase + review before merge, resume a plan after a crash
