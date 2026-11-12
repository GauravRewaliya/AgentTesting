// Shared work of the advance_test fixtures (results/advance_test/*.ts): the stages plan -> implement -> review -> fix of ONE tiny job (a `slugify` function), as loopferry runs a task in run kinds plan / implement / review.
// Not a results/*.ts file on purpose (loadResults imports every .ts in results/ and wants a default export).
//   gap  scenario: the first build is GAPPY (no trimming, no accents, one test), the reviewer really inspects the files and finds it, the fix repairs exactly the findings.
//   ok   scenario: the first build is complete, the reviewer approves, nothing more must be called.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import type { Req } from "@core/types.ts";

const rep = (o: object) => `REPORT: ${JSON.stringify(o)}`;
export const GAPPY_SRC = `export function slugify(title: string): string {\n  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-");\n}\n`;
export const GOOD_SRC = `export function slugify(title: string): string {\n  return title\n    .normalize("NFD")\n    .replace(/[\\u0300-\\u036f]/g, "")\n    .toLowerCase()\n    .replace(/[^a-z0-9]+/g, "-")\n    .replace(/^-+|-+$/g, "");\n}\n`;
export const GAPPY_TEST = `import { expect, test } from "bun:test";\nimport { slugify } from "./slugify";\n\ntest("lowercases and joins words", () => expect(slugify("Hello World")).toBe("hello-world"));\n`;
export const GOOD_TEST = `import { expect, test } from "bun:test";\nimport { slugify } from "./slugify";\n\ntest("lowercases and joins words", () => expect(slugify("Hello World")).toBe("hello-world"));\ntest("trims leading and trailing separators", () => expect(slugify("  Hello, World! ")).toBe("hello-world"));\ntest("transliterates accents", () => expect(slugify("Café Crème")).toBe("cafe-creme"));\n`;

export function plan(req: Req, dir: string): string {
  req.write(`${dir}/PLAN.md`, `# Plan: slugify\n\nGoal: a \`slugify(title)\` function in \`${dir}/src/slugify.ts\` with tests in \`${dir}/src/slugify.test.ts\`.\n\n## Steps\n1. create src/slugify.ts\n2. create src/slugify.test.ts (bun:test)\n\n## Acceptance checks (the reviewer uses these)\n- A1 slugify("Hello World") === "hello-world"\n- A2 leading and trailing separators are trimmed ("  Hello, World! " -> "hello-world")\n- A3 accents are transliterated ("Café Crème" -> "cafe-creme")\n- A4 the tests cover A1, A2 and A3\n`);
  return `Plan written to run_test/${dir}/PLAN.md: 2 steps and 4 acceptance checks (A1 basic, A2 trimming, A3 accents, A4 tests cover A1-A3).\n` + rep({ stage: "plan", summary: "plan for slugify with 4 acceptance checks", files: [`${dir}/PLAN.md`] });
}
export function build(req: Req, dir: string, quality: "gappy" | "good"): string {
  req.write(`${dir}/src/slugify.ts`, quality === "gappy" ? GAPPY_SRC : GOOD_SRC);
  req.write(`${dir}/src/slugify.test.ts`, quality === "gappy" ? GAPPY_TEST : GOOD_TEST);
  return (quality === "gappy"
    ? `Built run_test/${dir}/src/slugify.ts (lowercase, replace every run of non-alphanumerics with "-") and src/slugify.test.ts (one test: "Hello World"). Done.`
    : `Built run_test/${dir}/src/slugify.ts (accents removed via NFD, lowercase, separators joined, edges trimmed) and src/slugify.test.ts (3 tests: basic, trimming, accents). All four acceptance checks are covered.`)
    + "\n" + rep({ stage: "implement", summary: "slugify + tests", files: [`${dir}/src/slugify.ts`, `${dir}/src/slugify.test.ts`] });
}
/** A real (deterministic) review of what is on disk: it reads the files, it does not trust the builder's summary. */
export function review(req: Req, dir: string): string {
  const read = (f: string) => (existsSync(join(req.ws, dir, f)) ? readFileSync(join(req.ws, dir, f), "utf8") : null);
  const src = read("src/slugify.ts"), test = read("src/slugify.test.ts"), findings: string[] = [];
  if (src === null) findings.push(`F1 src/slugify.ts does not exist in run_test/${dir}`);
  else {
    if (!/\.replace\(\/\^-\+\|-\+\$\/g|\.trim\(/.test(src)) findings.push(`F1 src/slugify.ts: leading/trailing separators are not trimmed (A2): slugify("  Hello, World! ") gives "-hello-world-"`);
    if (!/normalize\(/.test(src)) findings.push(`F2 src/slugify.ts: accents are dropped, not transliterated (A3): slugify("Café Crème") gives "caf-cr-me", expected "cafe-creme"`);
  }
  if (test === null || (test.match(/\btest\(/g) ?? []).length < 3) findings.push(`F3 src/slugify.test.ts: only ${(test?.match(/\btest\(/g) ?? []).length} test(s); A4 needs tests for A1, A2 and A3`);
  const verdict = findings.length ? "changes_requested" : "approved";
  return `REVIEW: ${verdict}\n${findings.length ? findings.join("\n") : "All four acceptance checks hold in the files on disk (A1 A2 A3 A4)."}\n` + rep({ stage: "review", verdict, findings });
}
export function fix(req: Req, dir: string): string {
  const before = review(req, dir);
  req.write(`${dir}/src/slugify.ts`, GOOD_SRC); req.write(`${dir}/src/slugify.test.ts`, GOOD_TEST);
  const closed = (before.match(/\bF\d\b/g) ?? []).filter((f, i, a) => a.indexOf(f) === i);
  return `You are right, sorry. Fixed ${closed.join(", ") || "nothing"}: slugify now trims the edges (F1), transliterates accents with NFD (F2) and has 3 tests (F3).\n` + rep({ stage: "fix", summary: `closed ${closed.join(",")}`, files: [`${dir}/src/slugify.ts`, `${dir}/src/slugify.test.ts`] });
}

// ── context-loss scenario (from loopferry TESTING_REPORT.md 5.20 "the stages work alone and lose context") ──
// A follow-up asked ONLY for a backup copy. The builder copies correctly. A reviewer that is NOT told about the request calls the copy a major defect (and an unguarded fixer would delete it);
// a reviewer that IS told ("backup") compares the two files and approves. Which one answers depends on the hand-over the lead wrote.
const PAGE = `<!doctype html>\n<h1>Hello</h1>\n`;
export function copyBuild(req: Req, dir: string): string {
  if (!existsSync(join(req.ws, dir, "index.html"))) req.write(`${dir}/index.html`, PAGE);
  req.write(`${dir}/index2.html`, readFileSync(join(req.ws, dir, "index.html"), "utf8"));
  return `Copied run_test/${dir}/index.html to run_test/${dir}/index2.html (plain copy, nothing else changed).\n` + rep({ stage: "implement", summary: "index2.html = copy of index.html", files: [`${dir}/index2.html`] });
}
export function reviewCopy(req: Req, dir: string, aware: boolean): string {
  const a = join(req.ws, dir, "index.html"), b = join(req.ws, dir, "index2.html");
  const same = existsSync(a) && existsSync(b) && readFileSync(a, "utf8") === readFileSync(b, "utf8");
  if (aware) { const v = same ? "approved" : "changes_requested"; return `REVIEW: ${v}\n${same ? "index2.html is the requested backup and is byte-identical to index.html." : "index2.html differs from index.html."}\n` + rep({ stage: "review", verdict: v, findings: same ? [] : ["F1 backup differs from the original"] }); }
  return `REVIEW: changes_requested\nF1 (major) index2.html is an unrequested duplicate of index.html: remove it.\n` + rep({ stage: "review", verdict: "changes_requested", findings: ["F1 major: index2.html is an unrequested duplicate: remove it"] });
}

// ── QA video scenario (loopferry's browser QA stage: it records qa.webm in its E2B sandbox; here the same in a local Docker container, test_harness/infra/qa) ──
import { recordQa } from "../../../../../test_harness/infra/qa/run_qa.ts";
export const QA_PAGE = `<!doctype html><meta charset="utf-8"><title>Slug demo</title>\n<style>body{font:22px system-ui;margin:48px}input{font:inherit;padding:10px;width:420px}code{background:#eee;padding:4px 10px;border-radius:6px}button{font:inherit;padding:8px 16px;margin-left:8px}</style>\n<h1>Slug demo</h1><input id="t" placeholder="Type a title"><button id="b">Clear</button>\n<p>slug: <code id="s"></code></p>\n<script>const slug=t=>t.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");t.oninput=()=>s.textContent=slug(t.value);b.onclick=()=>{t.value="";s.textContent=""}</script>\n`;
export function qaBuild(req: Req, dir: string): string {
  req.write(`${dir}/index.html`, QA_PAGE);
  return `Built run_test/${dir}/index.html: an input that shows the slug of what is typed, and a Clear button (self-contained, no packages).\n` + rep({ stage: "implement", summary: "slug demo page", files: [`${dir}/index.html`] });
}
export function qaRecord(req: Req, dir: string): string {
  const home = req.ws.endsWith(`${sep}workspace${sep}run_test`) ? dirname(dirname(req.ws)) : dirname(req.ws);   // <session>/workspace/run_test -> <session>/store/qa/<id>; otherwise next to run_test: QA output is NEVER a loose folder
  const r = recordQa({ appDir: join(req.ws, dir), out: join(home, "store", "qa", String(Date.now())) });
  if (r.skipped) return `QA skipped: ${r.error}\n` + rep({ stage: "qa", ok: false, skipped: true });
  if (!r.ok) return `QA FAIL: ${r.error ?? "no video"}\n` + rep({ stage: "qa", ok: false, error: r.error });
  const s = r.summary as { typed?: string; texts?: string[]; console_errors?: string[]; page_errors?: string[]; title?: string };
  return `QA PASS (${r.backend} container: no network, read-only app folder). Page "${s.title}" opened; I typed "${s.typed}" and clicked the button. Saw: ${(s.texts ?? []).join(" | ")}. Console errors: ${(s.console_errors ?? []).length}, page errors: ${(s.page_errors ?? []).length}.\n`
    + `VIDEO: ${r.video}\nSCREENSHOT: ${r.screenshot}\nOpen it with: xdg-open ${r.video}\n` + rep({ stage: "qa", ok: true, video: r.video, screenshot: r.screenshot, console_errors: s.console_errors ?? [] });
}
