# Progress and Found
What we learned running a multi agent setup: a main agent (master) that hands work to sub agents.
Format: found -> |- issue -> |-- a> solution. "(proposed)" = decided but not built yet. Money and time numbers are from real runs.
Three parts: Progress and Found (what went wrong and how we fixed it) | Test Cases (the pitfalls as +ve / -ve checks) | Features (what the person can do while the team works).

Words used
|- master = the main agent: plans, hands out work, judges, reports (does not build)
|- sub agent = an agent the master calls (builder, planner, reviewer, ...)
|- hand-over = the message the master gives a sub agent: what to do, which files, the rules, WHY
|- session = an agent's memory. New = empty, continue = same memory, fork = a copy of another agent's memory
|- lock = a claim on a file so two agents do not write it at once
|- background job = a long command (dev server, build) that runs on its own while the agent keeps working
|- harness = the code around the agents: starts them, enforces limits and locks, keeps the logs
|- fork = start a new agent from a copy of another agent's memory (see session)
|- +ve / -ve = a case that must work / a failure that must be caught

Index
|- 1 Why staged -> multi agent
|- 2 Separate agents, one job each
|- 3 Parallel work and file conflicts
|- 4 Split work and sub tasks
|- 5 Sessions, same agent again, context passing
|- 6 Stuck agents and background jobs
|- 7 Browser and look-up
|- 8 QA
|- 9 Reports and cost
|- 10 Smaller context, fewer turns
|- 11 Planning
|- 12 Sandbox and package manager
|- 13 Lessons in one line each
|- Edge cases found and fixed (quick list, below)
|- then: Test Cases, Features

Edge cases found and fixed (quick list)
|- lock ran out while a builder wrote one big file, 4 min of work lost          -> lock lease 20 min
|- 4th builder refused because failed agents were counted                        -> failed agents do not count
|- forks started one after another (3 x ~110 s)                                  -> start all at once, then ONE wait
|- one builder got all 8 screens (6+ min), master gave up                        -> balanced groups, max 3 screens each
|- old heavy builders resumed for a new version ($0.35-0.68 per call)            -> fork a small base ($0.05-0.10)
|- master gave up on a builder that was still writing                            -> wait reports last tool use and run time
|- master polled every 90 s, each poll a paid turn                               -> one long wait, ends early on any event
|- second master idle 6.5 min in a hidden queue, shown as "running"              -> 3 slots + a visible "queued" state
|- agent answered but its process never exited, 8.5 min lost, work redone        -> watchdog reads the session log
|- builder ran a command and slept 10+ min                                       -> command limits + call time limit
|- master waited blindly for a tool                                              -> look at the sub agent after x min, read the job log, interrupt if needed
|- builder said "Done" on a broken app, QA said "ok" on a blank page             -> real check, exact error back, re-run after EVERY fix
|- same QA issue 3 times, master gave up                                         -> loop stops, result FAILED
|- every builder ran its own tests (n x test time)                               -> builders do not test, master tests once
|- CSS classes used but defined nowhere (51)                                     -> design kit + a quick static check
|- user asked "copy the file and delete the old one"; the reviewer got no context, called it a defect and discarded the PR -> rule: tell every fresh agent the user's intent (WHY), not only WHAT
|- master built in the workspace root, preview and QA could not see it           -> everything under one project folder
|- master turn killed at 10 min during build + QA + fix                          -> master 30 min, builder 20 min
|- master called an unlisted agent = a real model call that hid the bug          -> refuse unlisted agents
|- plan pinned a package version younger than the package manager allows          -> plan rule: no versions younger than 14 days
|- a paid "status?" question resumed a cold master ($0.5 for 6 s)                -> answer status from the board, no model call
|- cost shown missed the master's own calls; stopped calls cost 0                -> cost from all events, estimate for stopped calls
|- a trivial task ("Hi") started agents, took over a minute, far too long output   -> answer small tasks directly, no agents
|- clone-and-run failed (e.g. no Postgres) and the agent rewrote the app for SQLite and reported "done" -> must STOP and tell the master / user it is stuck (see 6)
|- master spent its start on tool calls to read context                          -> default context on top (proposed)

|- 1 Why staged -> multi agent
|-- old way (staged): fixed pipeline plan -> build -> review, always the same order, one stage after another
|--- issue: static. The user shares a ready plan, it still ran planning again
|--- issue: static. Same QA for a small copy task and for a strict project (ISO style, many checks); it could not be lighter or heavier
|--- issue: no parallel work, stages run one by one
|--- a> a master decides per task who is needed: skip planning if the plan exists, more QA when needed, parallel builders when work can split
|--- a> hard rules stay in code (gates, locks, limits); the master only chooses the path

|- 2 Separate agents, one job each (no burden on one agent)
|-- a> master = hands over, judges, reports
|-- a> planner = research (web) + writes the plan files and modifies them when asked
|-- a> builder = writes its own files, does not test, reports in 3 lines
|-- a> reviewer / QA reviewer = checks and audits
|-- a> researcher = text facts, look-up agent = how a UI looks, designer = look and design kit, project manager = phases and gates
|-- a> tools and skills are given per agent, short prompt each
|-- a> cheap model for small jobs, the stronger one for the rest
|-- why: a long prompt and many tools on one agent = slow, costly, confused; small agents = cache hits and clear hand-overs

|- 3 Parallel work and file conflicts
|-- issue: two agents change the same file (example: both edit index.html), conflicts, pull problems
|--- a> LOCK: a writer declares its files first, all or none, a queue, a lease; the second writer waits and holds nothing, so no deadlock
|--- a> PATCH: each builder works in its own copy and returns a git patch; the master reviews, merges and applies it (also for small changes, or just to check its suggestions)
|--- a> one lock store for the whole team; every lock names the agent call that holds it (file store, or Redis when atomic locking is needed)
|--- a> shared actions (git, migrations, tests) are locked as named resources so they run one at a time
|-- issue: lock lease too short           a> 20 min, same as the builder call limit
|-- issue: 4th builder refused            a> failed agents do not count

|- 4 Split work and sub tasks
|-- issue: split but not parallel                          a> start all copies at once, then ONE wait
|-- issue: split badly (one builder 8 screens, others 1)   a> balanced groups, max 3 screens per builder, up to 6 forks, separate files
|-- issue: master waits for all and polls every 90 s       a> one long wait that ends early on: done, failed, stalled, agent asks
|-- issue: next phase started before the last was good     a> phase gate in code, needs evidence
|-- issue: every builder runs its own tests               a> builders do only a syntax check; the master tests once at the end (a small job may self test)
|-- sub task: a plan is a list of tasks with owner, files, depends-on, phase; ready tasks run in waves
|-- sub task: sub agent needs something only the parent has -> it stops with one line "NEEDS_PARENT: <what>", the parent answers in the SAME session
|-- sub task: "continue / finish" = resume the unfinished work with the same agents, not a status report
|-- issue: master turn killed at 10 min              a> master 30 min, builder 20 min, one phase (~10 files) per builder call
|-- issue: project built in the workspace root       a> everything under one project folder, also in the file list

|- 5 Sessions, same agent again, context passing
|-- every call names its session: new | continue <agent> | fork <agent>; no default, so nobody resumes by accident
|--- continue = same memory, only the new part is sent; the agent never says "I do not know what you mean"
|--- fork = a copy of a finished base agent, the original stays untouched, many forks run in parallel
|--- new = clean start; the hand-over must then carry everything (files, rules, done-when, WHY)
|-- why fork: the base builder already read the plan, the shared rules and the style kit; each fork starts with that memory = cache hit
|--- measured: fork $0.05-0.10 against $0.35-0.68 for resuming an old heavy builder
|-- who the master may call
|--- the same sub agent again (fix round, follow-up question)
|--- the builder many times: separate session ids, each with its own files
|--- a new agent of a role on its list (not on the list = refused)
|--- a custom agent made on the fly for a job no role covers
|--- every call needs 3 fields: objective, output format, boundaries; a vague call is refused so agents do not repeat each other
|--- limits, always refused with a clear reason: instances per role (12), live agents per task, children per caller, depth, no cycles (a role may start copies of itself, one level), call time, budget
|-- context passing
|--- hand-over is checked by a guard; a shared context list goes in front of every builder's first prompt (same prefix = cache hit)
|--- a generated list of the style kit (class names, icons, helpers) is added to the project notes so builders do not search for them
|--- sub agent answers with a short report; the user's own settings file is not loaded (isolation)
|-- issue: a session could not be resumed from another profile    a> look in the profile that holds it
|-- issue: resuming a master days later cost $0.5 for a 6 s answer  a> simple status questions answered from the board

|- 6 Stuck agents and background jobs
|-- issue: builder runs a long command in the foreground and sleeps
|--- a> every long command has a limit (timeout 120); over 2 min or failing twice = change approach or NEEDS_PARENT; hard call limit (builder 20 min)
|-- issue: agent answered but its process never exits (8.5 min lost, work redone)
|--- a> watchdog reads the session log: finished turn + 45 s silence = done, answer taken from the log
|-- issue: master does not notice a stuck agent, or waits blindly for a tool
|--- a> after x min (5) the master looks at the sub agent: last tool use and how long ago, is it only waiting for a tool, paused or silent, held files, cost
|--- a> if it started a background job, read the END of that log (last lines): progress = keep waiting; error or nothing new = ask it or interrupt
|--- a> slow but moving is left alone; silent 5 min = stalled (master verifies its files before replacing it); 10 min = the harness stops it, frees its locks, writes a report
|-- issue: the task is blocked (user said "clone it and run it", something is missing) and the agent improvises
|--- found: no Postgres here -> "let me code it for SQLite", swapped the stack, dropped features, mocked the rest, then reported "done". All of it wrong.
|--- a> a blocker the user did not authorise = STOP: write one line "STUCK: <what failed, what was tried, what is needed>" and give it to the master; the master tells the user or decides
|--- a> never change the stack, the data store or the scope on its own; ask first
|--- a> the report separates what was VERIFIED (ran it, saw the output) from what was ASSUMED or guessed, so a reviewer can raise the PR and check quickly without digging, and a hint is never read as a fact
|-- background jobs (dev server, build, install, long tests) must not block or flood the agent
|--- a> master or sub agent starts one, the call returns at once, the harness owns the process
|--- a> one job store for the team: id, who started it, command, port, log file, exit code; status running / succeeded / failed / stopped / interrupted, so "done or not" is always known (like a live preview of a dev server)
|--- a> every job has a timeout (default 20 min, max 120, never unlimited), survives a UI restart, leftover processes are cleaned
|--- a> read it small: list running jobs, last N lines of a log, stop a job
|--- a> if the person asked for it ("give me a preview") the master may not stop it on its own
|--- a> every 10 min without a look, an automatic check goes to the master
|--- not built: a "finished" message pushed to the agent that started the job (it has to look); filtering a log by text or time (only the last lines)

|- 7 Browser and look-up
|-- issue: look-up done by the text researcher is wrong for UI work
|--- a> a separate look-up agent reads captured pictures, page outline and assets, and writes layouts and builder briefs; it may split into copies for big jobs
|-- issue: some pages need a login
|--- a> two modes: a private headless browser (default, software WebGL so 3D works) and a real browser the person logs into; agents use it only while switched ON, one tab per task, closed afterwards
|--- a> every tool says which browser was used; a login wall is reported, never cloned silently

|- 8 QA
|-- rule: QA must try to BREAK the thing first, not open a blank page and say ok
|--- a> start the app and read its log first; then the plan's flows; video only if healthy
|-- a> the master runs the check at the end, the exact error goes back to the builder, the check is re-run after EVERY fix
|-- a> same issue 3 times in a row (or master gives up) ends the loop and the result is FAILED
|-- a> a no-build prototype uses a quick static check (under 1 s) instead of the full check
|-- issue: a paid QA agent added by a plan caused an extra fix round    a> verification = free checks; a review agent only when asked
|-- issue: some projects cannot be QA tested (iOS / native only, needs GPU, needs login)
|--- a> (proposed) one decision file in the project root (`loop_ferry.json` is just the example name), read by the master and QA before anything is tested:
|          { "qa": { "is_enable": false,
|                    "notes": "iOS app: cannot be tested or previewed here",
|                    "note_file": "QATESTING.md" } }
|--- is_enable false = QA is skipped on purpose and the master says so in its report (no fake pass, no endless failing)
|--- is_enable true = notes / note_file say how to start the server, how to run the test, what to check, what to skip and why
|--- the same file can hold other decisions later (preview allowed, package manager, pinned versions); a missing file = defaults, QA on

|- 9 Reports and cost
|-- issue: no record of what the master saw when an agent misbehaved
|--- a> the master files a report (slow, silent, stalled, hung, lazy, bad output) with the session id; the harness writes one itself when it force-stops an agent
|-- issue: cost shown missed the master's own calls; stopped calls cost 0
|--- a> cost = all events; stopped and hung calls get an estimate; a project budget refuses new calls when reached
|-- not built: a report when the whole task takes longer than planned (today per agent only)

|- 10 Smaller context, fewer turns
|-- issue: master prompt 32 KB, builder 9 KB, every builder read the same files
|--- a> short core prompt + chapters read on demand (master 6.6 KB, builder 4.1 KB); shared plan context in front of every builder
|-- issue: long command paths denied again and again    a> one short command wrapper
|-- issue: a paid turn for "status?"                    a> status and slash commands answered by the harness, no model call
|-- issue: master spent its start on tool calls to read the plan
|--- a> (proposed) one default JSON lists what goes on top of its context, so no tool call and nothing blank:
|          { "prompts": ["CLAUDE.md" or "Agent.md", "TODO.md"], "context": ["plan/README.md", "plan/PHASES.md"] }
|--- builders already get such a list; the master does not yet

|- 11 Planning
|-- issue: planner invented things, plans had gaps and contradictions
|--- a> researches first; a free plan check looks at research, owners and "Done when" items
|-- issue: plan quality rules came after the audit, first pass scored 77
|--- a> quality bar written into the plan contract before the build
|-- issue: no-build prototype took 77 min
|--- a> base builder first, then parallel forks, no research first

|- 12 Sandbox and package manager
|-- a> anything that installs, builds or records runs in a throwaway container (2 GB, 1 CPU, caps dropped), never on the host
|-- a> one package manager only, shared store; the master says it in every hand-over (a builder was told "npx" once)
|-- issue: builder lost minutes studying the package age policy    a> pin an older version and move on

|- 13 Lessons in one line each
|-- free checks first, paid calls after
|-- the code enforces limits, the master only chooses the path
|-- fork instead of resume
|-- measure the real cost, the master's own calls included
|-- the master should look, not wait blindly
|-- tell every fresh agent WHY, not only WHAT


# Test Cases
Checks for any multi agent setup, written as PITFALLS: the holes we fell into, or that most teams fall into. Use them so your team does not get stuck or fail the same way.
+ve = must happen. -ve = must be caught (the pitfall itself). Details of each issue are in Progress above.
|
|- Calling agents
|-- pitfall: resuming a heavy old agent for new work, or letting the master call anything it likes
|-- +ve: a follow-up goes to the SAME sub agent and it remembers what it did
|-- +ve: a different role, or a separate task, gets a NEW session and knows nothing of the other agent's files
|-- +ve: the builder is called many times, each call with its own session id and files
|-- +ve: a job no role covers goes to a custom agent with objective, output format, boundaries
|-- -ve: old heavy builder resumed for a new version -> must fork a small base
|---  why: re-reads millions of cached tokens: $0.35-0.68 a call against $0.05-0.10 for a copy
|---  fix: fork a small base builder, never resume a heavy one
|-- -ve: role not on the list, vague call, cycle, too many children -> refused with a reason
|---  why: vague calls made agents repeat each other, loops and floods cost money
|---  fix: every call needs objective, output format, boundaries; limits refuse with a clear reason
|-- -ve: unlisted agent called -> refused, no real model call
|---  why: a real model call "fixed" the app and hid the bug the test wanted to catch
|---  fix: refuse any agent that is not on the list
|
|- Parallel work and same-file conflict
|-- pitfall: two agents on one file with no lock, a lock that expires mid-write, forks started one by one
|-- +ve: two writers want index.html -> one gets the lock, the other waits and holds nothing
|-- +ve: A wants x,y and B wants y,x -> no deadlock
|-- +ve: overlapping paths conflict, different paths do not
|-- +ve: a small change returns as a git patch, the master merges and applies it
|-- -ve: lock expires during one long write
|---  why: lease was 2 min; a long silent write lost it and 4 min of work
|---  fix: lease 20 min (same as the builder call limit), renewed on activity
|-- -ve: forks run one after another
|---  why: master delegated each fork alone: 3 x ~110 s in a row
|---  fix: one command starts all copies at once, then ONE wait
|-- -ve: master puts two builders on one file with no split
|---  why: two writers overwrite each other, or one waits for the other
|---  fix: lock (second writer waits, holds nothing); master splits files first
|
|- Hand-over and context
|-- pitfall: the master says WHAT but not WHY, so a fresh agent "fixes" the wrong thing or invents a result
|-- +ve: a user constraint ("read-only", "do not touch X") reaches the sub agent
|-- +ve: a follow-up that refers to the earlier answer ("the first two you listed") works
|-- +ve: after an approved plan the hand-over carries requirements, plan and examples
|-- -ve: hand-over says WHAT but not WHY (user asked "copy it and delete the old one", reviewer had no context and rejected the PR)
|---  why: the reviewer saw only the diff, took the copy / delete for a defect and discarded the PR
|---  fix: tell every fresh agent the user's intent, not only the task
|-- -ve: sub agent fails -> master reports it honestly, never invents a result
|
|- Planning
|-- pitfall: a plan made without research, or a plan whose quality rules come after the audit
|-- +ve: plan first, show it, wait for approval, then build with the plan handed over
|-- +ve: the plan stands alone, a builder can build from it
|-- +ve: planner writes the plan and edits it again after feedback
|-- -ve: planner invents instead of researching
|---  why: first plan runs had no research at all, everything was invented
|---  fix: a free plan check fails a plan without real sources
|-- -ve: plan contradicts itself or states its quality rules too late
|---  why: quality rules sat in a task after the audit: first pass scored 77 and all builders were resumed for a fix round
|---  fix: quality bar written into the plan contract before the build
|
|- Builder
|-- pitfall: one builder gets everything, or every builder runs its own tests
|-- +ve: master only delegates and judges
|-- +ve: build -> fresh review -> fix; if the reviewer approves the master STOPS
|-- +ve: a big job is split into balanced parallel builders
|-- -ve: one builder gets all screens
|---  why: one builder wrote 8 screens for 6+ min and the master gave up waiting
|---  fix: plan balances the groups: max 3 screens per builder, separate files
|-- -ve: every builder runs its own tests
|---  why: test time multiplied by the number of builders
|---  fix: builders do only a quick syntax check; the master tests once at the end
|
|- QA
|-- pitfall: "Done" or "ok" on a blank or broken page, QA run on a project that cannot be tested, no re-check after a fix
|-- +ve: broken app -> check finds it -> exact error to the builder -> fix -> check again -> honest report
|-- +ve: bug fixed meanwhile -> the quick check passes
|-- +ve: (proposed) is_enable false in the project decision file -> QA skipped on purpose, reason in the report
|-- +ve: (proposed) is_enable true with notes / note_file -> QA follows them
|-- -ve: builder says "Done" but the app does not build
|---  why: "Done" was taken at face value; type errors were already there
|---  fix: master runs the real check and hands the exact error back
|-- -ve: the fix never works -> loop stops, FAILED, never "works now"
|---  why: master judged by reading files and never re-ran the check; it gave up honestly but the loop stayed open
|---  fix: re-run the check after EVERY fix; same issue 3 times in a row ends the loop as FAILED
|-- -ve: QA says "working" but missed the bug, or reports it with poor info
|---  why: QA claimed fine, or named the bug without detail
|---  fix: keep the failed cases as negative cases, so QA is proven to catch the error
|-- -ve: blank page or an error in the log counted as ok
|---  why: a page can load and still be blank or throw an error
|---  fix: start the app and read its log, not only open the page; blank page or error = FAIL
|-- -ve: iOS / native project tested anyway -> false FAIL
|---  why: native-only apps cannot run on the web: minutes wasted and a false FAIL
|---  fix: (proposed) project decision file with qa.is_enable false and a note
|
|- Right size of the work
|-- pitfall: a small question starts a whole team (slow and costly)
|-- +ve: a trivial or short question ("Hi", "task size: short") is answered directly, zero agents called
|-- +ve: a minor question after a build does NOT call any sub agent, even if a planner and a researcher are available
|-- +ve: a long task is classified first, only the planner is called, the plan is returned, then the master waits for approval
|-- -ve: a small task starts a whole team
|---  why: a "Hi" took over a minute and produced far too long an answer
|---  fix: answer small tasks directly, no agents
|
|- The person stays in control
|-- pitfall: writing after a "no", ignoring a cancel or a correction, or asking for a confirmation nobody wanted
|-- +ve: "show me first": the master shows the content, and after the OK writes exactly that content
|-- +ve: the person asks for a change after seeing it: the written file has the change
|-- +ve: the person declines: nothing is written
|-- +ve: no "show first" in the request: the master just does the work
|-- +ve: the person cancels mid-run: the master stops its agents and says what was left undone
|-- +ve: the person sends a correction while an agent is running: it reaches that agent (steer)
|-- -ve: the master asks for confirmation nobody wanted, or writes after a "no"
|---  why: extra questions waste the person's time; writing after a "no" breaks trust
|---  fix: "show first" only when asked; a decline means nothing is written
|-- -ve: an agent decides alone when the request and the plan conflict -> it goes to the person
|---  why: a silent choice can undo what the person asked for
|---  fix: conflicts go to the person, not to a build
|
|- Safety
|-- pitfall: secrets in a hand-over, a reviewer without context that rejects or undoes the user's wanted change, an endless fix loop, no cost cap
|-- +ve: a cost cap is reached: no further agent is started, the master says so
|-- +ve: secrets (.env, keys) never appear in a hand-over
|-- +ve: protected paths cannot be deleted by an agent
|-- +ve: a failing automatic check beats a reviewer who says "looks good"
|-- -ve: a reviewer without context rejects the user's change (a copy, a move, a rename) and the master sends the builder to undo it -> the reviewer must be told the intent first
|---  why: the reviewer did not know the intent, so the user's wanted change looked wrong
|---  fix: the master gives the reviewer the intent first; it never sends the builder to undo the user's change on a blind review
|-- -ve: the same finding comes back twice, or the max number of rounds is reached -> stop and report, no endless loop
|---  why: fix and review ping-pong forever and burn money
|---  fix: same finding twice or max rounds = stop and report to the person
|
|- Retry
|-- pitfall: retrying with a bare copy of the task, or retrying forever
|-- +ve: a failed sub agent is retried once with the SAME hand-over plus the error, not a bare copy
|-- -ve: retry loses the original context, or retries forever
|---  why: a bare copy of the task repeats the same mistake
|---  fix: retry once with the same hand-over plus the error
|
|- Blocked task: stop, do not improvise
|-- pitfall: the agent hits a blocker and quietly "solves" it by changing what the user asked for
|-- +ve: user says "clone it and run it", it fails (missing database, missing key, wrong version) -> the agent STOPS and reports STUCK: what failed, what it tried, what it needs
|-- +ve: the master receives it and tells the user, or decides, then continues the same agent
|-- +ve: the final report marks each claim as verified (ran, saw output) or assumed
|-- -ve: "I do not have Postgres, let me code it for SQLite" and carries on
|---  why: the agent swapped the stack on its own and reported "done"
|---  fix: stop and report STUCK to the master
|-- -ve: it mocks, drops a feature or swaps the stack and says "done"
|-- -ve: a guess is written as a fact, so the PR looks fine and breaks later
|
|- Browser and look-up
|-- pitfall: a text agent used for a visual job, or a page behind a login "cloned" from its login screen
|-- +ve: UI look-up is done by an agent that looks at pictures and the page outline, not by a text-only researcher
|-- +ve: a page that needs a login is reported as such, or opened in a real browser the person logged into
|-- -ve: the login wall is silently treated as the page and cloned
|---  why: a headless browser sees only the login screen
|---  fix: report the login wall; use the real browser the person logged into
|-- -ve: the real browser is used without the person switching it on
|---  why: it holds the person's logins
|---  fix: agents use it only while switched ON, one tab per task, closed afterwards
|
|- Sandbox and package manager
|-- pitfall: installing on the host, mixing package managers, pinning a version too new to install
|-- +ve: install, build and record run in a throwaway container
|-- +ve: every hand-over names the one package manager to use
|-- -ve: a builder runs npm or npx when the project uses another one
|---  why: a builder was told "npx" by the master once
|---  fix: every hand-over names the one package manager
|-- -ve: a plan pins a version younger than the package manager's age rule -> install fails after the build looked fine
|---  why: about 7 min and two extra rounds lost on an install refused for a too-new version
|---  fix: plan rule: no version younger than 14 days; same age policy on host and container
|
|- Stuck and background
|-- pitfall: waiting blindly for a tool or a hung process, or stopping an agent that is only slow
|-- +ve: after x min the master looks at the sub agent instead of waiting blindly
|-- +ve: a background job's log is read from the end; error or no news -> ask or interrupt; progress -> keep waiting
|-- +ve: finished agent whose process never exits is taken as done
|-- -ve: master waits blind 10+ min, or polls every 90 s
|---  why: it waited without knowing, or polled and paid a turn each time
|---  fix: look at the sub agent after x min, read the end of its job log, interrupt if needed; one long wait that ends on events
|-- -ve: master stops an agent that is still moving
|---  why: the master gave up after "3 waits in a row" while the builder was still writing
|---  fix: stop only after 5 min without any tool use, and verify its files first
|
|- Report and cost
|-- pitfall: cost that leaves out the master, a slow task nobody reports
|-- +ve: a misbehaving agent is reported with its session id
|-- +ve: cost includes the master's own and stopped calls
|-- -ve: a task runs longer than planned and nobody says so
|---  why: only per-agent slowness is flagged today
|---  fix: (not built) a report for the whole task with the reason
|
|- Start of the master
|-- pitfall: the first minutes lost on tool calls that only read context
|-- +ve: (proposed) the default context is already on top, the first call is the hand-over
|-- -ve: the first minutes go to reading files with tool calls
|---  why: the master read the plan with many tool calls before it did anything
|---  fix: (proposed) default context on top, so the first call is the hand-over
|-- -ve: a denied shell command with no known reason -> log the exact command
|---  why: the master's shell was sometimes denied in "don't ask" mode; the cause was never proven
|---  fix: log the exact denied command if it happens again


# Features
Things the person can do while the team is working. "(built)" = exists today (taken from the docs, not re-tested for this report). "(proposed)" = decided, not built yet.
|
|- Talk to the master while sub agents are busy
|-- the master is free after it hands out work, so the person can chat with it at any time
|-- ask "what is running?" and get the answer from the board, with no model call and no cost (built: status and slash commands for the person at the console)
|-- ask for more detail: which agents are alive, what each did last, how long ago, which files it holds, cost so far (built: peek, agents, plan, cost, background jobs)
|-- a normal chat message (not a command) reaches the master, which may use a paid turn to answer
|
|- Update the context of a running agent
|-- the person tells the master something new ("use blue, not green", "skip the footer")
|-- the master passes it on to the right sub agent(s) as a short message, not a new task (built: say / inbox)
|-- a running agent sees the message when it next reads its inbox, so it is not instant (to verify per case)
|-- if it is a big change, the master pauses the work, updates the plan or hand-over, then continues
|
|- Pause, stop, change of mind (the stakeholder changed the mind)
|-- pause: the master stops handing out new work (built: pause / resume; what a running agent does at that moment is to verify)
|-- stop: interrupt one agent or all; the aim is that files and sessions are kept so nothing is lost (built: stop; to verify)
|-- interrupt + message + correct: stop the agent, tell it what changed, continue it in the SAME session so it keeps its memory (proposed as one flow)
|-- "never mind": the master gets the new message and continues each sub agent where it stopped, no restart, no redo (proposed as one flow)
|-- the master reports what was stopped, what was finished and what is left undone
|
|- Check progress and activity any time
|-- per agent: last tool call, silence in seconds, files held, cost, a hint (wait / answer / nudge / stop) (built: peek)
|-- background jobs: running or done, who started them, the end of their log (built)
|-- whole team: which phase, which tasks are done, what is waiting (built: plan status, phase status)
|-- the UI shows the same live over one connection, no polling (built)
|
|- Checks for these features
|-- +ve: status asked during a build -> answered at once from the board, no agent disturbed
|-- +ve: correction sent to a running agent -> it uses it (or the master restarts that part with the new context)
|-- +ve: pause -> nothing new starts; resume -> work continues from where it stopped
|-- +ve: stop, then "never mind" -> the same agents continue in their own sessions
|-- -ve: a correction is lost because the agent never reads its inbox
|-- -ve: stop kills an agent and its files are lost or redone
|-- -ve: "status?" resumes a cold master and costs money
