// Two runners behind one interface (the plan's backend P): the real `claude -p` (persistent sessions) and a scripted one for offline tests.
import { spawn } from "node:child_process";
import { setPriority } from "node:os";
import { acquireSlot, maxProcs } from "./slots.ts";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RunCall, RunResult, Runner } from "./types.ts";

/** Where the CLI keeps a session: ~/.claude/projects/<cwd with every non-alphanumeric char as "-">/<id>.jsonl */
/** Where the CLI keeps sessions: $HOME first (as the CLI does; os.homedir() would ignore a changed HOME), then the account home. */
export const projectsRoot = () => join(process.env.HOME || homedir(), ".claude", "projects");
export function projectDirFor(cwd: string) { return join(projectsRoot(), cwd.replace(/[^a-zA-Z0-9]/g, "-")); }
export function transcriptFor(cwd: string, id: string) { return join(projectDirFor(cwd), id + ".jsonl"); }
export const transcriptExistsIn = (cwd: string) => (id: string) => existsSync(transcriptFor(cwd, id));
/** What the CLI itself does on --resume: look for <id>.jsonl in EVERY project folder (the file stays in the folder where the session was created, however many times it is resumed from elsewhere; probed on 2.1.319). */
export function transcriptExistsAnywhere(id: string, root = projectsRoot()): boolean {
  try { return readdirSync(root).some((d) => existsSync(join(root, d, id + ".jsonl"))); } catch { return false; }
}

export class RealRunner implements Runner {
  calls: RunCall[] = []; private live = new Set<import("node:child_process").ChildProcess>();
  /** Stop every claude process this runner started (the fail-fast watchdog uses it). */
  killAll() { for (const p of this.live) p.kill("SIGKILL"); }
  constructor(public timeoutMs = 240_000) {}
  async run(c: RunCall): Promise<RunResult> {
    this.calls.push(c);
    // At most HARNESS_MAX_PROCS WORKERS at once. The project manager and the lead each have a slot of their own: they spend most of their turn waiting
    // for others, and a waiting parent must never take a worker's place (this cost a researcher 9 s in the first strict multi-agent run).
    const t0 = Date.now(), release = c.agent.role === "pm" ? await acquireSlot("pm", 1) : c.agent.role === "lead" ? await acquireSlot("lead", 1) : await acquireSlot("claude", maxProcs()), waited = Date.now() - t0;
    try { const r = await this.spawnOne(c); return { ...r, waited_ms: waited }; } finally { release(); }
  }
  private spawnOne(c: RunCall): Promise<RunResult> {
    const args = ["-p", c.prompt, "--output-format", "json", "--model", c.agent.model,
      "--setting-sources", "", "--strict-mcp-config", "--append-system-prompt-file", c.agent.prompt_file,
      "--tools", c.agent.tools.join(","), "--permission-mode", "dontAsk",
      ...(c.session.fork_from ? ["--resume", c.session.fork_from, "--fork-session", "--session-id", c.session.id]
        : [c.session.resume ? "--resume" : "--session-id", c.session.id]),
      ...(c.extraArgs ?? []),
      "--allowedTools", ...c.agent.allow];
    return new Promise((resolve) => {
      const p = spawn("claude", args, { cwd: c.cwd, stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1", ...(c.env ?? {}) } });
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
