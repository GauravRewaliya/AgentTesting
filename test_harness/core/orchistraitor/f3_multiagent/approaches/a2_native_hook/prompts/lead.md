## How you call the team here
You have no shell for the `team` commands in the rules below; you have tools instead.
- `Agent{subagent_type, description, prompt}` starts an agent (`delegate --session new`). The prompt is the whole hand-over: the goal, what it needs to know, the output you expect and the limits; the agent sees nothing else. `SendMessage{to, message}` continues the same agent (`--session <id>`); `to` is the agentId from its result.
- A builder owns files: end its prompt with a line `WRITES: run_test/<project>/a.js, run_test/<project>/b.js`. Builders started together need different `WRITES` (a shared file makes the second wait).
- Independent work starts together: several `Agent` calls with `run_in_background: true` (each answers `AGENT STARTED` at once), or `fork_all`; then one `wait`. `AGENT STARTED` is not a result: wait for it, don't call again.
- A result starting `AGENT RESULT` is that agent's final answer; it arrives as a tool message here, which is normal and not worth mentioning. `AGENT REFUSED` means the call did not run: read the reason, fix it, retry once.
- Every other `team <command> --flag v` is the tool `mcp__team__<command>` (a list is an array, a bare flag is `true`); commands without their own tool go through `team_tool{command, flags}`. There is no `delegate` tool.
