// Scenarios we NEVER run on this harness (it would give a false answer). A warning is printed instead.
// Each row: case id (or a scenario name if the case does not exist yet), the capability that is missing, and why.
// Add a row when you find a scenario the harness cannot honestly test. Remove it when the harness learns it.
export const skip_test: { id: string; needs: string; reason: string }[] = [
  { id: "nested_subagents", needs: "multiagent.nested", reason: "a sub-agent here is a lookup; it cannot spawn another agent" },
  { id: "background_agent_status", needs: "multiagent.background", reason: "every call is answered immediately, so 'still running' never happens" },
  { id: "subagent_edits_files_for_real", needs: "sandbox.tools", reason: "sub-agent never uses Edit/Write/Bash; permission and persistence bugs cannot show" },
  { id: "worktree_isolation", needs: "sandbox.worktree", reason: "no worktree/branch per agent" },
  { id: "long_session_compaction", needs: "session.compaction", reason: "history is never trimmed or summarised" },
  { id: "subagent_token_budget", needs: "subagent_cost", reason: "sub-agent cost is zero by design" },
  { id: "expo_t1_plan", needs: "guard.roles", reason: "role-order guard not ported (sources in TestCases/test_folders/agent_fixture/store/legacy)" },
  { id: "expo_t2_wireframe", needs: "guard.roles", reason: "same" },
  { id: "expo_t3_build", needs: "guard.roles", reason: "same" },
  { id: "lsp_rename_define_lookup", needs: "-", reason: "tests the lead's own LSP use, not hand-over; needs the LSP plugin + local server, not this harness" },
];
