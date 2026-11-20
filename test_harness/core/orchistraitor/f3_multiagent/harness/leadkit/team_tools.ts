// THE TEAM TOOLS AS DATA: names, descriptions and input schemas of the lead's `team` commands, and how a tool call becomes the argv of `harness/tools.ts`.
// Pure (no Node): the a3 mod copies this file into its plugin folder (`$.tool.register` from `listed()`, `toArgv` on each call) and the a2 MCP server imports it, so there is ONE list.
// Not offered on purpose: delegate (the Agent / SendMessage tools do it), _run / _plan internals. Every command not in CORE stays reachable through `team_tool` (its description carries the catalog),
// so the tool schemas stay small (each listed tool costs context on every turn).
export type P = { type: "string" | "number" | "boolean" | "array" | "object"; description?: string; items?: unknown; enum?: string[] };
export interface Tool { name: string; description: string; props: Record<string, P>; required?: string[] }
const s = (description: string): P => ({ type: "string", description });
const n = (description: string): P => ({ type: "number", description });
const b = (description: string): P => ({ type: "boolean", description });
const ids = (description: string): P => ({ type: "array", items: { type: "string" }, description });

export const TEAM_TOOLS: Tool[] = [
  { name: "wait", description: "Collect the answers of background agents (started with Agent{run_in_background:true} or agent all). Waits until they finish (or the first one with any:true).", props: { agents: ids("agent ids, e.g. researcher#1"), any: b("return as soon as the FIRST is done"), timeout: n("seconds, default 300") }, required: ["agents"] },
  { name: "fork_all", description: "N tasks for N copies of one agent's memory, ALL STARTED AT ONCE; then ONE wait.", props: { from: s("agent id whose memory is copied"), role: s("agent role, e.g. builder"), tasks: { type: "array", items: { type: "object" }, description: "[{title, writes:[paths], objective, output?, boundaries?, model?}]" }, output: s("default output format"), boundaries: s("default limits") }, required: ["role", "tasks"] },
  { name: "plan_submit", description: "Submit a phased plan (phase n+1 waits for phase n).", props: { tasks: { type: "array", items: { type: "object" }, description: "[{id, role, objective, output, boundaries, deps?, writes?, phase}]" } }, required: ["tasks"] },
  { name: "plan_run", description: "Start a submitted plan.", props: { plan: s("plan id") }, required: ["plan"] },
  { name: "plan_status", description: "Status of a plan; wait: block up to N seconds for progress.", props: { plan: s("plan id"), wait: n("seconds") }, required: ["plan"] },
  { name: "plan_answer", description: "Answer an agent that replied NEEDS_PARENT; the same agent continues.", props: { plan: s("plan id"), item: s("plan task id"), text: s("the answer") }, required: ["plan", "item", "text"] },
  { name: "phase_pass", description: "A phase's exit check passed: open the next phase.", props: { plan: s("plan id"), phase: n("phase number"), evidence: s("the checks you ran and what they showed") }, required: ["plan", "phase", "evidence"] },
  { name: "phase_status", description: "Status of the phases of a plan.", props: { plan: s("plan id") }, required: ["plan"] },
  { name: "plan_lint", description: "FREE check that a plan can be built from alone.", props: { dir: s("default run_test/plan") } },
  { name: "apply_patches", description: "Put finished writers' files into the project.", props: {} },
  { name: "ledger_get", description: "The FULL answer of an agent (when a wait answer says truncated:true).", props: { report: s("report id") }, required: ["report"] },
  { name: "ls", description: "READ-ONLY: files in the shared workspace run_test/.", props: { path: s("folder, default run_test") } },
  { name: "read_file", description: "READ-ONLY: numbered lines of a file in run_test/.", props: { path: s("file"), offset: n("first line"), limit: n("lines") }, required: ["path"] },
  { name: "grep", description: "READ-ONLY: matching lines in run_test/.", props: { pattern: s("regex"), path: s("folder") }, required: ["pattern"] },
  { name: "agents_list", description: "The agents of this task with status.", props: {} },
  { name: "board_status", description: "The board: plan, agents, notes.", props: {} },
  { name: "cost", description: "What the team spent so far and what is left.", props: {} },
  { name: "say", description: "Leave a fact or question for an agent.", props: { to: s("agent id"), text: s("the note") }, required: ["to", "text"] },
  { name: "agent_peek", description: "READ-ONLY look inside a running agent: last tool calls, silence, a hint.", props: { agent: s("agent id"), n: n("how many calls") }, required: ["agent"] },
  { name: "agent_update", description: "Name what an agent is for.", props: { agent: s("agent id"), title: s("short title"), description: s("what it is for") }, required: ["agent"] },
  { name: "report_bug", description: "Record a bug for the admins (free).", props: { kind: s("bug|tool_error|plan_defect|blocked|slow|hung|stalled|lazy|bad_output"), severity: s("low|medium|high"), text: s("what you saw, what you did"), agent: s("about a sub-agent (default: yourself)") }, required: ["kind", "text"] },
  { name: "chapter", description: "The details of a recipe or tool (clone, prototype, qa, preview_bg, parallel, planning, new_project, artifact; a planner also has plan_format, a QA agent tab); read it ONCE before that work starts.", props: { name: s("chapter name") }, required: ["name"] },
  { name: "site_build", description: "THE PIPELINE of a website clone (design worker + brief + builder per screens file).", props: { dir: s("run_test/<project>"), ref: s("store name(s), comma separated"), request: s("the person's words") }, required: ["dir", "ref", "request"] },
  { name: "site_audit", description: "The real browser checks OUR site (contrast, alt text, dead links, overflow ...).", props: { dir: s("run_test/<project>"), url: s("or a URL"), name: s("label"), async: b("run in the background (returns a job id for wait)") } },
  { name: "proto_init", description: "Start a prototype project.", props: { dir: s("run_test/<project>"), title: s("name"), nav: s("e.g. 'Overview, Apps, Build>Logs'"), kind: s("app|site"), accent: s("#hex"), font: s("font"), "bg-dark": s("#hex"), extra: s("extra pages") }, required: ["dir", "title"] },
  { name: "proto_check", description: "NO-BUILD prototype check (files, scripts, components) in under a second.", props: { dir: s("prototype folder in run_test/") }, required: ["dir"] },
  { name: "bg_start", description: "Run ANY command in the background (a dev server, a back end ...).", props: { cmd: s("shell command"), dir: s("folder, default run_test"), title: s("kind, default server_run"), label: s("description"), port: s("auto|<n>"), wait: n("seconds"), timeout: n("minutes") }, required: ["cmd"] },
  { name: "bg_list", description: "Background tasks.", props: { all: b("include finished ones") } },
  { name: "bg_log", description: "Output of a background task.", props: { id: s("task id"), tail: n("lines") }, required: ["id"] },
  { name: "bg_stop", description: "End a background task.", props: { id: s("task id") }, required: ["id"] },
  { name: "get_public_url", description: "The address a person's browser can open for a port.", props: { port: n("port"), id: s("or a task id"), path: s("/x") } },
  { name: "team_tool", description: "Any OTHER shared team command (ref_capture, ref_compare, ref_assets, ref_store, browse, tab, browser_*, bg_restart, proc list, proc stop ...). Flags as an object; true = a bare flag.", props: { command: s("command name"), flags: { type: "object", description: "{flag: value}" } }, required: ["command"] },
];
/** The tools listed to the model: the few every lead uses. Every other command stays reachable through `team_tool` (its description carries the catalog), so the tool schemas stay small (each listed tool costs context on every turn). */
export const CORE = new Set(["wait", "fork_all", "plan_submit", "plan_run", "plan_status", "phase_pass", "apply_patches", "ledger_get", "ls", "read_file", "grep", "agents_list", "board_status", "chapter", "team_tool"]);
const catalog = () => TEAM_TOOLS.filter((t) => !CORE.has(t.name)).map((t) => `${t.name}{${Object.keys(t.props).join(",")}}`).join(" ");
export const listed = () => TEAM_TOOLS.filter((t) => CORE.has(t.name)).map((t) => t.name === "team_tool" ? { ...t, description: t.description + " Known commands and their flags: " + catalog() } : t);
// NOT offered on purpose: delegate (use Agent / SendMessage), _run / _plan internals.
const BLOCKED = new Set(["delegate", "_run", "_plan", "_job"]);

/** tool name + JSON arguments -> argv for harness/tools.ts */
export function toArgv(name: string, a: Record<string, unknown>): string[] | { error: string } {
  let cmd = name, flags = a;
  if (name === "team_tool") { cmd = String(a.command ?? ""); flags = (a.flags as Record<string, unknown>) ?? {}; if (!TEAM_TOOLS.some((t) => t.name === cmd) && !/^[a-z][a-z_]*$/.test(cmd)) return { error: `bad command "${cmd}"` }; }
  else if (!TEAM_TOOLS.some((t) => t.name === name && CORE.has(name))) return { error: `unknown tool ${name}` };
  if (!cmd || BLOCKED.has(cmd) || cmd.startsWith("_")) return { error: `"${cmd}" is not available here (call sub-agents with the Agent / SendMessage tools)` };
  const argv = [cmd];
  for (const [k, v] of Object.entries(flags)) {
    if (v === undefined || v === null || v === false) continue;
    if (v === true) argv.push("--" + k);
    else if (Array.isArray(v) && v.every((x) => typeof x === "string")) argv.push("--" + k, v.join(","));
    else if (typeof v === "object") argv.push("--" + k, JSON.stringify(v));
    else argv.push("--" + k, String(v));
  }
  return argv;
}

