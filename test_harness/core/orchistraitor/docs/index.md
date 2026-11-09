# orchistraitor docs: index

| doc | what it is | approach | +ve | -ve |
|---|---|---|---|---|
| [harness_own_custom](harness_own_custom.md) | fake sub-agents answering a real lead from recorded results | test how the lead hands work over and how sessions behave | rules R1-R4 hold; zero sub-agent cost | no nested/background/real edits; memory faked; one run per case |
| [f1_stage](f1_stage.md) | plan -> build -> review, persistent session per role, no multi-agent | workflow order, ledger, tiers, deterministic check wins | **38/38** offline; real copy task 15 s, ~$0.003 (old: 558 s, $1.81) | real I1b fails (resume_count=0); no parallelism; prototype |
| [f1_multiagent](f1_multiagent.md) | f1_stage + lead, locks, worktrees, patches, board, PM, console | lead delegates when work is independent; off by default | **167/167** offline; 3 researchers 12 s vs 32 s | slower/costlier on small work; real runs not re-run; open loopholes |

Pick: **f1_stage as default**; **f1_multiagent only for independent parts** or live talk; **harness_own_custom** to test hand-over without paying for sub-agents.

Full design and evidence: `/home/gr/projects/loopferry/handbook/PLANS/20261105_ARCHITECTURE_PLAN.md` (section C = comparison, C.8b = test results of 2026-11-09).
