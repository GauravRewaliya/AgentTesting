// Older test runs did not write the conversation into the session store, so the UI chat of those sessions is empty.
// This adds, for every exp entry whose session has NO notes: the user message of each finished turn (the case defines it) and, where the run's final reply is unknown, a plain marker. Never touches a session that already has notes.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STATE_ROOT } from "@core/paths.ts";
import { MStore, say } from "../harness/core/board.ts";
import { loadSuites } from "./cases.ts";
import { readdirSync } from "node:fs";

const dry = process.argv.includes("--dry"), all = new Map((await loadSuites()).map((c) => [c.id, c]));
let n = 0;
for (const f of readdirSync(join(STATE_ROOT, "exp")).filter((x) => x.endsWith(".json"))) {
  const e = JSON.parse(readFileSync(join(STATE_ROOT, "exp", f), "utf8"));
  const ent = e as unknown as { case: string; task: string; home?: string; done: number }, c = all.get(ent.case), file = join(STATE_ROOT, ent.home ?? ent.task, "store", "store.json");
  if (!c || !existsSync(file)) continue;
  const st = new MStore(file);
  if (st.notes.some((x) => x.task_id === ent.task)) continue;
  console.log(`${dry ? "would add" : "add"} chat to ${ent.case} (${Math.min(ent.done, c.turns.length)} turn(s))`);
  if (!dry) st.tx(() => { for (let i = 0; i < Math.min(ent.done, c.turns.length); i++) { const u = say(st, ent.task, "user", "lead", c.turns[i]!.user, ["testrun", "backfilled"], Infinity); u.read_by.push("lead");
    const r = say(st, ent.task, "lead", "user", "(the lead's answer was not recorded: this run is older than the chat record; run it again to see it)", ["testrun", "backfilled"], Infinity); r.read_by.push("user"); } });
  n++;
}
console.log(`${n} session(s) ${dry ? "would get" : "got"} a chat`);
