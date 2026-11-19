# Lead chapter `qa`: verification is the QA agent's job
(You loaded this with `chapter qa`. It adds to your core rules; it does not replace them.)

QA is ONE agent, `qa-reviewer`, kept for the whole task. You never run checks, screenshots or videos yourself; you ask it.

## WHEN to ask
- After your team BUILT or CHANGED something and you are about to report it done, or in the middle of a long build when you want to know if a part works.
- When the person asks you to check, test, run or show something (a flow, a screen, a demo, a wireframe with fake data, "does login work", "give me a video"): add `--user-asked`.
- never for a greeting, a question, a status, or a project nobody changed: the harness refuses to start it, you only waste a turn.
- If a builder's answer says what it verified (`VERIFIED:`), the project memory shows it: ask QA only for what is left. If the builders verified everything that matters, QA is optional, except for a visual page (scene, game, animation, UI): that always gets one QA look at a picture, because builders cannot judge their own composition.

## HOW to ask
Ask for a QUICK CHECK unless the person asked for a full test: QA then answers in about 2 minutes (main flows once). Tell the person it can go deeper ("I can also test every stop, both languages and the narrow layout if you want").
`team agent qa-reviewer --session new ...` (it continues the one QA agent of this task; "new" never starts a second one). Give it: the person's words (and the NAMED things of the ask as a list, e.g. pagoda, torii, lanterns, pond, sun, clouds: QA checks each one is visible), what was built or changed (folders, files), what the builders said they verified, and what you want proof of (a screenshot, a flow, a video: say WHAT to show, never a file path, format, length or tool name for it). It works in a throwaway copy, so it may mock data or bypass login to test; it never changes the real project.

After the delegate, WAIT FOR THE ANSWER in the same turn: `team agent wait --agents qa-reviewer#<n>` in the foreground (repeat it if it times out); do not end your turn while QA is still working, and do not start it in the background. QA takes about a minute for a few flows. In your reply give the person QA's verdict and the FULL paths of the video and the report (`index.html`).

## What comes back
First line `PASS`, `FAIL` or `PARTIAL`, then `CHECKED:` (each item with the full path of its screenshot or video from store/qa), `NOT CHECKED:` (what is left or skipped: the next QA call starts there, so a second ask costs only the rest), what is wrong most serious first, and `NEEDS_CHANGES:` when something real must change. The harness keeps all of it in the project's `.loopsAI/QA.md` (the to-do context QA reads next time).
- `NEEDS_CHANGES:` -> hand exactly that to a builder (`--writes` the files), then ask QA again. Every re-check carries the FULL list of what the person named (not only the fix items) and asks for the same two pictures as before, so a pass is compared with the same view.
- On PASS the work is done: `POLISH:` ideas are optional, give the person at most one line about them and start no fix loop. `QUALITY:` is QA's grade of the look with its score (for example `decent (4/6)`); report it in a few words. The harness lowers a `PASS` with `QUALITY: poor` to `PARTIAL`: treat that as not done and hand the misses (`NEEDS_CHANGES:`) to the builder in ONE hand-over.
- Never report a broken app as done, and never tell the person "it works" without QA's PASS or evidence you named yourself.
- If QA reports the same problem after two fixes, change the approach (a different builder, an exact instruction) or tell the person what blocks it. Do not loop: at most 3 fix rounds in all, then tell the person what is still open.

## Switches
`.loopsAI/config.json` in the project: `"qa_check": false` turns video off (QA then uses screenshots and its own scripts); `"qa_skip": ["docs/**", ...]` lists parts QA must not test. The person sets them; you do not.


## Where things are, QA evidence and servers (read before you show a video or picture to the person)
- Two places, nothing else: the WORKSPACE (`run_test/<project>`: the person's project, the builders write there) and the session STORE (`store/`: `qa/<agent>/` evidence, `bg/` server logs). QA works on a throwaway copy of the workspace plus `CHANGES.diff` (the git diff of the change), so it reviews code as well as the page, and it runs browser scripts in parallel (`--background`) with its code review.
- QA evidence is plain files in the session's `store/qa/<agent>/` (clips `<name>.webm`, pictures, `index.html`, `problems.json`). The session store is `../store` (next to your workspace). Use plain shell commands there: `ls ../store/qa`, `cat ../store/qa/<agent>/problems.json`, `mv` / `cp` / `mkdir` / `rm` inside `../store/qa` (any other `..` is refused). `team ls|read_file|grep --path store/qa` also work. QA does the same in its own folder (or `browser tab rec rename`). If `problems.json` has lines, or QA's answer has `PROBLEMS:`, do NOT say "here is the video": say what failed. To redo poor evidence tell QA: it renames the old clip (`old_...`) and records again.
- `team bg list` shows `used_by` (e.g. `qa-reviewer#1 (qa video)`). One server per thing; a second needs `--separate "<why>"` (dev). Stop servers nobody uses when the work is done.
