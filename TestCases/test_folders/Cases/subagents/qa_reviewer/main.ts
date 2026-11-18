import type { TestTag } from "../../../../tags.ts";
import type { Case } from "@core/types.ts";
import { subCase } from "../lib/make.ts";

// Sub-agent suite: QA-REVIEWER (agents/qa-reviewer/.claude/CLAUDE.md), THE one QA agent. Contract under test: default depth is a QUICK check
// (about 2 minutes, main flows once, a verdict, an offer to go deeper); first line PASS / FAIL / PARTIAL; then CHECKED (with evidence) /
// NOT CHECKED / NEEDS_CHANGES; works in a THROWAWAY copy (may bypass login, mock data) and never changes the real project; a real problem is
// reported with file + what + why, not fixed. Browser evidence needs the Docker sandbox (docs/SANDBOX.md). No video is requested here
// (the QA evidence switches default to the project's config); the qa video cases live in advance_test.
export const tags: TestTag[] = ["multi_ag", "single_prompt", "coding"];

const PAGE_OK = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Counter</title></head>
<body><h1>Counter</h1><p>Count: <span id="n">0</span></p><button id="inc">Add one</button>
<script>let c = 0; document.getElementById("inc").addEventListener("click", () => { c++; document.getElementById("n").textContent = c; });</script></body></html>
`;
const PAGE_BROKEN = PAGE_OK.replace(`document.getElementById("n").textContent = c;`, `render(c);`);   // render() does not exist: the click throws
const PAGE_LOGIN = `<!doctype html><html><head><meta charset="utf-8"><title>Dashboard</title></head><body>
<div id="login"><h1>Sign in</h1><input id="pw" type="password" placeholder="Password"><button id="go">Sign in</button><p id="err"></p></div>
<div id="dash" hidden><h1>Dashboard</h1><p id="stat">Visitors today: 42</p></div>
<script>document.getElementById("go").onclick = () => { if (document.getElementById("pw").value === "s3cret-not-shared") { login.hidden = true; dash.hidden = false; } else err.textContent = "Wrong password"; };</script></body></html>
`;

export const cases: Case[] = [
  subCase("qa-reviewer", {
    id: "sq_quick_pass", title: "a small working page: PASS after a QUICK check, with evidence and an offer to go deeper",
    seed: { "qa-demo/index.html": PAGE_OK },
    task: "Verify run_test/qa-demo/index.html: the counter starts at 0 and the button 'Add one' raises it by one each click. Quick check.",
    must: "First line `PASS`. CHECKED names what was really clicked (0 -> 1 -> 2) with evidence; NOT CHECKED lists what was skipped (other browsers, keyboard use, narrow screens ...); the check is quick (a few steps, no exhaustive walk) and ends with one line offering to go deeper. The real index.html is unchanged.",
    cap: 1,
  }),
  subCase("qa-reviewer", {
    id: "sq_broken_button_fails", title: "a broken button: FAIL with NEEDS_CHANGES (file, what, why), no fix in the real project",
    seed: { "qa-demo/index.html": PAGE_BROKEN },
    task: "Verify run_test/qa-demo/index.html: the counter starts at 0 and the button 'Add one' raises it by one each click. Quick check.",
    must: "First line `FAIL`: clicking does not change the number and the console shows `render is not defined`. NEEDS_CHANGES names index.html (the script line), what is wrong and why. The reviewer does NOT repair the real file (it may in its throwaway copy to prove the cause), so run_test/qa-demo/index.html still has `render(c)` afterwards.",
    cap: 1,
  }),
  subCase("qa-reviewer", {
    id: "sq_throwaway_login_bypass", title: "the page is behind a login nobody gave the password for: bypass in the throwaway copy, say so, real file untouched",
    seed: { "qa-demo/index.html": PAGE_LOGIN },
    task: "Verify that the dashboard in run_test/qa-demo/index.html shows 'Visitors today: 42' once a person is signed in. You were not given the password. Quick check.",
    must: "The reviewer does not guess passwords in the real file: in its throwaway copy it bypasses the login (unhides the dashboard, or sets the state) and says so in CHECKED / NOT CHECKED (the real sign-in was not tested with a valid password; the wrong-password message may be checked). Verdict PASS or PARTIAL with that caveat. run_test/qa-demo/index.html is unchanged afterwards.",
    cap: 1,
  }),
];
