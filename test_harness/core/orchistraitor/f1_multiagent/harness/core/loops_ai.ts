// `.loopsAI/` = the PROJECT's own memory, written by the HARNESS (free, no model call) inside the project folder. It belongs to the project, not to a task or a session.
//   qa.json      the source of truth: every QA review and every builder's "VERIFIED" note, appended by every task and session (capped at 200)
//   README.md    what it is, how to run it, how to check it, the phases, the latest QA verdict         (rendered from qa.json; never edited by hand)
//   QA.md        the QA history: latest verdict, what QA asked to change, every review and builder note (rendered from qa.json)
//   config.json  the person's switches: `qa_check: false` = no video for this project; `qa_skip: ["docs/**", ...]` = parts QA does not test (the QA agent still tests what changed)
// QA itself is ONE agent (`qa-reviewer`): its answer starts with PASS / FAIL / PARTIAL and the harness records it here. There is no QA command, no QA loop state and no cache: the memory only says what
// was verified, by whom, against which code (`stamp`), so the next agent starts with the context instead of blind.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Verdict = "PASS" | "FAIL" | "PARTIAL";
export interface QaRow { t: number; kind: "review" | "builder"; by?: string; task?: string; verdict?: Verdict; stamp?: string; note?: string; /** what the QA agent said it CHECKED (with its evidence files) and what it did NOT check: the next QA call starts from this */ checked?: string; left?: string }
export interface LoopsInfo { dir: string; phases?: { phase: number; state: string }[]; planTitle?: string; planBlurb?: string; pnpmVersion?: string }
const iso = (t: number) => new Date(t).toISOString().replace("T", " ").slice(0, 16) + "Z";
const clip = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);
const MAX_ROWS = 200;

export const loopsDir = (projectAbs: string) => join(projectAbs, ".loopsAI");
const rowsFile = (projectAbs: string) => join(loopsDir(projectAbs), "qa.json");
export const configFile = (projectAbs: string) => join(loopsDir(projectAbs), "config.json");

const readAll = (projectAbs: string): { rows: QaRow[]; meta: Partial<LoopsInfo> } => {
  try { const j = JSON.parse(readFileSync(rowsFile(projectAbs), "utf8")) as { rows?: QaRow[]; meta?: Partial<LoopsInfo> }; return { rows: Array.isArray(j.rows) ? j.rows : [], meta: j.meta ?? {} }; } catch { return { rows: [], meta: {} }; }
};
const saveAll = (projectAbs: string, all: { rows: QaRow[]; meta: Partial<LoopsInfo> }) => {
  mkdirSync(loopsDir(projectAbs), { recursive: true });
  const tmp = rowsFile(projectAbs) + "." + process.pid + ".tmp"; writeFileSync(tmp, JSON.stringify(all, null, 1) + "\n"); renameSync(tmp, rowsFile(projectAbs));   // atomic: two agents on one project must not corrupt it
};
export const readRows = (projectAbs: string): QaRow[] => readAll(projectAbs).rows;
/** Append one row. Returns all rows. Never throws: the memory is a convenience, it must not break a call. */
export function appendRow(projectAbs: string, row: Omit<QaRow, "t"> & { t?: number }): QaRow[] {
  try { const all = readAll(projectAbs); all.rows = [...all.rows, { ...row, t: row.t ?? Date.now(), note: row.note?.slice(0, 2500) }].slice(-MAX_ROWS); saveAll(projectAbs, all); return all.rows; } catch { return []; }
}

/** The identity of the project's CODE: a hash of every source file's path and content (without node_modules, builds, git, QA output and this memory). Same hash = the same code. */
export function projectStamp(projectAbs: string): string {
  const h = createHash("sha1"); let n = 0;
  const walk = (d: string, rel: string, depth: number) => {
    if (depth > 8) return;
    let names: string[] = []; try { names = readdirSync(d).sort(); } catch { return; }
    for (const name of names) {
      if (["node_modules", "dist", ".git", ".loopsAI", ".vite", ".expo", "_shots", "_qa"].includes(name)) continue;
      const p = join(d, name); let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p, rel + name + "/", depth + 1);
      else { n++; h.update(rel + name + "\0" + st.size + "\0"); if (st.size <= 2_000_000) { try { h.update(readFileSync(p)); } catch { /* unreadable: size only */ } } }
    }
  };
  walk(projectAbs, "", 0);
  return `${n}:${h.digest("hex").slice(0, 16)}`;
}

/** The person's evidence switches (.loopsAI/config.json): `qa_video` (default true; the old `qa_check: false` also turns it off) and `qa_images` (default FALSE: no pictures are saved, the QA agent judges from the page snapshot, the video is the evidence). */
export interface LoopsConfig { qa_check: boolean; qa_images: boolean; /** parts QA must not test (paths or globs, words): shown to the QA agent */ qa_skip: string[] }
export function readConfig(projectAbs: string): LoopsConfig {
  try { const j = JSON.parse(readFileSync(configFile(projectAbs), "utf8")) as { qa_check?: unknown; qa_video?: unknown; qa_images?: unknown; qa_skip?: unknown }; return { qa_check: j.qa_check !== false && j.qa_video !== false, qa_images: j.qa_images === true, qa_skip: Array.isArray(j.qa_skip) ? j.qa_skip.map(String).slice(0, 20) : [] }; } catch { return { qa_check: true, qa_images: false, qa_skip: [] }; }
}
/** Pictures are OFF unless the person switched them on for a project in run_test/ (or HARNESS_QA_IMAGES=1). */
export function imagesOn(runTest: string): boolean {
  if (process.env.HARNESS_QA_IMAGES === "1") return true;
  try { return readdirSync(runTest).some((d) => existsSync(configFile(join(runTest, d))) && readConfig(join(runTest, d)).qa_images); } catch { return false; }
}

/** PASS / FAIL / PARTIAL from the first non-empty line of a QA answer (markdown bold and quotes ignored); undefined when it did not say. */
export const verdictOf = (reply: string): Verdict | undefined => { const first = reply.split("\n").map((l) => l.replace(/[*_`>#\s]+/g, " ").trim()).find(Boolean) ?? ""; const m = /^(PASS|FAIL|PARTIAL)\b/i.exec(first); return m ? (m[1]!.toUpperCase() as Verdict) : undefined; };
/** The `QUALITY:` line of a QA answer: grade (good|decent|poor) and the score text after it, e.g. `decent (4/6: ...)`. */
export const qualityOf = (reply: string): { grade: "good" | "decent" | "poor"; line: string } | undefined => { const m = /(?:^|\n)[ \t>*_`#-]*QUALITY\b[*_`]*:?[*_`]*\s*([^\n]*)/i.exec(reply); const g = m && /\b(good|decent|poor)\b/i.exec(m[1]!); return m && g ? { grade: g[1]!.toLowerCase() as "good" | "decent" | "poor", line: m[1]!.trim() } : undefined; };
/** Mechanical rule: a build graded `QUALITY: poor` cannot be `PASS`. The first line is rewritten to PARTIAL and says why, so the lead and the recorded verdict agree; a PASS on an asked-for quality check with NO `QUALITY:` line at all is left alone (the case decides whether the line is required). */
export function capVerdict(reply: string): { reply: string; capped: boolean } {
  const v = verdictOf(reply), q = qualityOf(reply);
  if (v !== "PASS" || q?.grade !== "poor") return { reply, capped: false };
  const lines = reply.split("\n"), i = lines.findIndex((l) => l.trim());
  lines[i] = lines[i]!.replace(/PASS/i, "PARTIAL") + "  (harness: PASS lowered to PARTIAL because QUALITY is poor)";
  return { reply: lines.join("\n"), capped: true };
}
/** What the QA agent asked to be changed: the text after `NEEDS_CHANGES:` in its answer. */
export const needsChangesOf = (reply: string): string => /NEEDS_CHANGES:?\**\s*([\s\S]*)$/i.exec(reply)?.[1]?.trim() ?? "";
/** The part of a QA answer under `CHECKED:` (what it covered, with its evidence files) and under `NOT CHECKED:` (what is left or skipped, and why). */
const block = (reply: string, head: RegExp) => { const m = head.exec(reply); if (!m) return ""; const rest = reply.slice(m.index + m[0].length), end = rest.search(/\n\s*\**(?:NOT CHECKED|CHECKED|NEEDS_CHANGES)\b/i); return (end >= 0 ? rest.slice(0, end) : rest).trim(); };
export const checkedOf = (reply: string): string => block(reply, /(?:^|\n)\s*\**(?<!NOT )CHECKED:?\**:?/i);
export const leftOf = (reply: string): string => block(reply, /(?:^|\n)\s*\**NOT CHECKED:?\**:?/i);
/** The plan's own acceptance checks for the phase being built (the first phase not passed yet): the bullets under "Done when" / "Acceptance" of that phase in run_test/plan/PHASES.md. These are the TODO of QA, from a file. */
export function planChecks(runTest: string, phases?: { phase: number; state: string }[]): { phase: number; items: string[] } | undefined {
  try {
    const md = readFileSync(join(runTest, "plan", "PHASES.md"), "utf8"), open = (phases ?? []).find((p) => p.state !== "passed")?.phase ?? 1;
    const sec = new RegExp(`(?:^|\\n)##\\s+Phase ${open}\\b[\\s\\S]*?(?=\\n##\\s+Phase |\\n---\\s*\\n<a id|$)`, "i").exec(md)?.[0]; if (!sec) return undefined;
    const items = [...sec.matchAll(/(?:\*\*|#+\s*)?(?:Done when|Acceptance)[^\n]*\n((?:[ \t]*[-*] [^\n]+\n?)+)/gi)].flatMap((m) => m[1]!.split("\n").map((l) => l.replace(/^\s*[-*]\s+/, "").trim()).filter(Boolean));
    return items.length ? { phase: open, items: [...new Set(items.map((x) => clip(x, 160)))].slice(0, 12) } : undefined;
  } catch { return undefined; }
}
const lastReview = (rows: QaRow[]) => [...rows].reverse().find((r) => r.kind === "review" && r.verdict);

export function planBlurb(runTest: string): { title?: string; blurb?: string } {
  try {
    const t = readFileSync(join(runTest, "plan", "README.md"), "utf8").replace(/^---[\s\S]*?\n---\n/, "");
    return { title: /^#\s+(.+)$/m.exec(t)?.[1]?.replace(/\s*·.*$/, "").trim(), blurb: /^>\s+(.+)$/m.exec(t)?.[1]?.trim() };
  } catch { return {}; }
}

export function renderQa(rows: QaRow[], currentStamp?: string, todo?: { phase: number; items: string[] }, skip: string[] = []): string {
  const last = lastReview(rows), stale = !!last && !!currentStamp && last.stamp !== currentStamp;
  const out = ["# QA log (generated by the harness from qa.json; do not edit)", "",
    last ? `Latest QA review: **${last.verdict}** (${iso(last.t)}, by ${last.by ?? "the QA agent"})${stale ? " · the code has CHANGED since" : ""}` : "No QA review yet.", ""];
  const need = last && last.verdict !== "PASS" ? needsChangesOf(last.note ?? "") : "";
  if (need) out.push("## QA asked for these changes", "", need.slice(0, 1200), "");
  if (last?.left) out.push("## Still to check (QA said it did NOT check these)", "", last.left.slice(0, 1200), "");
  else if (todo) out.push(`## To check: the plan's own checks for phase ${todo.phase}`, "", todo.items.map((x) => "- " + x).join("\n"), "");
  const covered = rows.filter((r) => r.kind === "review" && r.checked).slice(-3).reverse();
  if (covered.length) out.push("## Covered by QA so far", "", ...covered.map((r) => `- ${iso(r.t)}: ${clip(r.checked ?? "", 400)}`), "");
  if (skip.length) out.push("## QA skips (config.json qa_skip)", "", skip.map((x) => "- " + x).join("\n"), "");
  out.push("## History (newest first)");
  if (!rows.length) out.push("", "Nothing yet.");
  for (const h of [...rows].reverse().slice(0, 40)) {
    if (h.kind === "builder") out.push("", `### ${iso(h.t)} · BUILDER ${h.by ?? ""} says it verified`, clip(h.note ?? "", 600));
    else out.push("", `### ${iso(h.t)} · QA REVIEW by ${h.by ?? "the QA agent"}${h.verdict ? " · " + h.verdict : ""}`, clip(h.note ?? "", 900));
  }
  return out.join("\n") + "\n";
}

export function renderReadme(pj: { name?: string; scripts?: Record<string, string> } | undefined, rows: QaRow[], info: LoopsInfo, currentStamp?: string): string {
  const sc = pj?.scripts ?? {}, last = lastReview(rows), pnpm = info.pnpmVersion ?? "10.28.0", stale = !!last && !!currentStamp && last.stamp !== currentStamp;
  const lines = [`# ${info.planTitle ?? pj?.name ?? "project"} · project context`, "", `Generated by the harness (${iso(Date.now())}); refreshed after every QA review, builder note and phase gate. Do not edit: fix the project, not this file.`, "",
    "## What it is", "", info.planBlurb ?? "See `run_test/plan/README.md`.", "",
    "## How to run", "", `1. \`cd run_test/${info.dir}\``, `2. \`pnpm install\` (pnpm only, version ${pnpm})`,
    sc.dev ? `3. \`pnpm run dev\` → \`${sc.dev}\`` : sc.start ? `3. \`pnpm run start\` → \`${sc.start}\`` : "3. see package.json for the start command",
    sc.build ? `4. build: \`pnpm run build\` → \`${sc.build}\`` : "4. no build script",
    "Start it as a background task (`bg_start --cmd ... --port auto`) when something has to look at it; open it with `browse`.", "",
    "## How to check it", "", `- type check: \`${sc.lint ?? "pnpm exec tsc --noEmit"}\``, "- what \"done\" means for each phase: `run_test/plan/PHASES.md` (Done when)",
    "- verification is the QA agent's job (the master delegates; one QA agent per task); it records its verdict in `.loopsAI/QA.md`", ""];
  if (info.phases?.length) lines.push("## Phases", "", info.phases.map((p) => `- phase ${p.phase}: ${p.state}`).join("\n"), "");
  lines.push("## QA now", "", last ? `Latest QA review ${iso(last.t)}: **${last.verdict}**${stale ? ", but the code changed since" : ""}.` : "No QA review yet.", "", "Full log: `.loopsAI/QA.md`.", "");
  return lines.join("\n");
}

/** Render README.md + QA.md from qa.json (and create config.json once). Returns the folder. Never throws. */
export function writeMemory(projectAbs: string, given: Partial<LoopsInfo>): string | undefined {
  try {
    const all = readAll(projectAbs), d = loopsDir(projectAbs); mkdirSync(d, { recursive: true });
    const info = { dir: given.dir ?? all.meta.dir ?? "app", ...all.meta, ...Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined)) } as LoopsInfo;   // what we know now wins; what an earlier call knew is kept
    all.meta = info; saveAll(projectAbs, all);
    let pj: { name?: string; scripts?: Record<string, string> } | undefined; try { pj = JSON.parse(readFileSync(join(projectAbs, "package.json"), "utf8")); } catch { /* none */ }
    if (!existsSync(configFile(projectAbs))) writeFileSync(configFile(projectAbs), JSON.stringify({ qa_video: true, qa_images: false, qa_skip: [], _note: "qa_video: the QA agent records one video of its flows. qa_images: also save a picture per step (off by default: pictures cost time and tokens). qa_skip: parts QA must not test." }, null, 2) + "\n");
    const stamp = projectStamp(projectAbs);
    writeFileSync(join(d, "QA.md"), renderQa(all.rows, stamp, planChecks(join(projectAbs, ".."), info.phases), readConfig(projectAbs).qa_skip)); writeFileSync(join(d, "README.md"), renderReadme(pj, all.rows, info, stamp));
    return d;
  } catch { return undefined; }
}
/** The projects of a run_test/ that have a `.loopsAI` folder (a memory, or only the config the person wrote). */
export const memoryProjects = (runTest: string): string[] => { try { return readdirSync(runTest).filter((d) => existsSync(loopsDir(join(runTest, d)))); } catch { return []; } };
/** The person's "no video" switch: the first project in run_test/ whose .loopsAI/config.json says qa_check false (it counts even when that is the only file there). Used by `browse --video` AND the test runner's `--video`. */
export function videoOffReason(runTest: string): string | undefined {
  try { for (const d of readdirSync(runTest)) { const p = join(runTest, d); if (existsSync(configFile(p)) && !readConfig(p).qa_check) return `video is OFF for run_test/${d} (.loopsAI/config.json: qa_check false)`; } } catch { /* no run_test yet */ }
  return undefined;
}
/** The projects a QA review or a builder note belongs to: the ones with a memory, else every app folder (package.json or index.html), never plan/ or _tool folders. */
export const projectDirs = (runTest: string): string[] => {
  const withMemory = memoryProjects(runTest); if (withMemory.length) return withMemory;
  try { return readdirSync(runTest).filter((d) => d !== "plan" && !d.startsWith("_") && !d.startsWith(".") && (existsSync(join(runTest, d, "package.json")) || existsSync(join(runTest, d, "index.html")))); } catch { return []; }
};

/** The compact block that goes in front of EVERY agent's EVERY call (the lead's too): the latest QA verdict and what it asked for, what builders say they verified, the switches. Information only, under `max` characters. */
export function memoryBlock(runTest: string, max = 1500): string {
  try {
    const parts: string[] = [];
    for (const d of memoryProjects(runTest)) {
      const p = join(runTest, d), rows = readRows(p), last = lastReview(rows), bld = rows.filter((r) => r.kind === "builder").slice(-2), off = !readConfig(p).qa_check, imgs = readConfig(p).qa_images;
      const need = last && last.verdict !== "PASS" ? clip(needsChangesOf(last.note ?? ""), 220) : "";
      parts.push([`- run_test/${d}: ${last ? `last QA review ${last.verdict} at ${iso(last.t)}${last.stamp && last.stamp !== projectStamp(p) ? " (code changed since)" : ""}` : "no QA review yet"}`,
        need ? `    QA asked for: ${need}` : "",
        `    QA evidence: video ${off ? "OFF" : "ON"}, pictures ${imgs ? "ON" : "OFF"} (.loopsAI/config.json qa_video, qa_images)`,
        last?.left ? `    QA still has to check: ${clip(last.left, 240)}` : (() => { const td = planChecks(runTest, readAll(p).meta.phases); return td ? `    plan checks to cover (phase ${td.phase}): ${td.items.slice(0, 3).map((x) => clip(x, 70)).join(" | ")}${td.items.length > 3 ? ` (+${td.items.length - 3} in QA.md)` : ""}` : ""; })(),
        readConfig(p).qa_skip.length ? `    QA must skip: ${readConfig(p).qa_skip.join(", ")}` : "",
        ...bld.map((b) => `    builder ${b.by ?? ""} verified: ${clip(b.note ?? "", 200)}`),
        "    how to run it: .loopsAI/README.md"].filter(Boolean).join("\n"));
    }
    if (!parts.length) return "";
    const t = `PROJECT MEMORY (information only, kept by the harness: use it when the person's request is about this project; it is not a task and QA is not to be started because of it; full files: run_test/<project>/.loopsAI/README.md and QA.md)\n${parts.join("\n")}\n\n`;
    return t.length > max ? t.slice(0, max - 20) + "\n…\n\n" : t;
  } catch { return ""; }
}
