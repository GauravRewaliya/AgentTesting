// Runs the test_artifact suite FOR REAL: a haiku lead (headless `claude -p`) with the REAL Artifact tool. Nothing is mocked.
//   bun testrun/artifact_run.ts [case ids]        (cost: ~ $0.01-0.05 per case; artifacts are created PRIVATE in the account of the logged-in user)
// `run.ts test_artifact` calls runArtifactCases() too (these solo cases cannot use the f1 delegating lead).
// Why this exists: headless `claude -p` only gets the Artifact tools when CLAUDE_CODE_ENTRYPOINT=cli-interactive (probed 2026-11-13, CLI 2.1.323).
// PASS needs ALL of: (1) the lead really called the Artifact tool and it succeeded, (2) the reply contains that exact claude.ai/artifact link,
// (3) the reply has no other artifact link (an invented one), (4) per case: art_3 says plainly it is not a Figma file, art_4's page really works in Chrome.
// Exit code 1 on any FAIL, so a broken artifact flow can never pass silently again.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSuites } from "./cases.ts";

const OUT = join(import.meta.dir, "..", "..", "..", "..", ".state", "artifact_runs"); mkdirSync(OUT, { recursive: true });
const LINK = /https:\/\/claude\.ai\/(?:code\/)?artifact\/[A-Za-z0-9-]+/g;
const allowedTools = ["Artifact", "ArtifactComments", "Write", "Read", "Skill"];

/** art_4: really use the published page in headless Chrome: type an item, click Add, the item must show; click a remove button, it must be gone. */
async function todoWorks(file: string): Promise<string | undefined> {
  let html: string; try { html = readFileSync(file, "utf8"); } catch { return `cannot read the published page ${file}`; }
  const probe = `<script>window.addEventListener("load",()=>setTimeout(()=>{const o=document.createElement("pre");o.id="__r";let r="OK";try{
    const inp=document.querySelector("input[type=text],input:not([type]),textarea");if(!inp)throw"no text input";
    inp.value="zz-test-item";inp.dispatchEvent(new Event("input",{bubbles:true}));
    const btn=[...document.querySelectorAll("button,input[type=submit]")].find(b=>/add|\\+|create|save/i.test(b.textContent||b.value));if(!btn)throw"no Add button";
    btn.click();inp.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
    if(!document.body.innerText.includes("zz-test-item"))throw"added item does not show";
    const row=[...document.querySelectorAll("li,[role=listitem],tr,.item,.todo,.task")].find(e=>e.innerText&&e.innerText.includes("zz-test-item"));if(!row)throw"no list row for the item";
    const rm=[...row.querySelectorAll("button,a,[role=button],input[type=button]")].find(b=>/remove|delete|trash|clear|[×✕✖]|^\\s*x\\s*$/i.test((b.textContent||b.value||"")+(b.getAttribute("aria-label")||"")+(b.title||"")+(b.dataset.act||"")+(b.className||"")));if(!rm)throw"no remove button in the item row";
    rm.click();if(document.body.innerText.includes("zz-test-item"))throw"item still there after remove";
  }catch(e){r="FAIL "+e}o.textContent=r;document.body.appendChild(o)},300));</script>`;
  const f = file + ".test.html"; writeFileSync(f, /<\/body>/i.test(html) ? html.replace(/<\/body>/i, probe + "</body>") : html + probe);
  const p = Bun.spawn(["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu", `--user-data-dir=${file}.chrome`, "--virtual-time-budget=5000", "--dump-dom", "file://" + f], { stdout: "pipe", stderr: "ignore" });
  const dom = await new Response(p.stdout).text(); await p.exited;
  const m = dom.match(/<pre id="__r">([^<]*)<\/pre>/); return !m ? "the page did not run in Chrome" : m[1] === "OK" ? undefined : m[1];
}

/** Runs the given test_artifact cases; returns the number of FAILED cases. */
export async function runArtifactCases(cases: any[]): Promise<number> {
  let failed = 0;
  for (const c of cases) {
    const ws = join(OUT, c.id); mkdirSync(ws, { recursive: true });
    const prompt = c.turns[0].user + `\nWrite your page file under ${ws}.`;
    const p = Bun.spawn(["claude", "-p", prompt, "--model", "haiku", "--output-format", "stream-json", "--verbose", "--setting-sources", "", "--strict-mcp-config",
      "--tools", allowedTools.join(","), "--permission-mode", "dontAsk", "--allowedTools", ...allowedTools],
      { cwd: ws, stdin: "ignore", stdout: "pipe", stderr: "pipe", env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: "cli-interactive", CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1" } });
    const timer = setTimeout(() => p.kill(9), 600_000);
    const raw = (await new Response(p.stdout).text()).split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    await p.exited; clearTimeout(timer);
    const tools = raw.filter((e: any) => e.type === "assistant").flatMap((e: any) => e.message.content.filter((b: any) => b.type === "tool_use"));
    const artUse = tools.filter((t: any) => t.name === "Artifact" && (t.input?.action ?? "publish") === "publish");
    const results = raw.filter((e: any) => e.type === "user").flatMap((e: any) => Array.isArray(e.message.content) ? e.message.content : []).filter((b: any) => b.type === "tool_result" && artUse.some((t: any) => t.id === b.tool_use_id));
    const real = new Set(results.flatMap((r: any) => (JSON.stringify(r.content).match(LINK) ?? []).map((u) => u.replace(/\\.*/, ""))));
    const res = raw.find((e: any) => e.type === "result") ?? {}, reply: string = res.result ?? "", cost: number = res.total_cost_usd ?? 0;
    const links = reply.match(LINK) ?? [], invented = links.filter((l) => !real.has(l));
    const problems: string[] = [];
    if (!tools.length && !reply) problems.push("the lead produced nothing (claude failed or timed out)");
    if (real.size === 0) problems.push("no Artifact publish succeeded (no real link was created)");
    else if (!links.some((l) => real.has(l))) problems.push("reply does not contain the real artifact link");
    if (invented.length) problems.push(`reply has an INVENTED link: ${invented.join(", ")}`);
    if (c.id === "art_3_figma" && !(/figma/i.test(reply) && /(can(no|')t|unable|not (a figma|available|connected)|no figma|don't have|do not have|isn't a figma)/i.test(reply))) problems.push("no Figma connector exists here: the reply must say plainly it is NOT a Figma file (it did not)");
    if (c.id === "art_4_working_website" && artUse[0]?.input?.file_path) { const w = await todoWorks(artUse[0].input.file_path); if (w) problems.push("todo page does not really work in Chrome: " + w); }
    const status = problems.length ? "FAIL" : "PASS"; if (problems.length) failed++;
    console.log(`${status}  ${c.id}  $${cost.toFixed(3)}  tools: ${[...new Set(tools.map((t: any) => t.name))].join(",") || "-"}  ${[...real].join(" ") || ""}${problems.length ? "\n      - " + problems.join("\n      - ") : ""}`);
    writeFileSync(join(OUT, c.id + ".json"), JSON.stringify({ at: new Date().toISOString(), status, problems, cost, real: [...real], reply, tools: tools.map((t: any) => ({ name: t.name, input: JSON.stringify(t.input).slice(0, 300) })) }, null, 1));
  }
  return failed;
}

if (import.meta.main) {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const cases = (await loadSuites()).filter((c: any) => c.suite === "test_artifact" && (!ids.length || ids.includes(c.id)));
  if (!cases.length) { console.error("no test_artifact cases found"); process.exit(1); }
  const failed = await runArtifactCases(cases);
  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed ? 1 : 0);
}
