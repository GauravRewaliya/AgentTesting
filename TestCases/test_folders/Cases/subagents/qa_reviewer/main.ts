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

// Lessons of the real sakura sessions (2026-11-18), as small pages: what QA records and photographs, and a fault only the LOOK shows.
const PAGE_SPIN = `<!doctype html><html><head><meta charset="utf-8"><title>Spinner</title><style>body{font:16px system-ui;background:#fff;color:#111;transition:.2s}body.dark{background:#111;color:#eee}#spin{width:90px;height:90px;margin:30px;background:#e0457b;animation:r 3s linear infinite}@keyframes r{to{transform:rotate(360deg)}}button{padding:8px 14px;margin:4px}</style></head>
<body><h1>Spinner</h1><div id="spin"></div><button id="theme">Dark mode</button><button id="pause">Pause spin</button><p id="state">spinning</p>
<script>theme.onclick=()=>document.body.classList.toggle("dark");pause.onclick=()=>{const p=spin.style.animationPlayState==="paused";spin.style.animationPlayState=p?"running":"paused";state.textContent=p?"spinning":"paused"}</script></body></html>
`;
const PAGE_UNREADABLE = `<!doctype html><html><head><meta charset="utf-8"><title>Welcome</title><style>body{background:#f4f4f4;font:18px system-ui}.card{max-width:420px;margin:40px auto;padding:24px;background:#f6f6f6;border-radius:8px}.card p{color:#f1f1f1}button{padding:8px 14px}</style></head>
<body><div class="card"><h1 style="color:#f2f2f2">Welcome back</h1><p>Your dashboard has 3 new messages and 2 tasks due today.</p><button id="go">Open dashboard</button></div>
<script>document.getElementById("go").onclick=()=>{document.querySelector("p").textContent="Opening..."}</script></body></html>
`;   // runs with NO console error and the button works, but the text is near-white on near-white: only a QA that LOOKS can see it
const QA_BOUND = { expect: "plain", budget: { total_s: 220, qa_s: 140, qa_calls: 11, videos: 1, pictures: 2, cost_usd: 0.45 } } as const;

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
  {
    ...subCase("qa-reviewer", {
      id: "sq_demo_video_pictures_only_necessary", title: "a demo video is asked of a page with a spinning square and a dark-mode button: ONE report, ONE video, only the pictures it must look at (main view, dark look), NONE of the spinning",
      seed: { "qa-demo/index.html": PAGE_SPIN },
      task: "Verify run_test/qa-demo/index.html: the square spins, the 'Dark mode' button switches the page to dark, 'Pause spin' stops the spinning and the text says 'paused'. Record ONE demo video of it. Also say if it looks right.",
      must: "PASS. ONE browser script with --video holds the whole flow (no second recording, no --out name, no ffmpeg or conversion, no sleep loop). Pictures: the main view and, because the dark mode changes the look, the dark look: at most TWO, each looked at (Read). NO picture of the spinning or of the paused state, and none named 'later' / 'rotation' / 'motion': motion is what the video is for. The answer says where the ONE video is. Bounded by the audit: 140 s of QA, 11 tool calls, ONE video, 2 pictures.",
      cap: 0.5,
    }),
    audit: QA_BOUND,
  },
  {
    ...subCase("qa-reviewer", {
      id: "sq_look_only_fault_is_flagged", title: "no console error and every button works, but the text is near-white on near-white: only LOOKING shows it, so QA must flag it as unreadable / low quality",
      seed: { "qa-demo/index.html": PAGE_UNREADABLE },
      task: "Verify run_test/qa-demo/index.html: a 'Welcome back' card, the button 'Open dashboard' changes the message to 'Opening...'. Judge the quality too: is it readable and professional? Record ONE short demo video.",
      must: "The button works and the console is clean, so a QA that only runs DOM checks says PASS: that is the failure. A QA that LOOKS (one picture of the main view, looked at with Read) sees the card text is nearly invisible: it says FAIL (or NEEDS_CHANGES / PARTIAL that clearly says so), names the low contrast (the card text and heading are near-white on a near-white card), MENTIONS low quality, points at the style rule (.card p / the h1 colour) and does NOT say PASS. Same bounds: ONE video, at most 2 pictures, no ffmpeg, no sleep loop.",
      cap: 0.5,
    }),
    audit: QA_BOUND,
  },
];
