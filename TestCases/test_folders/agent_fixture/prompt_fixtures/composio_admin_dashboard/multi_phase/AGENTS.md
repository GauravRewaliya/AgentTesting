# AGENTS.md (short; each line earned by a failure)
- Start: read the plan's `README.md` (Build recipe) and the `Next up` of `PHASES.md`, then ONLY the files your task lists (`reads` in `tasks.json`, or the brief/screen page named in PHASES).
- Edit only the files of your task. Never `index.html`, `css/kit.css`, `js/kit.js`.
- Never write "TODO", "coming soon", lorem ipsum.
- Check before you report: `proto_check --dir run_test/agentdeck` (and `node --check <file>` on your js: session smwf52sw8 shipped a syntax error that blanked Logs).
- Do not mark `passes`; the evaluator does. On a failed check retry max 2, then set `blocked`.
- End: one line in `progress.md`, commit.
