# Test 1: loop_ferry_f_1 (no multi-agent)

Generated 2026-11-09T13:09:33.550Z. 38/38 passed.

Harness under test: `harness/` (agents/, pipelines/, core/). Offline = scripted agents through the real harness code; real = `claude -p` haiku, persistent sessions. Real suite NOT run.

| suite | id | check | result |
|---|---|---|---|
| offline (scripted agents, real harness code) | F1 | happy path: plan,build,review once, done | PASS |
| offline (scripted agents, real harness code) | F1b | three agent rows, each with its own session id, all idle | PASS |
| offline (scripted agents, real harness code) | F1c | reports and events are recorded for every call | PASS |
| offline (scripted agents, real harness code) | F2 | issue loop: plan,build,review,plan,build,review then done in 2 rounds | PASS |
| offline (scripted agents, real harness code) | F2b | round 2 resumes the SAME session of each role (no new session) | PASS |
| offline (scripted agents, real harness code) | F2c | the resumed planner gets only the new finding, not the request again | PASS |
| offline (scripted agents, real harness code) | F2d | the builder is told which finding to fix; the reviewer is told what it raised before | PASS |
| offline (scripted agents, real harness code) | F2e | resume counters: 1 each; finding F1 ends fixed | PASS |
| offline (scripted agents, real harness code) | F3 | the same finding twice stops the loop and asks the person (stuck) | PASS |
| offline (scripted agents, real harness code) | F4 | max rounds reached with new findings each time -> waiting_person | PASS |
| offline (scripted agents, real harness code) | F5 | planner triages a finding as conflicting -> person, builder NOT called again | PASS |
| offline (scripted agents, real harness code) | F6 | reviewer says pass but the check fails -> another round; done once the check passes | PASS |
| offline (scripted agents, real harness code) | F7 | second task gets its own rows and sessions; ids resolve only inside their task | PASS |
| offline (scripted agents, real harness code) | F8 | resume cap 1: round 3 rolls each role to a NEW session with a visible event and a full brief | PASS |
| offline (scripted agents, real harness code) | F9 | follow-up request: all three roles resume; prompts hold R2 only | PASS |
| offline (scripted agents, real harness code) | F12 | a failing agent halts the task and marks the agent failed | PASS |
| offline (scripted agents, real harness code) | F12b | spend cap halts the loop | PASS |
| offline (scripted agents, real harness code) | F13 | a review without a verdict line counts as a failed review, never as a pass | PASS |
| offline (scripted agents, real harness code) | F14 | a minor note on a pass is recorded but does not block | PASS |
| offline (scripted agents, real harness code) | F11 | pure pipeline: the PLANNER is a standard stage at every tier; a `when` condition still works for a custom pipeline; later rounds follow on_issue | PASS |
| offline (scripted agents, real harness code) | F11b | T4: the plan waits for a person; after approval the run continues | PASS |
| offline (scripted agents, real harness code) | F11c | approved run finishes | PASS |
| offline (scripted agents, real harness code) | F11d | decide(): pass+checks+no findings = done; failed checks = again | PASS |
| offline (scripted agents, real harness code) | F10 | agents:check passes on the real agent folders | PASS |
| offline (scripted agents, real harness code) | F10b | agents:check catches a missing callee, a cycle and a write tool on a read-only agent | PASS |
| offline (scripted agents, real harness code) | F17 | planner marks a failing-check finding out_of_scope: ignored (event), the builder still gets it, done only when the check passes | PASS |
| offline (scripted agents, real harness code) | F18 | trace helpers: 6 call spans each >= 20 ms with cost, a tree of the 3 agents, a timeline in order, a one-line summary | PASS |
| offline (scripted agents, real harness code) | F18b | search: events of one agent, events by kind prefix, the review decisions per round | PASS |
| offline (scripted agents, real harness code) | F18c | the same views from the command line on the store file (tree, log --agent, summary): works on a finished OR a live store | PASS |
| offline (scripted agents, real harness code) | F19 | a finished request is marked satisfied; a fresh session gets it under ALREADY DONE (do not redo/undo) and only the new request as work | PASS |
| offline (scripted agents, real harness code) | F20a | similar(): the real incident wording (two phrasings of the same index2.html complaint) is recognised as one finding | PASS |
| offline (scripted agents, real harness code) | F20b | similar(): precise cases | PASS |
| offline (scripted agents, real harness code) | F20 | a reviewer that rewords the same complaint each round is caught as stuck in round 2 (not only after max rounds) | PASS |
| offline (scripted agents, real harness code) | F21 | a tracked file deleted without a request is restored at once (event + audit finding), whatever the model said | PASS |
| offline (scripted agents, real harness code) | F21b | but a deletion that a request asks for is allowed | PASS |
| offline (scripted agents, real harness code) | F22 | STAGED: a builder that replies NEEDS_PARENT: stops the loop and asks the person (waiting_person, with the question; no review runs on an unfinished build); after the answer the SAME builder session continues and the task finishes | PASS |
| offline (scripted agents, real harness code) | F15 | lastJson: nested braces, braces inside strings, last marker wins, bad json -> null | PASS |
| offline (scripted agents, real harness code) | F16 | an agent folder is the standard .claude layout and has no prompt.md | PASS |
