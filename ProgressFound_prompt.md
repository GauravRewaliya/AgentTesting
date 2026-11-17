# Prompt: write ProgressAndFound.md for a project

Copy everything below the line into an agent. It produces a shareable "what went wrong, what we decided, how we fixed it" file from the project's own history.

---

You are writing `ProgressAndFound.md` for the project in the current directory. It is a lessons-learned and pitfalls file that a team WITHOUT access to this project can read and use to avoid the same failures. Work from evidence, not from memory or guesses.

## 1. Read first (all of it, before writing)
- Git history: every commit message BODY, not only the subject (`git log --format='%h %s%n%b'`). Note commit ids you may cite.
- All docs: README files, findings and run reports, TODO / roadmap, decision notes, QA and incident notes, anything named *findings*, *issues*, *progress*, *todo*, *notes*.
- The tests: list every test case and its title, and what it expects (pass / fail, positive / negative).
- Run logs or reports if they exist (timings, costs, failures).
Keep a private list of every distinct issue you meet: what happened, the cause, the fix, the status. If a fact is not in these sources, it does not go in the file.

## 2. What to extract
For every real problem found, keep four things: what went wrong (with the real number if there is one: minutes lost, cost, count), why it happened, what we decided or fixed, and whether it is fixed, proposed or still open. Also keep the edge cases (odd situations that broke things) and the decisions with their reason.

## 3. Output files
- `ProgressAndFound.md` for the team. General language only.
- `ProgressAndFound_internal.md` for the project only: doc links, real command and file names, project-specific TODO phases, open points. Do not send this one.

## 4. Structure of ProgressAndFound.md
Use three parts, each starting with a `#` heading. Inside, use a plain tree, not `##` headings:
`|- topic`, `|-- issue: ...`, `|--- a> solution ...`. One line per point, short, concrete.

1. `# Progress and Found`
   - Two lines of intro, a glossary ("Words used") for every term a stranger would not know, and an index.
   - "Edge cases found and fixed (quick list)": one line each, `problem -> fix`, with the real number where you have it. This goes at the top so a reader gets the whole story in 30 seconds.
   - Then one numbered topic per theme (for example: why the design changed, parallel work and conflicts, stuck or slow work, QA, cost, context size, planning, sandbox). Under each: `issue:` then `a>` solutions, plus `decision:` where a choice was made and why.
   - Last: "Lessons in one line each".
2. `# Test Cases`
   - Write the pitfalls as checks, grouped by topic. Start each group with `pitfall:` (the hole we fell into, or that most teams fall into).
   - Under it, `+ve:` (must happen) and `-ve:` (must be caught). Under every `-ve:` add `why:` (what really went wrong) and `fix:` (what we did).
   - Cover both what works and what fails. Do not list only successes.
3. `# Features`
   - Things the user can do while the system works (check progress, talk to it, update context, pause, stop, change their mind), each marked `(built)` or `(proposed)`.

## 5. Rules for general language
- No internal case ids, file paths, command names, tool names or ticket numbers in the shared file. Say it in plain words ("start all copies at once", not the command). Put the real names in the internal file with a small mapping table.
- No status tags like `[covered]`, `[fixed]`, `[open]`. Say it in words: "built", "proposed", "not built".
- Define a term the first time or in the glossary.
- Do not explain the test harness or how the tests are implemented. Only what the case checks and why it matters.

## 6. Honesty rules
- Mark anything decided but not built as `(proposed)`. Never write a proposal as if it exists.
- Never invent a number, a cause or a fix. If the sources do not say, write "cause not proven" or leave it out.
- Keep the user's own wording for incidents they describe. If the docs describe the same incident differently, keep the user's version and tell the user about the difference in your final message.
- Separate what you verified (read in a source, saw in a log) from what you assume. Say which is which in your final message.

## 7. Quality check before you finish
- Every issue has a cause or a fix, not just a complaint.
- Every `-ve:` case has `why:` and `fix:`.
- The edge-case list at the top matches the topics below.
- No leftover internal names (search the file for command names, paths, case ids).
- No duplicate lines (the index and the headings may repeat, nothing else).
- A stranger can read it top to bottom without opening any other file.

## 8. Final message to the user
Give: the two file paths, how many issues, edge cases and test cases you wrote, what you could not verify, and every place where the sources disagreed with what the user said.
