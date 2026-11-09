// Tiny test kit: PASS/FAIL lines, a report file, temp repos. (Not `bun test`; run the file with bun.)
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface Res { id: string; name: string; ok: boolean; detail: string; suite: string }
export const results: Res[] = [];
let suite = "";
export const setSuite = (s: string) => { suite = s; console.log(`\n== ${s}`); };
export function t(id: string, name: string, ok: boolean, detail = "") {
  results.push({ id, name, ok, detail, suite });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${name}${ok && !detail ? "" : "\n        " + detail.replace(/\n/g, "\n        ")}`);
}
export function mkRepo(files: Record<string, string> = {}): string {
  const d = mkdtempSync(join(tmpdir(), "lf-"));
  for (const [k, v] of Object.entries(files)) { mkdirSync(dirname(join(d, k)), { recursive: true }); writeFileSync(join(d, k), v); }
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: d });
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "add", "-A"], { cwd: d });
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init"], { cwd: d });
  return d;
}
export const rm = (d: string) => rmSync(d, { recursive: true, force: true });

export function writeReport(file: string, title: string, intro: string) {
  const bad = results.filter((r) => !r.ok);
  const md = [`# ${title}`, ``, `Generated ${new Date().toISOString()}. ${results.length - bad.length}/${results.length} passed.`, ``, intro, ``,
    `| suite | id | check | result |`, `|---|---|---|---|`, ...results.map((r) => `| ${r.suite} | ${r.id} | ${r.name} | ${r.ok ? "PASS" : "**FAIL**"} |`), ``,
    ...(bad.length ? [`## Failures`, ``, ...bad.flatMap((r) => [`### ${r.id} ${r.name}`, "```", r.detail, "```", ``])] : [])].join("\n");
  writeFileSync(file, md);
  console.log(`\n${results.length - bad.length}/${results.length} passed -> ${file}`);
  return bad.length;
}
