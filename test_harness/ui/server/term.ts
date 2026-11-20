// A REAL terminal in the page (Settings > Integrations > Claude CLI): `claude` runs in a pseudo-terminal (Bun's `terminal` option) with the profile the agents use, so /mcp, /plugin, /login and
// `claude mcp login` work exactly as in a normal terminal. One WebSocket per terminal on /term (an interactive byte stream, not data that refreshes: the hub socket stays the one for live data).
// Safety: the API listens on 127.0.0.1 only and the upgrade is refused unless the browser's Origin and the Host are this machine (a web page from the internet cannot open a shell here).
import { resolve } from "node:path";
import { claudeEnv } from "@core/orchestrator.ts";

export interface TermData { term: true; cols: number; rows: number; kind: "claude" | "shell" }
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
/** May this request open a terminal? Host and Origin (when sent) must both be this machine. */
export function allowed(req: Request): boolean {
  const host = req.headers.get("host") ?? "", origin = req.headers.get("origin");
  if (!LOCAL.test(host)) return false;
  if (origin) { try { if (!LOCAL.test(new URL(origin).host)) return false; } catch { return false; } }
  return true;
}
type WS = { data: TermData; send(d: string | Uint8Array): void; close(): void };
type Proc = ReturnType<typeof Bun.spawn>;
const procs = new WeakMap<object, Proc>();
const CWD = resolve(import.meta.dir, "../../..");   // the repo root: where a person would open a terminal for this project
const COMPOSE = resolve(import.meta.dir, "../../infra/docker-compose.yml"), SHELL_IMAGE = "agent-testing-shell:1";
/** What a terminal runs. `claude`: the CLI on this machine (its profile = the agents' profile). `shell`: bash in the container declared in infra/shell (tools baked in, the home is a persisted volume); the image is built the first time, in the terminal, so you see it. */
const command = (kind: TermData["kind"]): string[] => kind === "shell"
  ? ["sh", "-c", `docker image inspect ${SHELL_IMAGE} >/dev/null 2>&1 || { echo "[shell] first start: building the shell image (a few minutes, once)"; docker compose -f ${COMPOSE} build shell || exit 1; }; exec docker compose -f ${COMPOSE} --profile shell run --rm shell`]
  : ["claude"];
export const websocket = {
  open(ws: WS) {
    const { cols, rows } = ws.data;
    try {
      const p = Bun.spawn(command(ws.data.kind), { cwd: CWD, env: { ...process.env, ...claudeEnv(), CLAUDE_PROFILE_DIR: claudeEnv().CLAUDE_CONFIG_DIR ?? "", TERM: "xterm-256color", COLORTERM: "truecolor" },
        terminal: { cols, rows, data(_t: unknown, d: Uint8Array) { try { ws.send(d); } catch { /* socket gone */ } } } } as never);
      procs.set(ws, p); void p.exited.then(() => { try { ws.send(`\r\n[the terminal ended, code ${p.exitCode}]\r\n`); ws.close(); } catch { /* closed */ } });
    } catch (e) { ws.send(`could not start the terminal: ${(e as Error).message}\r\n`); ws.close(); }
  },
  message(ws: WS, raw: string | Buffer) {
    const p = procs.get(ws) as (Proc & { terminal?: { write(s: string): void; resize(c: number, r: number): void } }) | undefined; if (!p?.terminal) return;
    try { const m = JSON.parse(String(raw)) as { t: "i" | "r"; d?: string; cols?: number; rows?: number };
      if (m.t === "i" && typeof m.d === "string") p.terminal.write(m.d);
      else if (m.t === "r" && m.cols && m.rows) p.terminal.resize(Math.min(500, m.cols), Math.min(200, m.rows)); } catch { /* ignore junk */ }
  },
  close(ws: WS) { const p = procs.get(ws); if (p) { try { p.kill(); } catch { /* done */ } procs.delete(ws); } },
};
