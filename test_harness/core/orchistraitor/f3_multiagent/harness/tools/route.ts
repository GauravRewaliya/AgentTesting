// WHICH FILE RUNS WHICH COMMAND (pure data; index.ts routes with it and `team --help` lists it). A new command = one line here + its block in that group file.
export const ROUTE: Record<string, string> = {
  // agent_calling/calls.ts
  delegate: "agent_calling/calls", fork_all: "agent_calling/calls", _run: "agent_calling/calls", wait: "agent_calling/calls", apply_patches: "agent_calling/calls", agent_stop: "agent_calling/calls",
  // ref.ts
  site_build: "agent_calling/site_build", ref_capture: "ref", site_audit: "ref", ref_compare: "ref", proto_init: "ref", proto_check: "ref",
  // agent_calling/plans.ts
  plan_submit: "agent_calling/plans", plan_run: "agent_calling/plans", _plan: "agent_calling/plans", plan_replan: "agent_calling/plans", plan_answer: "agent_calling/plans", plan_pause: "agent_calling/plans", plan_resume: "agent_calling/plans", plan_show: "agent_calling/plans", plan_status: "agent_calling/plans", phase_status: "agent_calling/plans", phase_pass: "agent_calling/plans", plan_lint: "agent_calling/plans",
  // board.ts
  report_bug: "board", admin_issues: "board", agent_peek: "board", cost: "board", agents_list: "board", agent_info: "board", agent_update: "board", say: "board", inbox: "board", board_status: "board", ledger_get: "board", ls: "board", read_file: "board", chapter: "board", grep: "board",
  // browser.ts
  browser_status: "browser", browser_connect: "browser", browser_disconnect: "browser", browser_launch: "browser", browser_toggle: "browser", browse: "browser", tab: "browser",
  // bg.ts
  get_public_url: "bg", proc_list: "bg", proc_stop: "bg", bg_start: "bg", bg_use: "bg", bg_list: "bg", bg_log: "bg", bg_stop: "bg", bg_restart: "bg",
};

/** the name an agent should TYPE for a command (old split names stay as hidden aliases): browse -> `browser shot`, tab -> `browser tab`, bg_list -> `bg list`, ref_capture -> `ref capture` ... */
const AGENT_SHOWN: Record<string, string> = { delegate: "agent <name>", fork_all: "agent all", wait: "agent wait", agents_list: "agent list", agent_info: "agent info", agent_peek: "agent peek", agent_stop: "agent stop", agent_update: "agent update", apply_patches: "agent patches", report_bug: "bug", admin_issues: "bugs" };
const shown = (c: string): string => AGENT_SHOWN[c] ?? (c === "browse" ? "browser shot" : c === "tab" ? "browser tab" : c === "get_public_url" ? "bg url" : c.replace(/^(browser|bg|proto|ref|site|plan|phase|agent|proc)_/, "$1 "));
export const groupsListing = (): string => { const g: Record<string, string[]> = {}; for (const [c, f] of Object.entries(ROUTE)) if (!c.startsWith("_")) (g[f] ??= []).push(shown(c)); return Object.entries(g).map(([f, cs]) => `${f}.ts: ${cs.join(", ")}`).join("\n"); };
