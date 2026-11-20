// THE LITE GUARD: one pure function that says allow or deny for one tool call of the LEAD. Not a sandbox: it stops the wrong moves
// (reading .env / keys, leaving the workspace, starting a sub-agent through a shell command when a hook does that).
// Pure, so it is free to test (self_test/approach_a2.ts). Called by the approach hooks (a2: approaches/a2_native_hook/hook.ts).
// The policy is data: the approach's spec (approach_port.ts) names it, the adapter passes it to the hook as env HARNESS_GUARD (JSON).
// NO Node imports on purpose: a mod (approaches/a3_native_mod) runs this file in an engine without Node, and the a2 hook runs the same copy.

export interface GuardPolicy {
  /** Names the lead may never read or print: a glob without "/" matches the file name anywhere, with "/" the whole path. */
  denyRead: string[];
  /** Read / Glob / Grep stay inside the workspace (and its sibling `store/`, where a run keeps QA evidence). */
  jailToWorkspace: boolean;
  /** The lead starts sub-agents with the Agent tool: `team agent <role>` / `team delegate` in Bash is refused with the way out. */
  denyDelegateCommand?: boolean;
  /** Safety rules for git, GitHub and Jira (Settings > Integrations > Safety rules). Absent = no rule checked. */
  rules?: Rules;
}
/** What an agent may NOT do with git / GitHub / Jira. Every switch is "forbid": true = blocked. */
export interface Rules { noForcePush: boolean; noDeleteBranch: boolean; noMerge: boolean; noPushProtected: boolean; protectedBranches: string[]; noPush: boolean; jiraReadOnly: boolean }
export const DEFAULT_RULES: Rules = { noForcePush: true, noDeleteBranch: true, noMerge: true, noPushProtected: true, protectedBranches: ["main", "master"], noPush: false, jiraReadOnly: true };
/** MCP tool names the rules watch (a hook matches a tool by its exact name). GitHub: the official server; Jira: the Atlassian server. Names are data: a tool not listed here is not checked. */
const GH_WRITE = ["merge_pull_request", "push_files", "create_or_update_file", "delete_file", "update_pull_request_branch"];
const JIRA_WRITE = ["createJiraIssue", "editJiraIssue", "transitionJiraIssue", "addCommentToJiraIssue", "addWorklogToJiraIssue", "createIssueLink", "createConfluencePage", "updateConfluencePage", "createConfluenceFooterComment", "createConfluenceInlineComment"];
/** The tools the guard hook is registered for: the file tools and Bash, plus the watched MCP tools when rules are on. */
/** The same tools by every name they can have: the token integrations (`mcp__github__`, `mcp__jira__`) and the Claude plugins (`mcp__plugin_<plugin>_<server>__`: the github plugin, the design plugin's atlassian). */
const GH_PREFIX = ["mcp__github__", "mcp__plugin_github_github__"], JIRA_PREFIX = ["mcp__jira__", "mcp__plugin_design_atlassian__", "mcp__plugin_atlassian_atlassian__"];
export const guardTools = (p: GuardPolicy): string[] => ["Read", "Glob", "Grep", "Bash", ...(p.rules ? [...GH_PREFIX.flatMap((x) => GH_WRITE.map((n) => x + n)), ...JIRA_PREFIX.flatMap((x) => JIRA_WRITE.map((n) => x + n))] : [])];
export const DEFAULT_GUARD: GuardPolicy = { denyRead: [".env", ".env.*", "*.pem", "id_rsa*", "id_ed25519*", ".npmrc", ".netrc", "credentials.json"], jailToWorkspace: true };

export interface ToolCall { tool_name: string; tool_input: Record<string, unknown> }
export type Verdict = { allow: true } | { allow: false; reason: string };

const SUBCOMMANDS = "wait|all|list|info|peek|stop|update|patches";
const norm = (p: string): string => { const out: string[] = []; for (const seg of p.split("/")) { if (!seg || seg === ".") continue; if (seg === "..") out.pop(); else out.push(seg); } return (p.startsWith("/") ? "/" : "") + out.join("/"); };
const globRe = (g: string) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*") + "$");
const TEMPLATE = /\.(example|sample|template|dist)$/i;   // `.env.example` holds no secret: reading it is fine
const isPrivate = (path: string, deny: string[]) => !TEMPLATE.test(path) && deny.some((g) => globRe(g).test(g.includes("/") ? path : path.split("/").pop() ?? path));

/** The path(s) a call touches (empty for tools that touch none). */
function pathsOf(c: ToolCall): string[] {
  const i = c.tool_input, s = (k: string) => (typeof i[k] === "string" ? [i[k] as string] : []);
  if (c.tool_name === "Read") return s("file_path");
  if (c.tool_name === "Glob") return [...s("path"), ...s("pattern")];
  if (c.tool_name === "Grep") return [...s("path"), ...s("glob")];
  return [];
}

/** git / gh rules on one shell command (split into its simple commands). Returns the refusal text or "". */
export function gitRuleDenial(cmd: string, r: Rules): string {
  const prot = (r.protectedBranches ?? []).map((b) => b.replace(/[.+^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
  for (const seg of cmd.split(/&&|\|\||;|\n|\|/)) {
    const c = seg.trim(); if (!/\b(git|gh)\b/.test(c)) continue;
    const push = /\bgit\b[^]*?\bpush\b/.test(c);
    if (push && r.noPush) return "pushing is switched off in Settings > Integrations > Safety rules.";
    if (push && r.noForcePush && (/(^|\s)(--force\S*|-f)(\s|$)/.test(c) || /\spush\b[^]*\s\+\S/.test(c))) return "force-push is not allowed (Safety rules). Push normally or ask the person.";
    if (r.noDeleteBranch && (/\bgit\b[^]*\bbranch\b[^]*\s(-d|-D|--delete)\b/.test(c) || (push && (/(^|\s)(--delete|-d)(\s|$)/.test(c) || /\spush\b[^]*\s:\S/.test(c))) || /\bgh\s+api\b[^]*-X\s*DELETE/i.test(c) || /\bgh\s+repo\s+delete\b/.test(c))) return "deleting a branch or repository is not allowed (Safety rules).";
    if (r.noMerge && (/\bgh\s+pr\s+merge\b/.test(c) || /\bgh\s+api\b[^]*\/merge\b/.test(c))) return "merging a pull request is not allowed (Safety rules). The person merges.";
    if (push && r.noPushProtected && prot.length && new RegExp(`(^|[\\s:/])(${prot.join("|")})(\\s|$)`).test(c.replace(/^[^]*?\bpush\b/, ""))) return `pushing to a protected branch (${r.protectedBranches.join(", ")}) is not allowed (Safety rules). Push a new branch and open a PR.`;
  }
  return "";
}
/** The same rules for the GitHub / Jira tools (`mcp__github__*`, `mcp__jira__*`). */
export function toolRuleDenial(tool: string, input: Record<string, unknown>, r: Rules): string {
  const at = (ps: string[]) => { const p = ps.find((x) => tool.startsWith(x)); return p ? tool.slice(p.length) : ""; };
  const gh = at(GH_PREFIX), jira = at(JIRA_PREFIX);
  if (jira && r.jiraReadOnly && JIRA_WRITE.includes(jira)) return "Jira is read-only (Safety rules): read tickets, change nothing.";
  if (!gh) return "";
  if (gh === "merge_pull_request" && r.noMerge) return "merging a pull request is not allowed (Safety rules). The person merges.";
  if (["push_files", "create_or_update_file", "delete_file"].includes(gh)) {
    if (r.noPush) return "pushing is switched off in Settings > Integrations > Safety rules.";
    const b = String(input.branch ?? "").replace(/^refs\/heads\//, "");
    if (r.noPushProtected && b && (r.protectedBranches ?? []).includes(b)) return `writing to a protected branch (${b}) is not allowed (Safety rules). Use a new branch and open a PR.`;
  }
  return "";
}

export function liteGuard(call: ToolCall, policy: GuardPolicy, ctx: { workspace: string }): Verdict {
  const deny = (reason: string): Verdict => ({ allow: false, reason: "GUARD: " + reason });
  const ws = norm(ctx.workspace), roots = [ws, norm(ws + "/../store")];
  for (const p of pathsOf(call)) {
    const abs = norm(p.startsWith("/") ? p : ws + "/" + p);
    if (isPrivate(abs, policy.denyRead)) return deny(`${p.split("/").pop()} is private (keys and secrets). Ask the person for what you need instead of reading it.`);
    const wild = abs.search(/[*?[{]/), base = wild < 0 ? abs : abs.slice(0, wild).replace(/\/[^/]*$/, "") || "/";   // a glob is judged by the folder before its first wildcard
    if (policy.jailToWorkspace && !roots.some((r) => base === r || base.startsWith(r + "/"))) return deny(`${p} is outside the workspace. Read files with \`team ls | read_file | grep\` inside run_test/.`);
  }
  if (policy.rules && call.tool_name.startsWith("mcp__")) { const d = toolRuleDenial(call.tool_name, call.tool_input, policy.rules); if (d) return deny(d); }
  if (call.tool_name === "Bash") {
    const cmd = String(call.tool_input.command ?? "");
    if (policy.rules) { const d = gitRuleDenial(cmd, policy.rules); if (d) return deny(d); }
    if (policy.denyDelegateCommand && new RegExp(`\\bteam\\s+(delegate\\b|agent\\s+(?!(${SUBCOMMANDS})\\b)[a-z])`).test(cmd)) return deny("start a sub-agent with the Agent tool (SendMessage continues one), not with a shell command. `team agent wait|list|peek|patches` stay available.");
    for (const word of cmd.split(/[\s"'=<>|;&()]+/)) { const name = word.split("/").pop() ?? ""; if (name && isPrivate(name, policy.denyRead)) return deny(`${name} is private (keys and secrets). Ask the person for what you need instead of reading it.`); }
  }
  return { allow: true };
}
