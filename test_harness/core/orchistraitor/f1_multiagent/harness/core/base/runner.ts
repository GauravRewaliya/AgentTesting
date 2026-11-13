// Two runners behind one interface (the plan's backend P): the real `claude -p` (persistent sessions) and a scripted one for offline tests.
import { spawn } from "node:child_process";
import { setPriority } from "node:os";
import { acquireSlot, maxProcs } from "./slots.ts";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunCall, RunResult, Runner } from "./types.ts";

/** Where the CLI keeps sessions. The CLI follows CLAUDE_CONFIG_DIR (e.g. ~/.claude-personal), else ~/.claude. A run started from a shell with that variable and a run started by the UI server without it use DIFFERENT profiles,
 *  so a session made by one cannot be resumed by the other ("No conversation found"). `claudeDirs()` lists every profile that may hold sessions; `profileOfSession(id)` finds the one that holds a given session, and a resume is run IN that profile. */
const homeDir = () => process.env.HOME || homedir();
export const claudeDirs = (): string[] => [...new Set([process.env.CLAUDE_CONFIG_DIR, join(homeDir(), ".claude"), join(homeDir(), ".claude-personal")].filter((x): x is string => !!x))];
export const projectsRoot = () => join(process.env.CLAUDE_CONFIG_DIR || join(homeDir(), ".claude"), "projects");   // where NEW sessions of this process go
export function profileOfSession(id: string): string | undefined {
  for (const dir of claudeDirs()) { const root = join(dir, "projects"); try { if (readdirSync(root).some((d) => existsSync(join(root, d, id + ".jsonl")))) return dir; } catch { /* no projects folder in this profile */ } }
  return undefined;
}
export function projectDirFor(cwd: string) { return join(projectsRoot(), cwd.replace(/[^a-zA-Z0-9]/g, "-")); }
export function transcriptFor(cwd: string, id: string) { return join(projectDirFor(cwd), id + ".jsonl"); }
export const transcriptExistsIn = (cwd: string) => (id: string) => existsSync(transcriptFor(cwd, id));
/** What the CLI itself does on --resume: look for <id>.jsonl in EVERY project folder (the file stays in the folder where the session was created, however many times it is resumed from elsewhere; probed on 2.1.319). */
export function transcriptExistsAnywhere(id: string, root?: string): boolean {
  if (!root) return !!profileOfSession(id);   // any profile
  try { return readdirSync(root).some((d) => existsSync(join(root, d, id + ".jsonl"))); } catch { return false; }
}

/** The LSP tool only exists through a plugin that declares a language server (it is NOT in headless `claude -p` otherwise; tested 2026-11-13).
 *  An agent whose tools include `LSP` gets our plugin (harness/plugins/ts-lsp) and ENABLE_LSP_TOOL=1. Needs `typescript-language-server` + typescript 5.x on PATH (the sandbox image has them). */
export const LSP_PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "plugins", "ts-lsp");
export const wantsLsp = (c: RunCall) => c.agent.tools.includes("LSP");
export const lspArgs = (c: RunCall): string[] => wantsLsp(c) ? ["--plugin-dir", LSP_PLUGIN_DIR] : [];
export const lspEnv = (c: RunCall): Record<string, string> => wantsLsp(c) ? { ENABLE_LSP_TOOL: "1" } : {};

export class RealRunner implements Runner {
  calls: RunCall[] = []; protected live = new Set<import("node:child_process").ChildProcess>();
  /** Stop every claude process this runner started (the fail-fast watchdog uses it). */
  killAll() { for (const p of this.live) p.kill("SIGKILL"); }
  constructor(public timeoutMs = 240_000) {}
  async run(c: RunCall): Promise<RunResult> {
    this.calls.push(c);
    // At most HARNESS_MAX_PROCS WORKERS at once. The project manager and the lead each have a slot of their own: they spend most of their turn waiting
    // for others, and a waiting parent must never take a worker's place (this cost a researcher 9 s in the first strict multi-agent run).
    const t0 = Date.now(), release = c.agent.role === "pm" ? await acquireSlot("pm", 1) : c.agent.role === "lead" ? await acquireSlot("lead", Math.max(1, Number(process.env.HARNESS_MAX_LEADS ?? 1)))   /* HARNESS_MAX_LEADS: how many leads may run at once machine-wide (default 1; testrun/par.ts raises it) */ : await acquireSlot("claude", maxProcs()), waited = Date.now() - t0;
    try { const r = await this.spawnOne(c); return { ...r, waited_ms: waited }; } finally { release(); }
  }
  protected spawnOne(c: RunCall): Promise<RunResult> {   // protected: DockerRunner (docker_runner.ts) starts the same claude call inside a container
    const args = ["-p", c.prompt, "--output-format", "json", "--model", c.agent.model,
      "--setting-sources", "", "--strict-mcp-config", "--append-system-prompt-file", c.agent.prompt_file,
      "--tools", c.agent.tools.join(","), "--permission-mode", "dontAsk",
      ...(c.stateless ? ["--no-session-persistence"]
        : c.session.fork_from ? ["--resume", c.session.fork_from, "--fork-session", "--session-id", c.session.id]
        : [c.session.resume ? "--resume" : "--session-id", c.session.id]),
      ...(c.extraArgs ?? []), ...lspArgs(c),
      "--allowedTools", ...c.agent.allow];
    return new Promise((resolve) => {
      const resumeId = c.stateless ? undefined : c.session.fork_from ?? (c.session.resume ? c.session.id : undefined), profile = resumeId ? profileOfSession(resumeId) : undefined;   // continue a session IN the profile that holds it
      const p = spawn("claude", args, { cwd: c.cwd, stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1", ...(profile ? { CLAUDE_CONFIG_DIR: profile } : {}), ...lspEnv(c), ...(c.env ?? {}) } });
      this.live.add(p); try { setPriority(p.pid!, 10); } catch { /* low priority is best effort */ }
      let out = "", err = "";
      p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
      const timer = setTimeout(() => p.kill("SIGKILL"), this.timeoutMs);
      p.on("close", (code) => {
        clearTimeout(timer); this.live.delete(p);
        try {
          const j = JSON.parse(out) as { result?: string; session_id?: string; total_cost_usd?: number; is_error?: boolean; subtype?: string };
          resolve({ reply: j.result ?? "", session_id: j.session_id ?? c.session.id, cost: j.total_cost_usd ?? 0,
            ok: code === 0 && !j.is_error, error: j.is_error ? (j.subtype ?? "error") : undefined });
        } catch {
          resolve({ reply: "", session_id: c.session.id, cost: 0, ok: false, error: `exit ${code}: ${(err || out).slice(0, 300)}` });
        }
      });
    });
  }
}

/** Real agents for most roles, a scripted reply for chosen roles. Used to replay a known-bad reviewer against real planner/builder. */
export class MixedRunner implements Runner {
  calls: RunCall[] = []; private n = 0;
  constructor(public real: Runner, public scripted: Record<string, (c: RunCall, n: number) => string>) {}
  async run(c: RunCall): Promise<RunResult> {
    this.calls.push(c);
    const s = this.scripted[c.agent.role];
    if (s) return { reply: s(c, ++this.n), session_id: c.session.id, cost: 0, ok: true };
    return this.real.run(c);
  }
}

/** Offline runner: the script answers each call (and may write files, like a builder would). It still gets the real session choice. */
export class ScriptRunner implements Runner {
  calls: RunCall[] = [];
  constructor(public script: (c: RunCall, n: number) => string | Promise<string>, public cost = 0.001) {}
  async run(c: RunCall): Promise<RunResult> {
    this.calls.push(c);
    try { return { reply: await this.script(c, this.calls.length), session_id: c.session.id, cost: this.cost, ok: true }; }
    catch (e) { return { reply: "", session_id: c.session.id, cost: 0, ok: false, error: String(e) }; }
  }
}
