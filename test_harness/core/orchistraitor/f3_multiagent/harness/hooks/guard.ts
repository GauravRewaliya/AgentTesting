// PreToolUse hook: no lock, no work. Runs before Write/Edit/MultiEdit/NotebookEdit and before every Bash command.
//   - a file edit needs a lock that covers the path; a command in a family (@git, @migrations, @tests) needs that resource
//   - the agent never takes or frees a lock: the harness took them before it started and frees them when its call ends
//   - FAILS CLOSED: if the identity or the lock service is missing or broken, the answer is DENY (never "allow because we could not check")
// Identity comes from the process environment (backend P: one process per agent). Backend: the registry file, or Redis when HARNESS_LOCKS_URL is set.
import { readFileSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { MStore } from "../core/board.ts";
import { locksFromEnv } from "../core/lockapi.ts";
import { resourcesFor } from "../core/locks.ts";

const deny = (reason: string, event?: { task: string; agent: string; target: string; holder?: string }): never => {
  // the file registry backend logs its own denials; Redis does not, so the hook records them (who, what, held by whom)
  if (event && process.env.HARNESS_STORE) { try { const st = new MStore(process.env.HARNESS_STORE); st.tx(() => st.ev("edit.denied", event.task, event.agent, { [event.target.startsWith("@") ? "resource" : "file"]: event.target, holder: event.holder ?? null, backend: "redis" })); } catch { /* never let logging change the decision */ } }
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }));
  process.exit(0);
};
try {
  const input = JSON.parse(readFileSync(0, "utf8") || "{}") as { tool_name?: string; tool_input?: { file_path?: string; notebook_path?: string; command?: string } };
  const { HARNESS_STORE: file, HARNESS_TASK: task, HARNESS_AGENT: agent, HARNESS_CWD: cwd = process.cwd(), HARNESS_LOCKS_URL: url } = process.env;
  if (!task || !agent || (!file && !url)) deny("LOCK CHECK IMPOSSIBLE: this run has no lock identity, so nothing is allowed. Stop and report it.");
  const api = locksFromEnv(new MStore(file));
  if (input.tool_name === "Bash" && process.env.HARNESS_TRACE_BASH === "1" && process.env.HARNESS_STORE) {   // diagnostics: every shell command an agent attempts (a command the permission list then refuses is otherwise invisible)
    try { const st0 = new MStore(process.env.HARNESS_STORE); st0.tx(() => st0.ev("bash.attempt", task, agent, { command: String(input.tool_input?.command ?? "").slice(0, 300) })); } catch { /* diagnostics never change the decision */ }
  }
  if (input.tool_name === "Bash" && /^lead/.test(agent!)) {   // the lead may use plain file commands on ../store (settings.json allow-list matches the TEXT only, and `*` also matches `..`): any other `..` segment is an escape out of the store folder, so it is refused
    const cmd = String(input.tool_input?.command ?? "").replace(/\.\.\/store(?=[\/\s"';|&]|$)/g, "STORE");
    if (/(^|[\s\/="'(])\.\.(?=$|[\/\s"';|&)])/.test(cmd)) deny("PATH ESCAPE: only `../store/...` may be named with `..` (your store folder next to the workspace). Use `team ls|read_file|grep` for the workspace.");
  }
  if (input.tool_name === "Bash") {
    for (const r of resourcesFor(String(input.tool_input?.command ?? ""))) { const g = await api.guard(task!, agent!, r); if (!g.allow) deny(g.reason, api.kind === "redis" ? { task: task!, agent: agent!, target: r, holder: g.holder } : undefined); }
  } else {
    const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
    if (!target) deny("LOCK CHECK IMPOSSIBLE: the edit names no file.");
    const rel = isAbsolute(target!) ? relative(cwd, target!) : target!, g = await api.guard(task!, agent!, rel);
    if (!g.allow) deny(g.reason, api.kind === "redis" ? { task: task!, agent: agent!, target: rel, holder: g.holder } : undefined);
  }
  process.exit(0);
} catch (e) {
  deny(`LOCK SERVICE UNAVAILABLE: ${String(e).slice(0, 160)}. Nothing is allowed while locks cannot be checked. Stop and report it.`);
}
