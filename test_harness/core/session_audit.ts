// SESSION AUDIT (free, no model call): reads a FINISHED real session (store.json events, the agents' tool-call logs, the QA media folder) and says PASS or FAIL with the REASON of every breach.
// Why: a real session of "a three.js page + a demo video" took 333 s: one builder for everything, QA stopped by a false alarm, two videos, three pictures of states the video showed, ffmpeg and sleep loops.
// None of that is a wrong answer, so no prompt case sees it; this audit measures it (time per agent, calls, media, sequential work) and fails it before it ships.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface Budget { total_s: number; qa_s: number; qa_calls: number; videos: number; pictures: number; builder_gap_s: number; builder_resumes: number; cost_usd: number; max_builders: number; builder_share: number }
/** Defaults: what the sakura page should cost after the fixes (one parallel build, one QA run, one video). Override per case. */
export const DEFAULT_BUDGET: Budget = { total_s: 300, qa_s: 150, qa_calls: 12, videos: 1, pictures: 2, builder_gap_s: 15, builder_resumes: 1, cost_usd: 0.70, max_builders: 3, builder_share: 0.5 };
export interface AuditOpts { /** "page": one page made of parts: builders in parallel (>= 2, started together), then QA; the video is QA's */ expect?: "page" | "plain"; budget?: Partial<Budget> }
export interface AgentRow { agent: string; starts: number; resumes: number; wall_s: number; calls: number; cost: number; bash: string[] }
export interface AuditResult { ok: boolean; /** good = nothing to say; ok = only notes; poor = at least one reason */ grade: "good" | "ok" | "poor"; reasons: string[]; notes: string[]; metrics: Record<string, number | string | boolean>; agents: AgentRow[] }

type Ev = { t: number; type?: string; kind?: string; agent_id?: string; data?: Record<string, unknown> };
const evType = (e: Ev) => e.type ?? e.kind ?? "";
const roleOf = (id: string) => id.replace(/#\d+$/, "");
const MEDIA_PIC = /\.(png|jpe?g|webp)$/i;

function walk(dir: string, depth = 0, out: string[] = []): string[] {
  try { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { if (depth < 4) walk(p, depth + 1, out); } else out.push(p); } } catch { /* no folder */ }
  return out;
}
/** every tool call of every agent log: { agent id, tool, command } (the logs are Claude stream-json lines) */
function toolCalls(storeDir: string): { agent: string; tool: string; cmd: string }[] {
  const out: { agent: string; tool: string; cmd: string }[] = [];
  for (const f of walk(join(storeDir, "logs"))) {
    const m = /([\w-]+)_(\d+)\.[\w-]+\.jsonl$/.exec(f); if (!m) continue;
    const agent = `${m[1]}#${m[2]}`;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      if (!line.includes('"tool_use"')) continue;
      try { const j = JSON.parse(line); if (j.type !== "assistant") continue; for (const b of j.message?.content ?? []) if (b.type === "tool_use") out.push({ agent, tool: b.name, cmd: String(b.input?.command ?? b.input?.file_path ?? "") }); } catch { /* partial line */ }
    }
  }
  return out;
}

export function auditSession(storeDir: string, o: AuditOpts = {}): AuditResult {
  const B = { ...DEFAULT_BUDGET, ...(o.budget ?? {}) }, reasons: string[] = [], notes: string[] = [];
  const sf = join(storeDir, "store.json"); if (!existsSync(sf)) return { ok: false, grade: "poor", reasons: [`no store.json in ${storeDir}`], notes, metrics: {}, agents: [] };
  const store = JSON.parse(readFileSync(sf, "utf8")) as { events: Ev[] }, evs = (store.events ?? []).filter((e) => typeof e.t === "number").sort((a, b) => a.t - b.t);
  const t0 = evs[0]?.t ?? 0, total_s = Math.round(((evs.at(-1)?.t ?? t0) - t0) / 1000), at = (e: Ev) => Math.round((e.t - t0) / 1000);
  const calls = toolCalls(storeDir);
  // ---- per agent: wall time (start -> done), starts / resumes, tool calls
  const ids = [...new Set(evs.filter((e) => e.agent_id && /^[\w-]+#\d+$/.test(e.agent_id)).map((e) => e.agent_id!))];
  const agents: AgentRow[] = ids.map((id) => {
    const mine = evs.filter((e) => e.agent_id === id), starts = mine.filter((e) => evType(e) === "agent.start"), dones = mine.filter((e) => evType(e) === "agent.done");
    let wall = 0; starts.forEach((s, i) => { const d = dones[i]; if (d) wall += d.t - s.t; });
    const my = calls.filter((c) => c.agent === id);
    const cost = dones.reduce((n, d) => n + Number((d.data as { cost?: number } | undefined)?.cost ?? 0), 0);
    return { agent: id, starts: starts.length, resumes: starts.filter((s) => s.data?.mode === "resumed").length, wall_s: Math.round(wall / 1000), calls: my.length, cost: Math.round(cost * 1000) / 1000, bash: my.filter((c) => c.tool === "Bash").map((c) => c.cmd) };
  });
  const by = (role: string) => agents.filter((a) => roleOf(a.agent) === role), builders = by("builder"), qa = by("qa-reviewer");
  const qa_s = qa.reduce((n, a) => n + a.wall_s, 0), qa_calls = qa.reduce((n, a) => n + a.calls, 0);
  // ---- media
  const media = walk(join(storeDir, "qa")), videosFiles = media.filter((f) => /\.(webm|mp4)$/.test(f)).length, pictures = media.filter((f) => MEDIA_PIC.test(f)).length;
  const videoOuts = new Set(calls.filter((c) => c.tool === "Bash" && /\btab\s+do\b/.test(c.cmd) && /--video\b/.test(c.cmd)).map((c) => /--out\s+(\S+)/.exec(c.cmd)?.[1] ?? "default")), videoRuns = videoOuts.size;   // two scripts into one --out folder are appended into ONE video
  const videos = Math.max(videosFiles, videoRuns);
  const cost_usd = Math.round(agents.reduce((n, a) => n + a.cost, 0) * 1000) / 1000;
  const metrics = { total_s, cost_usd, builders: builders.length, builder_resumes: builders.reduce((n, a) => n + a.resumes, 0), qa_runs: qa.reduce((n, a) => n + a.starts, 0), qa_s, qa_calls, video_files: videosFiles, video_runs: videoRuns, pictures, stops: evs.filter((e) => evType(e) === "agent.needs_parent").length, denied_calls: evs.filter((e) => evType(e) === "agent.call.denied").length };
  // ---- the checks (every one names its reason)
  if (total_s > B.total_s) reasons.push(`took ${total_s} s in total (budget ${B.total_s} s)`);
  if (cost_usd > B.cost_usd) reasons.push(`cost $${cost_usd} (budget $${B.cost_usd})`);
  if (qa.length && qa_s > B.qa_s) reasons.push(`QA needed ${qa_s} s (budget ${B.qa_s} s)`);
  if (qa.length && qa_calls > B.qa_calls) reasons.push(`QA made ${qa_calls} tool calls (budget ${B.qa_calls}): too deep, too many looks`);
  if (videos > B.videos) reasons.push(`${videos} videos recorded (${videoRuns} recording runs, ${videosFiles} files; budget ${B.videos}): duplicate video`);
  if (pictures > B.pictures) reasons.push(`${pictures} pictures (budget ${B.pictures}): extra screenshots of states the video already shows`);
  const waste = calls.filter((c) => c.tool === "Bash" && /\b(ffmpeg|ffprobe)\b|(^|[;&|]\s*)sleep\s+\d|\bfind\s+\/\s/.test(c.cmd));
  for (const [what, re] of [["ffmpeg (QA converts or probes the video itself)", /\b(ffmpeg|ffprobe)\b/], ["sleep (a wait loop, time passing)", /(^|[;&|]\s*)sleep\s+\d/], ["find / (a search over the whole disk)", /\bfind\s+\/\s/]] as [string, RegExp][]) {
    const hit = waste.filter((c) => re.test(c.cmd)); if (hit.length) reasons.push(`${hit.length}x ${what}, by ${[...new Set(hit.map((h) => h.agent))].join(", ")}`);
  }
  // a picture cannot show MOTION, the video does: a picture step named after motion (day-later "to prove rotation", rotating, gust, falling) is a wasted picture (found in a real QA run)
  const motion: string[] = [];
  for (const c of calls.filter((x) => x.tool === "Bash" && /\btab\s+do\b/.test(x.cmd))) {
    const raw = /--steps\s+'([\s\S]*?)'(?:\s|$)/.exec(c.cmd)?.[1];
    if (raw) try { for (const st of JSON.parse(raw) as { name?: string; shot?: unknown }[]) if (st.shot && /(later|again|motion|rotat|spin|fall|moving|animat|gust|wind|prove)/i.test(st.name ?? "")) motion.push(String(st.name)); } catch { /* not plain JSON */ }
  }
  if (motion.length) reasons.push(`${motion.length} picture(s) of motion (${motion.map((m) => `"${m}"`).join(", ")}): a picture cannot show motion, the video does`);
  const stops = evs.filter((e) => evType(e) === "agent.needs_parent"); if (stops.length) reasons.push(`${stops.length} agent stop(s) with NEEDS_PARENT (${stops.map((e) => `${e.agent_id} at ${at(e)} s`).join(", ")}): each costs a round trip`);
  const denied = evs.filter((e) => evType(e) === "agent.call.denied"); if (denied.length) notes.push(`${denied.length} call(s) denied by the harness (${denied.map((e) => String(e.data?.code ?? "?")).join(", ")})`);
  if ((metrics.builder_resumes as number) > B.builder_resumes * Math.max(1, builders.length)) reasons.push(`builders were resumed ${metrics.builder_resumes} times (budget ${B.builder_resumes} per builder): work done one step after another`);
  // a builder must not run a browser or record: that is QA's
  for (const b of builders) { const rec = b.bash.filter((c) => /\b(playwright|puppeteer|ffmpeg|record_demo)\b|\.webm|\.mp4/.test(c)); if (rec.length) reasons.push(`${b.agent} recorded or ran a browser (${rec.length} command(s)): the demo video and browser runs are QA's`); }
  if (o.expect === "page") {
    const grants = evs.filter((e) => evType(e) === "agent.call.granted" && roleOf(String(e.data?.callee ?? "")) === "builder" && e.data?.kind === "new");
    const distinct = new Set(grants.map((e) => String(e.data?.callee))).size;
    if (distinct > B.max_builders) reasons.push(`${distinct} builders for one page (budget ${B.max_builders}): over-split, every builder pays its own start and its own contract`);
    if (distinct >= 2) {
      const gap = Math.max(...grants.map(at)) - Math.min(...grants.map(at)); if (gap > B.builder_gap_s) reasons.push(`the ${distinct} builders did not start together (${gap} s apart, budget ${B.builder_gap_s} s)`);
      const walls = builders.map((x) => x.wall_s), sum = walls.reduce((n, x) => n + x, 0), big = Math.max(...walls);
      if (sum > 0 && big / sum > B.builder_share && distinct >= 3) reasons.push(`uneven split: the biggest builder took ${big} s of ${sum} s (${Math.round((big / sum) * 100)}%, budget ${Math.round(B.builder_share * 100)}%): the others waited, the split bought nothing`);
    }
    if (!qa.length) reasons.push("QA never ran after the build");
    else { const lastBuilderDone = Math.max(0, ...evs.filter((e) => evType(e) === "agent.done" && roleOf(e.agent_id ?? "") === "builder").map(at)), firstQa = Math.min(...evs.filter((e) => evType(e) === "agent.start" && roleOf(e.agent_id ?? "") === "qa-reviewer").map(at)); if (firstQa < lastBuilderDone - 1) notes.push(`QA started at ${firstQa} s while a builder was still running until ${lastBuilderDone} s`); }
  }
  return { ok: reasons.length === 0, grade: reasons.length ? "poor" : notes.length ? "ok" : "good", reasons, notes, metrics, agents };
}

export function renderAudit(task: string, r: AuditResult): string {
  const L = [`${r.grade === "poor" ? "POOR" : r.grade === "ok" ? "OK  " : "GOOD"}  session ${task}`, ...r.reasons.map((x) => `  ✗ ${x}`), ...r.notes.map((x) => `  · ${x}`),
    `  metrics: ${Object.entries(r.metrics).map(([k, v]) => `${k}=${v}`).join("  ")}`, "  agents:"];
  for (const a of r.agents) L.push(`    ${a.agent.padEnd(15)} wall ${String(a.wall_s).padStart(4)} s  $${a.cost.toFixed(3)}  starts ${a.starts} (resumed ${a.resumes})  tool calls ${a.calls}`);
  return L.join("\n");
}
export const sessionStoreDir = (stateRoot: string, task: string) => { const d = join(stateRoot, task, "store"); return existsSync(d) && statSync(d).isDirectory() ? d : join(stateRoot, task); };
