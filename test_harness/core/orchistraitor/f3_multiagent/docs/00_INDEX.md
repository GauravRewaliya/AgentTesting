# Index

| # | File | Answers |
|---|---|---|
| 01 | FLOW_CLAUDE_vs_OURS | how real Claude delegates vs each approach, side by side |
| 02 | ARCHITECTURE | layers; the one rule that makes the core shareable |
| 03 | CORE_INVENTORY | which f1 file is shared, coupled, test-only, legacy |
| 04 | APPROACH_PORT | the interface an approach implements (pseudo code) |
| 05 | OVERRIDE_AND_INDEX | how `index.ts` picks an approach and `custom/` overrides |
| 06 | CONS_OF_APPROACHES | what is wrong with each of the 3 approaches, with evidence |
| 07 | PROMPTS_REVIEW | lead prompts compared; what to add to f1 |
| 08 | MIGRATION_STEPS | ordered steps and every outside file that imports f1 |
| 09 | RISKS_AND_STATE | clashes when two approaches run side by side |
| 10 | OPEN_DECISIONS | questions for the person, none answered |

## Glossary
- **Approach**: how the lead's wish "call a sub-agent" is expressed and answered (shell command, intercepted Agent tool, native Agent tool).
- **Core**: everything identical for every approach (locks, store, worktrees, phases, fixtures, budget).
- **Port**: the small interface between them (`docs/04`).
- **Fixture / mocked agent**: a sub-agent answered from a recorded result, no model call.
- **CallReq / CallRes**: the shared request/response of `core/delegate.ts`.
- **A1 / A2 / A3**: team CLI (f1) / mod interception (`harness_own_custom`) / native `--agents`.
