// E2bRunner: the third Runner (next to RealRunner = local `claude -p`, ScriptRunner = offline).
// The loop, sessions, ledger and stages stay HERE; only "where claude runs" moves into an E2B sandbox.
// Reused from the original loopferry (read, never copied): claude-coding.ts constants (CLAUDE_ENV, SANDBOX_ENV, WORKSPACE, shellQuote, engineModel),
// the template name (E2B_TEMPLATE, default `loop-agent`) and the e2b SDK in loopferry's node_modules.
//
// Model: ONE sandbox per task (opened on first call, so a role's `--resume` finds its transcript in the same ~/.claude), the local repo is
// uploaded as a tar into /workspace, and after EVERY call the changed files are copied back to the local `cwd`, so the deterministic check
// (runChecks, local) and the git-based guards (deleted files) keep working unchanged.
//
//   bun harness/main.ts run --e2b --repo <dir> --request "..."        needs E2B_API_KEY and a Claude login: CLAUDE_CODE_OAUTH_TOKEN (or ANTHROPIC_API_KEY)
// Env: LOOPFERRY_DIR (default ~/projects/loopferry), E2B_API_KEY, E2B_TEMPLATE, E2B_ENV_FILE (default $LOOPFERRY_DIR/.env, read for E2B_* only).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { RunCall, RunResult, Runner } from "./types.ts";

export const LOOPFERRY_DIR = process.env.LOOPFERRY_DIR ?? join(homedir(), "projects", "loopferry");
const WS = "/workspace";

/** E2B_* from the process env, else from loopferry's own .env (only those keys; nothing is printed). */
function e2bEnv(): { key: string; template?: string } {
  const out: Record<string, string> = {};
  const f = process.env.E2B_ENV_FILE ?? join(LOOPFERRY_DIR, ".env");
  if (existsSync(f)) for (const l of readFileSync(f, "utf8").split("\n")) { const m = /^(E2B_API_KEY|E2B_TEMPLATE)=(.*)$/.exec(l.trim()); if (m && m[2]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); }
  const key = process.env.E2B_API_KEY || out.E2B_API_KEY || "";
  const template = process.env.E2B_TEMPLATE || out.E2B_TEMPLATE;
  return { key, ...(template ? { template } : {}) };
}

type Loopferry = { CLAUDE_ENV: Record<string, string>; shellQuote: (s: string) => string; engineModel: (m?: string | null) => string | undefined };
async function loopferry(): Promise<Loopferry> {
  const f = join(LOOPFERRY_DIR, "src/services/engine/providers/claude-coding.ts");
  if (!existsSync(f)) throw new Error(`loopferry not found at ${LOOPFERRY_DIR} (set LOOPFERRY_DIR)`);
  return (await import(f)) as Loopferry;   // pure module: no imports of its own, so it loads outside the Worker
}

/** The auth the CLI needs inside the sandbox. loopferry's CLAUDE_ENV blanks these (it logs in per team); a harness test passes them through. */
const AUTH_KEYS = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"] as const;

interface Sb { sandboxId: string; commands: { run(cmd: string, o?: Record<string, unknown>): Promise<{ exitCode: number; stdout: string; stderr: string }> };
  files: { write(p: string, c: string | ArrayBuffer, o?: Record<string, unknown>): Promise<unknown>; read(p: string, o?: Record<string, unknown>): Promise<unknown> }; kill(): Promise<unknown> }

export class E2bRunner implements Runner {
  calls: RunCall[] = [];
  private sandboxes = new Map<string, Sb>();   // one per local cwd (= per task)
  private pushed = new Set<string>();           // roles whose prompt file is already in the sandbox
  constructor(public timeoutMs = 600_000, public keep = process.env.E2B_KEEP === "1") {}

  private async sandbox(cwd: string): Promise<Sb> {
    const have = this.sandboxes.get(cwd); if (have) return have;
    const { key, template } = e2bEnv();
    if (!key) throw new Error("E2B_API_KEY is not set (env, or in loopferry's .env)");
    if (!AUTH_KEYS.some((k) => process.env[k])) throw new Error("no Claude login for the sandbox: set CLAUDE_CODE_OAUTH_TOKEN (claude setup-token) or ANTHROPIC_API_KEY");
    const { Sandbox } = (await import(join(LOOPFERRY_DIR, "node_modules/e2b/dist/index.mjs"))) as { Sandbox: { create(t: string, o: Record<string, unknown>): Promise<Sb> } };
    const sb = await Sandbox.create(template ?? "loop-agent", { apiKey: key, timeoutMs: this.timeoutMs + 120_000, metadata: { app: "loop", purpose: "f2_stages" } });
    await sb.commands.run(`mkdir -p ${WS}`, { user: "root" }).catch(() => undefined);
    await this.upload(sb, cwd);
    this.sandboxes.set(cwd, sb); return sb;
  }

  /** local repo -> /workspace (tar, .git included so the agents see a real repo). */
  private async upload(sb: Sb, cwd: string) {
    const tmp = mkdtempSync(join(tmpdir(), "f2-")), tar = join(tmp, "up.tar");
    execFileSync("tar", ["-cf", tar, "--exclude=node_modules", "--exclude=.harness_state*", "-C", cwd, "."]);
    const buf = readFileSync(tar); await sb.files.write(`/tmp/up.tar`, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    const r = await sb.commands.run(`tar -xf /tmp/up.tar -C ${WS} && chown -R user:user ${WS} 2>/dev/null; cd ${WS} && git config --global --add safe.directory ${WS}; true`, { user: "root" });
    rmSync(tmp, { recursive: true, force: true }); if (r.exitCode) throw new Error("upload failed: " + r.stderr.slice(0, 200));
  }

  /** sandbox /workspace -> local cwd: every file that differs (tar of the whole tree minus .git, extracted over the local repo; deletions are mirrored). */
  private async download(sb: Sb, cwd: string) {
    await sb.commands.run(`cd ${WS} && tar -cf /tmp/down.tar --exclude=.git --exclude=node_modules .`, { user: "user" });
    const bytes = (await sb.files.read("/tmp/down.tar", { format: "bytes" })) as Uint8Array;
    const tmp = mkdtempSync(join(tmpdir(), "f2-")), tar = join(tmp, "down.tar"), stage = join(tmp, "s"); writeFileSync(tar, bytes);
    execFileSync("mkdir", ["-p", stage]); execFileSync("tar", ["-xf", tar, "-C", stage]);
    const tracked = (d: string) => readdirSync(d).filter((n) => n !== ".git" && n !== "node_modules" && !n.startsWith(".harness_state"));
    for (const n of tracked(cwd)) if (!existsSync(join(stage, n))) rmSync(join(cwd, n), { recursive: true, force: true });   // the agent deleted it
    execFileSync("cp", ["-a", `${stage}/.`, cwd]); rmSync(tmp, { recursive: true, force: true });
  }

  async run(c: RunCall): Promise<RunResult> {
    this.calls.push(c);
    try {
      const L = await loopferry(), sb = await this.sandbox(c.cwd);
      const pf = `/home/user/.f2/${c.agent.name}.md`;
      if (!this.pushed.has(c.agent.name)) { await sb.files.write(pf, readFileSync(c.agent.prompt_file, "utf8"), { user: "user" }); this.pushed.add(c.agent.name); }
      await sb.files.write(`/home/user/.f2/prompt-${c.session.id}.txt`, c.prompt, { user: "user" });
      const model = L.engineModel(c.agent.model), q = L.shellQuote;
      const sess = c.session.fork_from ? `--resume ${q(c.session.fork_from)} --fork-session --session-id ${q(c.session.id)}` : `${c.session.resume ? "--resume" : "--session-id"} ${q(c.session.id)}`;
      const cmd = [`cd ${WS} &&`, `claude -p "$(cat /home/user/.f2/prompt-${c.session.id}.txt)"`, "--output-format json", model ? `--model ${q(model)}` : "",
        `--setting-sources "" --strict-mcp-config --append-system-prompt "$(cat ${pf})"`, `--tools ${q(c.agent.tools.join(","))}`, "--permission-mode dontAsk", sess,
        ...(c.extraArgs ?? []).map(q), `--allowedTools ${c.agent.allow.map(q).join(" ")}`].filter(Boolean).join(" ");
      const envs: Record<string, string> = { ...L.CLAUDE_ENV, ...(c.env ?? {}) };
      for (const k of AUTH_KEYS) if (process.env[k]) envs[k] = process.env[k]!;
      const r = await sb.commands.run(cmd, { user: "user", timeoutMs: this.timeoutMs, envs }).catch((e: { exitCode?: number; stdout?: string; stderr?: string }) => ({ exitCode: e.exitCode ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? String(e) }));
      if (c.agent.writes) await this.download(sb, c.cwd);   // read-only roles cannot have changed anything
      try {
        const j = JSON.parse(r.stdout) as { result?: string; session_id?: string; total_cost_usd?: number; is_error?: boolean; subtype?: string };
        return { reply: j.result ?? "", session_id: j.session_id ?? c.session.id, cost: j.total_cost_usd ?? 0, ok: r.exitCode === 0 && !j.is_error, error: j.is_error ? (j.subtype ?? "error") : undefined };
      } catch { return { reply: "", session_id: c.session.id, cost: 0, ok: false, error: `exit ${r.exitCode}: ${(r.stderr || r.stdout).slice(0, 300)}` }; }
    } catch (e) { return { reply: "", session_id: c.session.id, cost: 0, ok: false, error: String((e as Error).message ?? e) }; }
  }

  /** Kill every sandbox this runner opened (E2B_KEEP=1 keeps them for inspection). */
  async close() { if (this.keep) return; for (const sb of this.sandboxes.values()) await sb.kill().catch(() => undefined); this.sandboxes.clear(); }
  killAll() { void this.close(); }
}
