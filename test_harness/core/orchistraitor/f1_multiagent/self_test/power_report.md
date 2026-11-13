# Power layer: phase gates, agent_peek, slash commands, budget

Generated 2026-11-13T14:41:09.323Z. 38/38 passed.

Offline: fake agents, real harness code, no model calls.

| suite | id | check | result |
|---|---|---|---|
| phase gates (pure) | G1 | a task without a phase is never gated | PASS |
| phase gates (pure) | G2 | phase 2 task waits when phase 1 is done but its gate is not passed | PASS |
| phase gates (pure) | G3 | passPhase records the gate and opens phase 2 | PASS |
| phase gates (pure) | G4 | phase 3 still waits: phase 2 is not finished | PASS |
| phase gates (pure) | G5 | passing a phase with open tasks, short evidence and no gate-1... is refused with every reason | PASS |
| phase gates (pure) | G6 | passing is refused while the last qa_check failed | PASS |
| phase gates (pure) | G7 | a failed phase makes later phases dead (skipped, never started) | PASS |
| phase gates (pure) | G8 | passing twice is idempotent | PASS |
| phase gates (pure) | G9 | a replan that reopens phase-1 work reopens the gate | PASS |
| phase gates (pure) | G10 | phase_status states: ready_for_gate then waiting | PASS |
| phase validation | V1 | a phased plan is accepted | PASS |
| phase validation | V2 | a task cannot depend on a later phase | PASS |
| phase validation | V3 | phase must be a whole number 1..20 | PASS |
| scheduler enforces the gate (fake agents, real tools.ts) | S1 | phase 1 runs by itself; phase 2 and 3 do NOT start while the gate is closed | PASS |
| scheduler enforces the gate (fake agents, real tools.ts) | S2 | phase_pass for phase 2 is refused (phase 1 gate missing, phase 2 not done) | PASS |
| scheduler enforces the gate (fake agents, real tools.ts) | S3 | after phase_pass 1, phase 2 starts and finishes; phase 3 still waits | PASS |
| scheduler enforces the gate (fake agents, real tools.ts) | S4 | after phase_pass 2 the plan finishes: every task done, plan done | PASS |
| scheduler enforces the gate (fake agents, real tools.ts) | S5 | phase_status lists three passed/ready phases | PASS |
| agent_peek, cost, slash commands | K1 | agent_peek answers for a known agent and says it is not running | PASS |
| agent_peek, cost, slash commands | K2 | a running agent silent for 400 s is flagged stuck with the advice to nudge or stop | PASS |
| agent_peek, cost, slash commands | K3 | agent_peek of an unknown agent is a clear error | PASS |
| agent_peek, cost, slash commands | K4 | cost reports total and the budget left | PASS |
| agent_peek, cost, slash commands | K5 | slashName knows our commands only: /status yes, a path or /api sentence no | PASS |
| agent_peek, cost, slash commands | K6 | /help lists every command | PASS |
| agent_peek, cost, slash commands | K7 | /status shows the team, the plan with phases and the spend | PASS |
| agent_peek, cost, slash commands | K8 | /phases and /plan and /agents answer | PASS |
| agent_peek, cost, slash commands | K9 | /peek without an agent gives usage; with one it answers | PASS |
| agent_peek, cost, slash commands | K10 | /say puts a note from the user in the store | PASS |
| agent_peek, cost, slash commands | K11 | /pause pauses the latest plan through the same tool an agent uses | PASS |
| agent_peek, cost, slash commands | K12 | /resume undoes it | PASS |
| agent_peek, cost, slash commands | K13 | /stop stops the agent and /stop without an id gives usage | PASS |
| project budget | B1 | a call is refused with budget_exceeded once the spend reaches the project budget | PASS |
| project budget | B2 | the same call is allowed while under budget (and always when no budget is set) | PASS |
| model policy (sonnet everywhere, haiku for small jobs) | M1 | every real role is sonnet in agent.json (lead, planner, pm, builder, researcher, reviewer, writer, ux-designer, qa-reviewer, package-researcher) | PASS |
| model policy (sonnet everywhere, haiku for small jobs) | M2 | haiku is allowed for builder/researcher/writer/package-researcher only; lead, planner, pm, reviewer stay sonnet; unknown names refused | PASS |
| model policy (sonnet everywhere, haiku for small jobs) | M3 | a plan task may ask for haiku on a builder but not on a planner | PASS |
| model policy (sonnet everywhere, haiku for small jobs) | M4 | delegate --model haiku to a planner is refused with the reason | PASS |
| model policy (sonnet everywhere, haiku for small jobs) | M5 | delegate --model haiku to a researcher runs and the choice is kept on the call record | PASS |
