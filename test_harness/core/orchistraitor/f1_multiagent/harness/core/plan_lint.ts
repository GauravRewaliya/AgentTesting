// plan_lint: a FREE check (no model call) that a plan folder (run_test/plan) is complete enough to be built from alone, for the user AND the developer.
// Format = the one the fixtures in TestCases/test_folders/agent_fixture/prompt_fixtures proved (pp_site 98/100 in one pass, pp_composio all "Done when" items):
//   README.md   audience frontmatter, Build recipe, What is it, What you get (feature catalog), Quality bar, Research
//   PHASES.md   a phase table + per phase a task table and a "Done when" list a browser can run
//   CONTEXT.txt files every builder gets in front of its first prompt;  build_inputs/ or 0N_*.md = contract, design system, briefs
// Errors block ("not buildable"), warnings are advice. The planner runs it before it reports; a person can too.
// Every rule below exists because a real run showed it (pp_site: quality rules too late = fix round; pp_planner run 1: no research; pp_statuspage: a paid audit agent
// the lead should not need, brand tokens missing from the kit command so a builder had to edit theme.css) or because a model could pass the check without doing the work.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export interface PlanLint { ok: boolean; errors: string[]; warnings: string[]; files: number; bytes: number; readme_bytes: number }
export interface LintOpts { /** URLs the team really fetched (WebFetch / WebSearch events of the run): a source cited in the plan but never fetched is a made-up source. */ fetched?: string[] }
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const stripCode = (t: string) => t.replace(/```[\s\S]*?```/g, "");
/** the text under `## <heading>` up to the next `## ` heading */
const section = (md: string, h: string): string | null => { const m = new RegExp(`^##\\s+${h}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "mi").exec(md); return m ? m[1]! : null; };
const normUrl = (u: string) => u.replace(/[.,;:)\]]+$/, "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase();

export function lintPlan(dir: string, runTest?: string, opts: LintOpts = {}): PlanLint {
  const errors: string[] = [], warnings: string[] = [];
  if (!existsSync(dir)) return { ok: false, errors: [`no such folder: ${dir}`], warnings, files: 0, bytes: 0, readme_bytes: 0 };
  const all = walk(dir), md = all.filter((f) => f.endsWith(".md")), rd = (f: string) => readFileSync(f, "utf8");
  const bytes = all.reduce((s, f) => s + statSync(f).size, 0);
  const readmeP = join(dir, "README.md"), readme = existsSync(readmeP) ? rd(readmeP) : "";
  let featureRows = 0;
  // ---- README: the page the lead reads first (user view + the build recipe for the developer view). A heading alone does not count: the section needs content.
  if (!readme) errors.push("README.md is missing (the first page: what it is, what you get, the Build recipe)");
  else {
    if (!/^---[\s\S]*?\baudience:/.test(readme)) errors.push("README.md has no frontmatter with `audience:` (user | dev | both)");
    for (const [h, why, min] of [["Build (?:recipe|prompt)", "the ordered way to build it: where, which kit command or setup, who owns which files, how to verify", 120], ["What is it", "the goal in plain words", 40], ["What you get", "the feature catalog the user can check", 80], ["Quality bar", "what 'professional' means here, as numbers or checks", 60]] as const) {
      const body = section(readme, h);
      if (body === null) errors.push(`README.md lacks a "## ${h.replace("(?:recipe|prompt)", "recipe")}" section (${why})`);
      else if (body.replace(/\s+/g, " ").trim().length < min) errors.push(`README.md "## ${h.replace("(?:recipe|prompt)", "recipe")}" is empty or a stub (${why})`);
    }
    const recipe = section(readme, "Build (?:recipe|prompt)") ?? "";
    if ((recipe.match(/^\s*(?:\d+\.|[-*])\s/gm) ?? []).length < 3) errors.push("the Build recipe needs at least 3 steps (a numbered or bulleted list) (where it is built, the kit command or setup, who owns which files, how to verify)");
    featureRows = (section(readme, "What you get") ?? "").split("\n").filter((l) => /^\|\s*[A-Za-z]\d*\s*\|/.test(l)).length;
    if (featureRows < 3) errors.push(`the feature catalog ("What you get") has ${featureRows} feature rows (| F1 | feature | what you see | phase | status |); a person cannot judge a plan with fewer than 3`);
    if (readme.length > 12_000) warnings.push(`README.md is ${Math.round(readme.length / 1000)} KB: the lead reads it in full on every build; move detail into its own file and link it (target under 12 KB)`);
    // the kit command must carry ALL brand tokens, else a builder has to edit the kit's theme file later (pp_statuspage)
    const pi = /proto_init[^\n`]*--kind\s+site[^\n`]*/.exec(readme)?.[0] ?? "";
    if (pi) for (const flag of ["--accent", "--font", "--bg-dark"]) if (!pi.includes(flag)) warnings.push(`the proto_init command has no ${flag}: give the kit every brand token (accent, font, dark background) or a builder must edit css/theme.css later`);
    if (/check the real names|if they differ|should be named|probably named/i.test(recipe)) warnings.push("the Build recipe hedges on file names: run the kit once mentally (see plan_format: 2 pages per file) and write the exact names");
  }
  // ---- PHASES: order of delivery, each with a Done-when a browser or a command can run
  const phasesP = join(dir, "PHASES.md"), phases = existsSync(phasesP) ? rd(phasesP) : "";
  if (!phases) errors.push("PHASES.md is missing (phases, tasks with an owner, a Done when list)");
  else {
    const dw = [...phases.matchAll(/(?:^|\n)[ \t]*(?:#+[ \t]*|\*\*)?Done when[^\n]*\n((?:\s*(?:[-*]|\d+\.) [^\n]+\n?)+)/gi)];   // **Done when:**, Done when:, ### Done when: a list of checks follows
    if (!dw.length) errors.push("PHASES.md has no **Done when** list (checks a browser or a command can run)");
    for (const m of dw) {
      const items = m[1]!.split("\n").map((l) => l.replace(/^\s*(?:[-*]|\d+\.)\s+/, "").trim()).filter(Boolean);
      if (items.length < 2) errors.push("a Done when list has fewer than 2 checks");
      else if (items.length < 4) warnings.push(`a Done when list has only ${items.length} checks: one per feature that matters plus a reload/persistence check`);
      const vague = items.filter((i) => !/[0-9#`"'%>→]/.test(i) || i.length < 25);
      if (vague.length) warnings.push(`${vague.length} Done-when check(s) have no concrete number, route, quoted text or code, so nobody can run them: "${vague[0]!.slice(0, 60)}"`);
    }
    if (!/\|\s*T\d+/.test(phases)) warnings.push("PHASES.md has no task table (| T01 | what | owner | needs |)");
    // one owner per file AND per folder: the same path, or a folder and something inside it, in two build tasks is a conflict (fix tasks may touch files again)
    // tasks in sequence (B needs A, directly or through others) may edit the same file; only tasks that can run in PARALLEL must not share one
    const rowsT = phases.split("\n").filter((l) => /^\|\s*T\d+/.test(l)), deps = new Map<string, Set<string>>();
    for (const r of rowsT) { const cells = r.split("|").map((c) => c.trim()), id = cells[1]!, needs = cells[4] ?? "";   /* | task | what | owner | needs | (reads) |: needs is always the 4th column */ deps.set(id, new Set(needs.match(/T\d+/g) ?? [])); }
    const reaches = (a: string, b: string, seen = new Set<string>()): boolean => { if (seen.has(a)) return false; seen.add(a); for (const d of deps.get(a) ?? []) if (d === b || reaches(d, b, seen)) return true; return false; };
    const ordered = (a: string, b: string) => reaches(a, b) || reaches(b, a);
    const owner: [string, string][] = [];
    for (const row of rowsT) {
      const id = /^\|\s*(T\d+)/.exec(row)![1]!;
      if (/\|\s*(qa-reviewer|reviewer)\s*\|/i.test(row) || /\bqa-reviewer\b/i.test(row)) warnings.push(`${id} is given to a review agent: the lead runs the free checks itself (proto_check, preview, browse, site_audit); a paid audit agent plus its fix round cost about $0.7 on pp_statuspage`);
      if (/\bfix\b/i.test(row)) continue;
      for (const m of row.matchAll(/`((?:[\w.-]+\/)*[\w.-]+(?:\.(?:js|ts|tsx|jsx|css|html|vue|json|py)|\/))`/g)) {
        const f = m[1]!;
        for (const [g, o] of owner) if (o !== id && !ordered(id, o) && (f === g || (f.endsWith("/") && g.startsWith(f)) || (g.endsWith("/") && f.startsWith(g)))) errors.push(`${f} overlaps ${g}, edited by ${o} and ${id} which can run in parallel (neither needs the other); one owner per file or folder, or order them with the needs column`);
        owner.push([f, id]);
      }
    }
  }
  // ---- R&D: a plan for a product must show what was looked at, and it must have been looked at. "research: none (reason)" is for a small or fully specified job only.
  const everything = md.map(rd).join("\n"), cited = [...new Set((everything.match(/https?:\/\/[^\s)>\]|]+/g) ?? []).map(normUrl))];
  const none = /^research:\s*none\b/mi.test(everything);
  const reason = /^research:\s*none\s*\(([^)]*)\)/mi.exec(everything)?.[1]?.trim() ?? "";
  if (none && featureRows > 4) { if (reason.length < 40) errors.push(`\`research: none\` needs a real reason (at least a sentence in the brackets) for a plan with ${featureRows} features: why was nothing worth looking at?`); else warnings.push(`research: none on a plan with ${featureRows} features (reason given: "${reason.slice(0, 60)}"): sure no comparable product or source would have changed it?`); }
  else if (!none) {
    const rs = section(readme, "Research") ?? (existsSync(join(dir, "research.md")) ? rd(join(dir, "research.md")) : "");
    const rsUrls = [...new Set((rs.match(/https?:\/\/[^\s)>\]|]+/g) ?? []).map(normUrl))];
    if (!rs.trim()) errors.push("no research: add a `## Research` section (or research.md) with at least 2 sources (URLs) you read about comparable products, constraints or the reference, and what each changed in the plan; or state `research: none (reason)`");
    else {
      if (rsUrls.length < 2) errors.push("the Research section cites fewer than 2 sources (URLs): look at 2 to 4 real sources, or state `research: none (reason)`");
      if (rs.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().length < 120) (/\bcaptured\b|ref_capture/i.test(everything) ? warnings : errors).push("the Research section lists URLs but says almost nothing about what each told you and what it changed in the plan");
      if (opts.fetched && rsUrls.length) {
        const got = new Set(opts.fetched.map(normUrl)), missing = rsUrls.filter((u) => ![...got].some((g) => g === u || g.startsWith(u) || u.startsWith(g)) && /^[a-z0-9-]+\.[a-z]/.test(u));
        if (missing.length >= 2 || (missing.length && !got.size)) warnings.push(`cited but never fetched in this run: ${missing.slice(0, 3).join(", ")}: a source you did not read is a made-up source`);
      }
    }
  }
  // ---- developer view: a contract (what is built against) and CONTEXT.txt entries that exist
  if (!md.some((f) => /contract/i.test(f))) warnings.push("no contract file (e.g. build_inputs/00_contract.md: routes, data shapes, names every builder must agree on)");
  const ctxP = join(dir, "CONTEXT.txt");
  if (!existsSync(ctxP)) warnings.push("no CONTEXT.txt: every builder will read the shared files itself (one tool turn each); list them, one path per line");
  else if (runTest) for (const l of rd(ctxP).split("\n").map((x) => x.trim()).filter((x) => x && !x.startsWith("#"))) {
    const p = resolve(runTest, l); if (!p.startsWith(resolve(runTest))) errors.push(`CONTEXT.txt names ${l}, outside run_test/`);
    else if (!existsSync(p) && l.startsWith("plan/")) errors.push(`CONTEXT.txt names ${l}, which does not exist`);
    else if (!existsSync(p)) warnings.push(`CONTEXT.txt names ${l}: not there yet (fine if the kit command creates it)`);
  }
  // ---- honesty: what is known vs invented
  if (!/invented|captured|user-given|guessed/i.test(everything)) warnings.push("the plan never says what is captured / user-given / invented (or real / guessed): say it per screen, a builder must not present a guess as fact");
  // ---- links, placeholders, and instructions that must never travel from a web page into a build recipe
  for (const f of md) {
    const text = rd(f), body = stripCode(text);
    for (const m of body.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) { const t = m[1]!; if (/^(https?:|mailto:)/.test(t)) continue; if (!existsSync(resolve(dirname(f), t))) errors.push(`${relative(dir, f)}: broken link ${t}`); }
    for (const [i, line] of body.split("\n").entries()) {
      const negated = /\b(no|never|not|without|stub|replace|don't|do not)\b/i.test(line);
      if (/\b(TBD|FIXME|lorem ipsum|<fill[^>]*>)\b/i.test(line) && !negated) errors.push(`${relative(dir, f)}:${i + 1}: unfinished placeholder "${line.trim().slice(0, 60)}"`);
      if (/\b(npm (i|install)|npx |yarn (add|install)|curl [^|]*\|\s*(ba)?sh|wget |sudo )/i.test(line) && !negated && !/\bgrep\b/.test(line)) warnings.push(`${relative(dir, f)}:${i + 1}: a command the harness forbids or distrusts (pnpm only; never pipe a download into a shell): "${line.trim().slice(0, 60)}"`);
    }
    if (statSync(f).size > 20_000) warnings.push(`${relative(dir, f)} is ${Math.round(statSync(f).size / 1000)} KB: split it (builders read only what they need)`);
  }
  return { ok: errors.length === 0, errors, warnings, files: all.length, bytes, readme_bytes: readme.length };
}
