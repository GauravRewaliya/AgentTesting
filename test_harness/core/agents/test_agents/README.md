# test_agents: test stand-ins, NOT part of the real team

These agents are never run for real (`"fixtures": true`): the FixtureGate answers for them from recorded results
(`TestCases/test_folders/agent_fixture`). A test case declares one in its `agents` list; the real lead never sees them.
The real team is `../agents/`: lead, builder (+ Expo skills), planner, researcher, lookup, ux-designer, qa-reviewer, pm.

Real roles (planner, builder, qa-reviewer, ...) are mocked per CASE: a case that lists recorded results in `expected_agents_res` makes the gate answer for those roles from exactly those results (and its `guard` rules file); no folder here is needed.
