// COMMAND: site build (the website-clone PIPELINE that CALLS sub-agents: a design worker, a brief worker (lookup) and a builder per screens file, run by the plan runner). It lives with the other agent-calling code.
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { E, HDIR, cmd, cwd, defs, file, flag, inWs, me, out, policy, projPath, store, task } from "../ctx.ts";
import { validatePlan, type PlanTask } from "../../core/plan.ts";

export const COMMANDS = ["site_build"];
export async function run(): Promise<void> {
if (cmd === "site_build") {   // THE PIPELINE for a website clone, made by the harness (no script for the model to skip): a design worker + per screens file a brief worker (lookup-page) and a builder that depends ONLY on its own brief; the plan runner starts every task the moment its dependencies are done, 4 at a time.
  // `site_build --dir run_test/<project> --ref <store>[,<store2>] --request "<the person's words>"` -> returns plan_id; follow it with `plan_status --plan <id> --wait 60`
  const proj = projPath(flag("dir") ?? "."), refs = (flag("ref") ?? "").split(",").map((x) => x.trim().replace(/[^\w.-]+/g, "-")).filter(Boolean), request = (flag("request") ?? "the page as in the reference").slice(0, 600);
  let routes: { id: string; label?: string; file?: string }[] = []; try { routes = JSON.parse(readFileSync(join(proj, "proto.json"), "utf8")).routes; } catch { /* checked below */ }
  const rel = proj.slice(resolve(cwd).length + 1), R = (x: string) => `run_test/_ref/${refs[0]}/${x}`;
  if (!inWs(proj) || !routes.length || !refs.length || !existsSync(join(cwd, "run_test", "_ref", refs[0]!, "STORE.md"))) out({ ok: false, reason: "needs --dir run_test/<project> made by proto init (proto.json) and --ref <store made by ref capture> (run_test/_ref/<name>/STORE.md); several stores: --ref a,b (the first one receives the briefs)" });
  else {
    const stores = refs.map((r) => `run_test/_ref/${r}/`).join(" and "), byFile = new Map<string, typeof routes>(); for (const r of routes) byFile.set(r.file ?? "main", [...(byFile.get(r.file ?? "main") ?? []), r]);
    const tasks: PlanTask[] = [], first = [...byFile.keys()][0];
    for (const [f, pages] of byFile) {   // ONE lookup call per screens file (the first one also writes the design system: no extra call for it) + ONE builder per screens file that depends only on its own brief
      const design = f === first;
      tasks.push({ id: `brief-${f}`.slice(0, 24), role: "lookup", output: "REPORT line with the files", boundaries: "write only the files named here; terse; original copy only; every link target must be a route of PROTO.md", writes: [R(`briefs/BRIEF_${f}.md`), ...(design ? [R("briefs/BRIEF.md")] : []), ...pages.map((p) => R(`layouts/${p.id}.md`))],
        objective: `Pages ${pages.map((p) => p.label ?? p.id).join(" and ")} (screens file ${f}). Write ${pages.map((p) => `layouts/${p.id}.md`).join(" and ")} and briefs/BRIEF_${f}.md${design ? ", and ALSO briefs/BRIEF.md = the design system of the whole site" : ""}. Stores: ${stores}; project ${rel}/. Request: ${request}` });
      tasks.push({ id: `build-${f}`.slice(0, 24), role: "builder", deps: [`brief-${f}`.slice(0, 24)], output: "REPORT line with the files", boundaries: `write only ${rel}/js/screens/${f}.js and ${rel}/css/pages-${f}.css`, writes: [`${rel}/js/screens/${f}.js`, `${rel}/css/pages-${f}.css`],
        objective: `Pages ${pages.map((p) => p.label ?? p.id).join(" and ")} (screens file js/screens/${f}.js). Build exactly what briefs/BRIEF_${f}.md says (your complete context; briefs/BRIEF.md is the design system: read it when it exists). Store ${stores}; project ${rel}/. Request: ${request}` });
    }
    const nf = byFile.size, eta = Math.round(2 + 1.5 + 0.5 * Math.max(0, nf - 2)), expected = `about ${eta}-${eta + 2} min in total: the ${nf} brief call(s) run together (~1.5-2.5 min), each builder starts when ITS brief is done (~1-2 min each, overlapping), then your checks (~1 min). Nothing to do meanwhile: poll plan status with --wait 300; do not start other agents.`;
    let o: unknown;
    store.tx(() => {
      const owner = store.agent(task, me), v = validatePlan(tasks, defs, owner?.name ?? "lead", policy, store, task);
      if (!v.ok) { store.ev("plan.rejected", task, me, { errors: v.errors.length }); o = { ok: false, errors: v.errors }; return; }
      const plan_id = "plan" + (store.plans.filter((p) => p.task_id === task).length + 1);
      store.plans.push({ task_id: task, plan_id, owner: me, waves: v.waves, status: "running", created: Date.now(), tasks: tasks.map((t) => ({ ...t, status: "pending" as const })) });
      store.ev("plan.submitted", task, me, { plan_id, tasks: tasks.length, waves: v.waves.length }); o = { ok: true, plan_id, tasks: tasks.map((t) => `${t.id} (${t.role}${t.deps ? " after " + t.deps.join(",") : ""})`), waves: v.waves, expected };
    });
    if ((o as { ok: boolean }).ok) { if (!E.HARNESS_PLAN_DRY) spawn("bun", ["--smol", join(HDIR, "tools.ts"), "_plan", "--plan", (o as { plan_id: string }).plan_id], { detached: true, stdio: "ignore", env: process.env }).unref(); (o as Record<string, unknown>).next = `The pipeline runs by itself (briefs and builds overlap, 4 at a time). Follow it: plan status --plan ${(o as { plan_id: string }).plan_id} --wait 300 (repeat while it is running; no other calls meanwhile). When it is done start the checks together: ref compare --async, site audit --async, preview --async, then wait --any --agents <job ids>.`; }
    out(o);
  }
}
}
