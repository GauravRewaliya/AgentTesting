// lookup_test: LOOKUP, the visual analyst. Pitfalls: helpers for a small job, one after another for a big one, writing before looking, files outside its task, briefing a page it cannot see.
import type { PromptCase } from "./types.ts";

const l = (o: Omit<PromptCase, "flag" | "agent">): PromptCase => ({ flag: "prompt_testing", agent: "lookup", ...o });
const STORE = { title: "ls run_test/_ref/acme", text: "STORE.md  MAP.md  REF.md  outline.json  pictures/(overview-1..3.png, desktop-dark.png, mobile.png)  assets/  assets.json  raw/" };

export const cases: PromptCase[] = [
  l({ id: "lk_looks_before_writing", about: "it reads the store index and looks at the contact sheets before it writes a layout",
    why: "a layout written without looking is invented structure",
    stuff: [STORE],
    user_message: "OBJECTIVE: write layouts and the brief for the pages Home and Pricing (screens file part-1).\nBOUNDARIES: write only run_test/_ref/acme/layouts/home.md, layouts/pricing.md, briefs/BRIEF_part-1.md. Store: run_test/_ref/acme/, project run_test/demo/.",
    expect: { first_call: { any: [{ tool: "Read", match: "(STORE|MAP|REF|overview)" }, { tool: "Bash", match: "(cat|ls).*(STORE|MAP)" }] }, not_calls: [{ tool: "Write" }] } }),
  l({ id: "lk_small_task_does_it_itself", about: "two pages in one screens file: it does it itself, no helper copies", tags: ["cost"],
    why: "every extra agent costs a start-up and a session",
    stuff: [STORE, { title: "what you read", text: "STORE.md and MAP.md read; Home is sections 1-6, Pricing sections 7-11 (overview-1.png, overview-2.png)" }],
    user_message: "OBJECTIVE: write layouts and the brief for the pages Home and Pricing (screens file part-1).\nBOUNDARIES: write only run_test/_ref/acme/layouts/home.md, layouts/pricing.md, briefs/BRIEF_part-1.md.",
    expect: { not_calls: [{ tool: "Bash", match: "fork_all|delegate" }], calls: [{ any: [{ tool: "Read" }, { tool: "Write" }] }] } }),
  l({ id: "lk_big_task_forks_all_at_once", about: "four screens files: copies of itself start together with ONE fork_all (at most 3), it keeps its own part", tags: ["cost", "split_task"],
    why: "briefs written one after another took 3 x ~110 s in a row",
    stuff: [STORE, { title: "what you read", text: "MAP.md lists 14 pages: Home, Pricing, Blog, Docs, About, Careers, Contact, Login, Signup, Status, Changelog, Security, Legal, Press. PROTO.md: screens files part-1..part-4." }],
    user_message: "OBJECTIVE: write layouts and briefs for ALL 14 pages, in four screens files: part-1 (Home, Pricing, Blog), part-2 (Docs, About, Careers), part-3 (Contact, Login, Signup, Status), part-4 (Changelog, Security, Legal, Press).\nBOUNDARIES: write only under run_test/_ref/acme/layouts/ and briefs/. Store run_test/_ref/acme/, project run_test/demo/.",
    looks: [{ match: "STORE|MAP|PROTO|acme", text: "STORE.md: acme (14 pages). MAP.md: Home, Pricing, Blog, Docs, About, Careers, Contact, Login, Signup, Status, Changelog, Security, Legal, Press. PROTO.md: screens files part-1..part-4 (as in the results above)." }],
    expect: { calls: [{ tool: "Bash", match: "fork_all" }], not_calls: [{ tool: "Bash", match: "delegate --role lookup" }], judge: "one fork_all with 2-3 tasks, disjoint writes; it works on its own part meanwhile" } }),
  l({ id: "lk_writes_only_named_files", about: "it writes only the files its task names, never the project's files",
    stuff: [STORE, { title: "what you read", text: "Home layout is clear from overview-1.png" }],
    user_message: "OBJECTIVE: write layouts/home.md for the Home page.\nBOUNDARIES: write ONLY run_test/_ref/acme/layouts/home.md.",
    expect: { calls: [{ any: [{ tool: "Write", match: "layouts/home\\.md" }, { tool: "Read", match: "(overview|pictures|STORE|MAP)" }] }], not_calls: [{ tool: "Write", match: "^(?!.*layouts/home\\.md)" }, { tool: "Edit", match: "^(?!.*layouts/home\\.md)" }] } }),
  l({ id: "lk_page_it_cannot_see_is_not_briefed", about: "a page with no picture is reported as unseen, not briefed from imagination",
    why: "describe what you SEE; do not invent structure the picture does not show",
    stuff: [STORE, { title: "what you found", text: "MAP.md lists the page 'Pricing' as sections 7-11, but pictures/overview-2.png (sections 5-8) and overview-3.png do not exist; the capture of that page failed (login wall)." }],
    user_message: "OBJECTIVE: write layouts/pricing.md and the brief for the Pricing page.\nBOUNDARIES: write only run_test/_ref/acme/layouts/pricing.md and briefs/BRIEF_part-2.md.",
    looks: [{ match: "pictures|\\bls\\b|Glob", text: "overview-1.png  desktop-dark.png  mobile.png   (no overview-2.png, no overview-3.png)" }, { match: "pric|MAP|grep|cat", text: "MAP.md: Pricing = sections 7-11 (pictures/overview-2.png sections 5-8 and overview-3.png: not captured, login wall)" }],
    expect: { not_calls: [{ tool: "Write", match: "pricing" }], text_has: ["(cannot see|can't see|no picture|missing|login|NEEDS_PARENT:)"] } }),
  l({ id: "lk_copy_asks_continue_it", about: "a copy of itself replied NEEDS_PARENT: it answers by continuing THAT copy", tags: ["loop"],
    stuff: [{ title: "copy lookup#2 result", text: "NEEDS_PARENT: the Careers page has a job board in the picture; do you want a list of 6 fake jobs or an empty state?" }],
    looks: [{ match: "agents_list", text: "lookup#2 [lookup] waiting for its parent (asked: Careers job board, 6 fake jobs or empty state?)" }],
    user_message: "(lookup#2 replied)",
    expect: { calls: [{ tool: "Bash", match: "delegate.*--session[ =]*lookup#2" }], not_calls: [{ tool: "Bash", match: "fork_all" }] } }),
];
