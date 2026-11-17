// DockerRunner: the SAME `claude -p` call as RealRunner, started inside a throwaway Docker container instead of on the host, so whatever the agent installs or builds (pnpm install, dev servers, browsers) cannot touch the host.
// Switch: HARNESS_SANDBOX=docker (read in harness/tools.ts for sub-agents). The orchestrator (the lead, tools.ts, the store) stays on the host.
//   - login: your `claude-personal` profile (CLAUDE_CONFIG_DIR, default ~/.claude) is mounted at /claude, so there is no new login, and the session transcripts land in the same place as for host runs.
//     KNOWN RISK: an agent with Bash can read that mounted profile (loopferry splits users to prevent this, see docs/SANDBOX.md). Do not use this runner with agents you do not trust.
//   - workspace: the agent's cwd is mounted READ-WRITE at the SAME absolute path (so session ids and transcript folders match); nothing else of the host is visible except the agent's prompt file (read-only).
//   - limits: 2 GB, 1 cpu, 512 pids, all capabilities dropped, no-new-privileges (compose service `sandbox` in test_harness/infra/docker-compose.yml), non-root (your uid), --rm. Network on (the CLI and the package registries need it).
//   - pnpm only (CLAUDE.md): the store is the docker volume agent-testing-pnpm-store. Claude Code is BUILT INTO the image (infra/claude/Dockerfile); nothing is installed at run time.
//   - an agent that needs the HOST's tools.ts (it delegates: agents[] not empty, or an allow entry for tools.ts), the lead and the pm run on the host exactly as before.
//   - a timeout or killAll() kills the container by name (stopping the docker client alone would leave it running).
import { spawn, spawnSync } from "node:child_process";
import { usesTeamTools } from "./agents.ts";
import { dirname, resolve } from "node:path";
import { LSP_PLUGIN_DIR, RealRunner, lspArgs, wantsLsp } from "./runner.ts";
import type { RunCall, RunResult } from "./types.ts";
import { cliErrorText } from "./parse.ts";

export const sandboxable = (c: RunCall) => c.agent.role !== "lead" && c.agent.role !== "pm" && !usesTeamTools(c.agent);   // an agent that uses the host's team tools runs on the host (see usesTeamTools)

export const COMPOSE_FILE = resolve(import.meta.dir, "../../../../../../infra/docker-compose.yml");   // test_harness/infra/docker-compose.yml: the ONE place that declares image, limits, security and volumes

/** The `docker compose run` argument list for one claude call (exported so it can be checked without starting anything). Image, 2 GB / 1 cpu, caps, claude profile and pnpm volume come from the compose service `sandbox`. */
export function dockerArgs(c: RunCall, name: string, claudeArgs: string[], uid = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`): string[] {
  const env = c.env ?? {};
  return ["compose", "-f", COMPOSE_FILE, "run", "--rm", "-T", "--name", name, "--user", uid, ...Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
    "-v", `${c.cwd}:${c.cwd}`, "-v", `${dirname(c.agent.prompt_file)}:${dirname(c.agent.prompt_file)}:ro`, ...(wantsLsp(c) ? ["-v", `${LSP_PLUGIN_DIR}:${LSP_PLUGIN_DIR}:ro`, "-e", "ENABLE_LSP_TOOL=1"] : []), "-w", c.cwd, "sandbox", "claude", ...claudeArgs];
}

export class DockerRunner extends RealRunner {
  private names = new Set<string>();
  override killAll() { for (const n of this.names) spawnSync("docker", ["kill", n], { timeout: 20_000 }); super.killAll(); }
  protected override spawnOne(c: RunCall): Promise<RunResult> {
    if (!sandboxable(c)) return super.spawnOne(c);   // lead / pm / delegating agents: host, as before
    const claudeArgs = ["-p", c.prompt, "--output-format", "json", "--model", c.agent.model, "--setting-sources", "", "--strict-mcp-config", "--append-system-prompt-file", c.agent.prompt_file,
      "--tools", c.agent.tools.join(","), "--permission-mode", "dontAsk",
      ...(c.stateless ? ["--no-session-persistence"] : c.session.fork_from ? ["--resume", c.session.fork_from, "--fork-session", "--session-id", c.session.id] : [c.session.resume ? "--resume" : "--session-id", c.session.id]),
      ...(c.extraArgs ?? []), ...lspArgs(c), "--allowedTools", ...c.agent.allow];
    const name = `claude-${c.agent.name}-${Date.now().toString(36)}`; this.names.add(name);
    return new Promise((resolve) => {
      const p = spawn("docker", dockerArgs(c, name, claudeArgs), { stdio: ["ignore", "pipe", "pipe"] });
      this.live.add(p);
      let out = "", err = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
      const timer = setTimeout(() => { spawnSync("docker", ["kill", name], { timeout: 20_000 }); p.kill("SIGKILL"); }, c.agent.timeout_s ? c.agent.timeout_s * 1000 : this.timeoutMs);
      p.on("close", (code) => {
        clearTimeout(timer); this.live.delete(p); this.names.delete(name);
        try {
          const j = JSON.parse(out) as { result?: string; session_id?: string; total_cost_usd?: number; is_error?: boolean; subtype?: string };
          resolve({ reply: j.result ?? "", session_id: j.session_id ?? c.session.id, cost: j.total_cost_usd ?? 0, ok: code === 0 && !j.is_error, error: j.is_error ? cliErrorText(j) : undefined });
        } catch { resolve({ reply: "", session_id: c.session.id, cost: 0, ok: false, error: `docker exit ${code}: ${(err || out).slice(0, 300)}` }); }
      });
    });
  }
}
