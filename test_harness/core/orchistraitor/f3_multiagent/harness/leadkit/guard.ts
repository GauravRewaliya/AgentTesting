// THE LITE GUARD: one pure function that says allow or deny for one tool call of the LEAD. Not a sandbox: it stops the wrong moves
// (reading .env / keys, leaving the workspace, starting a sub-agent through a shell command when a hook does that).
// Pure, so it is free to test (self_test/approach_a2.ts). Called by the approach hooks (a2: approaches/a2_native_hook/hook.ts).
// The policy is data: the approach's spec (approach_port.ts) names it, the adapter passes it to the hook as env HARNESS_GUARD (JSON).
import { dirname, isAbsolute, join, resolve } from "node:path";

export interface GuardPolicy {
  /** Names the lead may never read or print: a glob without "/" matches the file name anywhere, with "/" the whole path. */
  denyRead: string[];
  /** Read / Glob / Grep stay inside the workspace (and its sibling `store/`, where a run keeps QA evidence). */
  jailToWorkspace: boolean;
  /** The lead starts sub-agents with the Agent tool: `team agent <role>` / `team delegate` in Bash is refused with the way out. */
  denyDelegateCommand?: boolean;
}
export const DEFAULT_GUARD: GuardPolicy = { denyRead: [".env", ".env.*", "*.pem", "id_rsa*", "id_ed25519*", ".npmrc", ".netrc", "credentials.json"], jailToWorkspace: true };

export interface ToolCall { tool_name: string; tool_input: Record<string, unknown> }
export type Verdict = { allow: true } | { allow: false; reason: string };

const SUBCOMMANDS = "wait|all|list|info|peek|stop|update|patches";
const globRe = (g: string) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*") + "$");
const isPrivate = (path: string, deny: string[]) => deny.some((g) => globRe(g).test(g.includes("/") ? path : path.split("/").pop() ?? path));

/** The path(s) a call touches (empty for tools that touch none). */
function pathsOf(c: ToolCall): string[] {
  const i = c.tool_input, s = (k: string) => (typeof i[k] === "string" ? [i[k] as string] : []);
  if (c.tool_name === "Read") return s("file_path");
  if (c.tool_name === "Glob") return [...s("path"), ...s("pattern")];
  if (c.tool_name === "Grep") return [...s("path"), ...s("glob")];
  return [];
}

export function liteGuard(call: ToolCall, policy: GuardPolicy, ctx: { workspace: string }): Verdict {
  const deny = (reason: string): Verdict => ({ allow: false, reason: "GUARD: " + reason });
  const ws = resolve(ctx.workspace), roots = [ws, join(dirname(ws), "store")];
  for (const p of pathsOf(call)) {
    const abs = isAbsolute(p) ? resolve(p) : resolve(ws, p);
    if (isPrivate(abs, policy.denyRead)) return deny(`${p.split("/").pop()} is private (keys and secrets). Ask the person for what you need instead of reading it.`);
    const wild = abs.search(/[*?[{]/), base = wild < 0 ? abs : abs.slice(0, wild).replace(/\/[^/]*$/, "") || "/";   // a glob is judged by the folder before its first wildcard
    if (policy.jailToWorkspace && !roots.some((r) => base === r || base.startsWith(r + "/"))) return deny(`${p} is outside the workspace. Read files with \`team ls | read_file | grep\` inside run_test/.`);
  }
  if (call.tool_name === "Bash") {
    const cmd = String(call.tool_input.command ?? "");
    if (policy.denyDelegateCommand && new RegExp(`\\bteam\\s+(delegate\\b|agent\\s+(?!(${SUBCOMMANDS})\\b)[a-z])`).test(cmd)) return deny("start a sub-agent with the Agent tool (SendMessage continues one), not with a shell command. `team agent wait|list|peek|patches` stay available.");
    for (const word of cmd.split(/[\s"'=<>|;&()]+/)) { const name = word.split("/").pop() ?? ""; if (name && isPrivate(name, policy.denyRead)) return deny(`${name} is private (keys and secrets). Ask the person for what you need instead of reading it.`); }
  }
  return { allow: true };
}
