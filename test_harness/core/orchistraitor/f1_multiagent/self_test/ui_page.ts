// Runs the page's OWN script (ui/index.html) against a stub DOM and a stub fetch, to check the link ("#/<session>/agent/<id>") handling without a browser.
//   ../limited.sh bun test/ui_page.ts        every failure is printed loudly and the exit code is 1
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "ui", "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)![1]!;
const results: { id: string; ok: boolean }[] = [];
const t = (id: string, what: string, ok: boolean, detail?: string) => { results.push({ id, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${what}${!ok && detail ? "\n        " + detail : ""}`); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function page(hash: string) {
  const els: Record<string, any> = {}, handlers: Record<string, () => void> = {}, fetched: { url: string; session: string | null }[] = [];
  const el = () => ({ innerHTML: "", textContent: "", value: "", disabled: false, title: "", dataset: {} as Record<string, string>, style: {}, scrollTop: 0, scrollHeight: 0, clientHeight: 0,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, addEventListener() {}, focus() {}, requestSubmit() {}, dispatchEvent() {} });
  const location = { hash };
  const state = (task: string) => ({ task, known: task !== "ghost", master: "active", master_doing: "", master_detail: { queued: [], other_running: 0, other_paused: 0, waiting_on_master: 0, queued_messages: 0, working_for_ms: 0, error: "" },
    config: { runner: "fake", max_depth: 4, writer_mode: "worktree", repo: "/r" }, lead: null, sessions: [{ task: "A", title: "first", last: Date.now(), subs: 0, state: "active" }, { task: "B", title: "second", last: Date.now(), subs: 1, state: "active" }],
    chat: [], agents: [{ id: "researcher#1", kind: "researcher", name: "researcher", status: "idle", level: 2, caller: "lead#1", runs: 0, session: null, title: "t", description: "", doing: "", cost: 0, last_event_at: 0, paused: false, needs_parent: null }],
    problems: [], events: [], patches: [], locks: [], calls: [] });
  const ctx: any = {
    document: { getElementById: (id: string) => (els[id] ??= el()), querySelectorAll: () => [], addEventListener() {}, title: "" },
    window: { addEventListener: (ev: string, fn: () => void) => { handlers[ev] = fn; } },
    location, history: { replaceState: (_a: unknown, _b: unknown, url: string) => { location.hash = url; } }, navigator: {}, setInterval: () => 0, setTimeout, confirm: () => true,
    fetch: async (url: string, init: any = {}) => {
      const session = init.headers?.["x-session"] ?? null; fetched.push({ url, session });
      const body = url.startsWith("/api/state") ? state(session ?? "default") : url.startsWith("/api/agent") ? { id: "researcher#1", kind: "researcher", name: "researcher", status: "idle", level: 2, caller: "lead#1", runs: 0, session: null, title: "t", description: "", cost: 0, descendants: 0, notes: [], reports: [], calls: [], events: [], transcript: null, tv: -1, needs_parent: null, paused: false } : {};
      return { ok: true, json: async () => body };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(script + "\n;globalThis.__t={get curTask(){return curTask},get open(){return open},poll};", ctx);
  await sleep(80);
  return { ctx, els, location, fetched, fire: async (h: string) => { location.hash = h; handlers["hashchange"]?.(); await sleep(80); } };
}

try {
  {
    const p = await page("#/B/agent/researcher%231");
    t("PG1", "opening a link restores THIS tab's session and the agent popup (requests carry x-session: B)", p.ctx.__t.curTask === "B" && p.ctx.__t.open === "researcher#1" && p.fetched.some((f) => f.url.startsWith("/api/state") && f.session === "B") && p.fetched.some((f) => f.url.startsWith("/api/agent?id=researcher%231") && f.session === "B"), JSON.stringify([p.ctx.__t.curTask, p.ctx.__t.open, p.fetched]));
    t("PG2", "the address bar keeps saying where you are (#/B/agent/researcher%231)", p.location.hash === "#/B/agent/researcher%231", p.location.hash);
    await p.fire("#/A");
    t("PG3", "changing the link in the SAME tab switches the session, closes the popup and asks the server for A (it used to do nothing)", p.ctx.__t.curTask === "A" && p.ctx.__t.open === null && p.fetched.at(-1)!.session === "A" && p.location.hash === "#/A", JSON.stringify([p.ctx.__t.curTask, p.ctx.__t.open, p.location.hash]));
  }
  {
    const p = await page("#/ghost");
    t("PG4", "a link to a session that does not exist says so and falls back to a real session (never shows an empty fake one)", p.ctx.__t.curTask !== "ghost" && /ghost/.test(p.els["hint"].textContent) && /no history/.test(p.els["hint"].textContent), `${p.ctx.__t.curTask} | ${p.els["hint"].textContent}`);
  }
  {
    const p = await page("#/ghost");
    await p.ctx.__t.poll(); await p.ctx.__t.poll();   // two more polls, as the page does every second: each one re-renders and used to clear the hint
    t("PG6", "an error notice stays on screen after the next polls (it used to be wiped within a second)", /no history/.test(p.els["hint"].textContent), p.els["hint"].textContent);
  }
  {
    const p = await page("");
    t("PG5", "the bare URL adopts the server's most recent session and writes it into the address bar", p.ctx.__t.curTask === "default" && p.location.hash === "#/default", `${p.ctx.__t.curTask} ${p.location.hash}`);
  }
} catch (e) { t("PG-CRASH", "the page checks ran to the end", false, String(e)); }
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
if (bad.length) { console.error(`\n!!!!!! ${bad.length} FAILED: ${bad.map((b) => b.id).join(", ")} !!!!!!`); process.exit(1); }
