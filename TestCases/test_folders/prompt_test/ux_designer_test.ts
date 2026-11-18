// ux_designer_test: the UX DESIGNER. Pitfalls: extra features, app code in a spec, the wrong file, exact labels lost, asking permission for what was asked.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PromptCase } from "./types.ts";

const u = (o: Omit<PromptCase, "flag" | "agent">): PromptCase => ({ flag: "prompt_testing", agent: "ux-designer", ...o });


// The requirement texts below are the REAL plans in agent_fixture/prompt_fixtures (their feature catalogs), read at load time: eiffel (a 3D exhibit with a guided tour), composio (a 10-screen dashboard).
const FX = join(import.meta.dir, "..", "agent_fixture", "prompt_fixtures");
const catalog = (plan: string, n = 1900): string => { try { const t = readFileSync(join(FX, plan, "README.md"), "utf8"), i = t.indexOf("## What you get"); const j = t.indexOf("\n## ", i + 5); return t.slice(i, j > 0 ? j : i + n).slice(0, n); } catch { return "(fixture missing)"; } };
const HABIT = "# Habit tracker (phone web app)\nA person keeps a few daily habits and sees their streaks.\n| id | feature | what you see |\n|---|---|---|\n| F1 | Today | the list of today's habits, a tick for each |\n| F2 | Add habit | a name and a time of day; Save |\n| F3 | Streak | the number of days in a row per habit |\n| F4 | Week | seven dots per habit, filled when done |\nNot in scope: accounts, sharing, reminders.\n";
const WORLD = { "run_test/plan/README.md": HABIT };
const OUT = "run_test/plan/02_ux/";
const NOCODE = { tool: "Write", match: "\\.(ts|tsx|vue|jsx)\\\"" };

export const cases: PromptCase[] = [
  u({ id: "ux_writes_spec_to_named_file", about: "the spec is markdown in the file it was told to write, not code and not another file",
    user_message: "OBJECTIVE: write the UX spec for ONE screen: a Login screen (email, password, a 'Sign in' button, an error state for a wrong password).\nOUTPUT FORMAT: markdown in run_test/plan/login_ux.md.\nBOUNDARIES: this screen only; no code.",
    expect: { calls: [{ tool: "Write", match: "run_test/plan/login_ux\\.md" }], not_calls: [{ tool: "Write", match: "\\.(js|ts|vue|css|html)\"" }] } }),
  u({ id: "ux_2_one_screen_no_extras", about: "one screen asked: the spec covers that screen only (no settings, profile, onboarding), no code",
    why: "design what was asked; do not add features (this case no longer follows the first one: that one had already written the file, so a second write was never right)",
    user_message: "OBJECTIVE: write the UX spec for ONE screen: a Login screen (email, password, a 'Sign in' button, an error state for a wrong password).\nOUTPUT FORMAT: markdown in run_test/plan/login_ux.md.\nBOUNDARIES: this screen only; no code.",
    expect: { calls: [{ tool: "Write", match: "login_ux\\.md" }], not_calls: [{ tool: "Write", match: "(settings|profile|onboarding|dashboard screen)" }, { tool: "Write", match: "```(js|javascript|ts|tsx|html|css|vue)" }] } }),
  u({ id: "ux_exact_labels_kept", about: "the exact label wording it was given ends up in the spec",
    user_message: "OBJECTIVE: write the UX spec for the Login screen.\nOUTPUT FORMAT: markdown in run_test/plan/login_ux.md.\nBOUNDARIES: use EXACTLY these labels: button 'Sign in', link 'Forgot password?', error 'That email and password do not match.'",
    expect: { calls: [{ tool: "Write", match: "Sign in", each: ["Forgot password\\?", "That email and password do not match\\."] }] } }),
  u({ id: "ux_report_line", about: "it finishes with the REPORT line listing the file", after: "ux_2_one_screen_no_extras",
    stuff: [{ title: "your write", text: "Wrote run_test/plan/login_ux.md (86 lines)." }], user_message: "(go on)",
    expect: { no_calls: true, text_has: ["REPORT:\\s*\\{.*login_ux\\.md"] } }),
  u({ id: "ux_refused_tool_needs_parent", about: "a refused tool is not worked around: NEEDS_PARENT with the exact command",
    stuff: [{ title: "your write", text: "Write run_test/plan/login_ux.md -> refused: path is outside the files you may write (you may write run_test/plan/ux/)." }],
    user_message: "OBJECTIVE: write the UX spec for the Login screen into run_test/plan/login_ux.md.",
    expect: { text_has: ["NEEDS_PARENT:", "login_ux\\.md"], not_calls: [{ tool: "Bash", match: "(cp|mv|tee|>)" }, { tool: "Write", match: "(?!.*login_ux)" }] } }),
  u({ id: "ux_literal_task_just_do_it", about: "a literal, clear task is done without asking permission",
    user_message: "OBJECTIVE: write the single line `# Login screen spec` into run_test/plan/login_ux.md.",
    expect: { calls: [{ tool: "Write", match: "# Login screen spec" }], text_not: ["NEEDS_PARENT:", "(shall I|may I|do you want me)"] } }),

  // ---- the flow of a designer: look -> flow -> themes -> ONE page (themes on top, clickable prototype below) -> report. One design unless asked for more.
  u({ id: "ux_f1_looks_at_requirements_first", about: "a short request that points at the requirements: it reads them (and the chapter) before it designs anything",
    why: "a design from the title alone invents screens the requirements do not have",
    files: WORLD,
    user_message: "OBJECTIVE: design the UX for the app described in run_test/plan/README.md.\nBOUNDARIES: write into " + OUT + ".",
    expect: { first_call: { any: [{ tool: "Read", match: "README" }, { tool: "Bash", match: "(cat|sed|head|rg|grep).*README" }, { tool: "Bash", match: "chapter" }] }, not_calls: [{ tool: "Write" }], judge: "a look at the requirements (or the format chapter) comes before any file is written" } }),
  u({ id: "ux_f2_flow_themes_page_in_one_go", about: "one design: flow.md (from the requirements), themes.md and designs.html (the main screen in the design on top, the clickable prototype below), all in one go",
    why: "the flow is the first deliverable, then the look, then ONE page where the person judges both; accounts and sharing are out of scope",
    stuff: [{ title: "run_test/plan/README.md (what you read)", text: HABIT }, { title: "chapter ux_flow (read)", text: "flow.md: Who / The flow (table) / Screens (components, states, exact labels) / Taken-invented. themes.md and designs.html (section id=themes, then section id=prototype) when a design was asked." }],
    user_message: "OBJECTIVE: design the UX for the app in run_test/plan/README.md (one design).\nBOUNDARIES: write into " + OUT + ".",
    expect: { calls: [
      { tool: "Write", match: "02_ux/flow\\.md", each: ["Today", "Add habit", "Streak", "Week"] },
      { tool: "Write", match: "02_ux/themes\\.md", each: ["#[0-9a-f]{6}", "dark", "(type|font)"] },
      { tool: "Write", match: "02_ux/designs\\.html", each: ["id=\\W{0,3}themes\\W[\\s\\S]*id=\\W{0,3}prototype", "(hashchange|location\\.hash|addEventListener|onclick)", "Add habit"] }],
      not_calls: [NOCODE, { tool: "Write", match: "#{2,3} (Sign|Log ?in|Account|Share|Reminder|Settings|Profile)" }, { tool: "Write", match: "Design B" }, { tool: "Bash", match: "(pnpm|npm|vite|npx|cat >|tee )" }],
      judge: "flow: a step table and a block per screen with states and exact labels, what it invented named; themes: one design, palette roles light and dark; page: ONE html file, no build, themes section first, prototype below, the flow's own labels, every button goes somewhere" } }),
  u({ id: "ux_f5_report_line", about: "it finishes with the REPORT line listing the files it wrote", after: "ux_f2_flow_themes_page_in_one_go",
    stuff: [{ title: "your writes", text: "Wrote run_test/plan/02_ux/flow.md, themes.md, designs.html." }], user_message: "(go on)",
    expect: { no_calls: true, text_has: ["REPORT:\\s*\\{", "flow\\.md", "designs\\.html"] } }),

  // ---- several designs asked (3): one flow, three real alternatives, one page with the three side by side
  u({ id: "ux_3_three_designs_in_one_go", about: "'give me 3 designs': ONE flow, Design A / B / C that differ in layout or density (not only colour), and the page shows the three main screens side by side with the prototype below",
    why: "the person compares looks on the same flow; three flows or three hues of one scheme are no choice",
    files: WORLD,
    stuff: [{ title: "run_test/plan/README.md (what you read)", text: HABIT }],
    user_message: "OBJECTIVE: design the UX for the app in run_test/plan/README.md and give me 3 designs.\nBOUNDARIES: write into " + OUT + ".",
    expect: { calls: [
      { tool: "Write", match: "02_ux/flow\\.md" },
      { tool: "Write", match: "02_ux/themes\\.md", each: ["Design A", "Design B", "Design C", "(layout|density|spacing)", "(font|type|typeface)"] },
      { tool: "Write", match: "02_ux/designs\\.html", each: ["Design A[\\s\\S]*Design B[\\s\\S]*Design C", "id=\\W{0,3}themes\\W[\\s\\S]*id=\\W{0,3}prototype", "(flex|grid)"] }],
      not_calls: [NOCODE, { tool: "Write", match: "flow_[abc]|flow-[abc]|flow2" }],
      judge: "one flow.md; three real alternatives (for example airy cards / dense list / bold dark) that say what makes each different; three cards in a row with the same labels, clicking one selects it; the prototype below" } }),

  // ---- plan only, when it is said explicitly
  u({ id: "ux_plan_only_when_asked", about: "'just the plan, no designs': the flow file and nothing else (no themes, no page)",
    files: WORLD,
    stuff: [{ title: "run_test/plan/README.md (what you read)", text: HABIT }],
    user_message: "OBJECTIVE: plan the UX flow for the app in run_test/plan/README.md. Plan only, no designs yet.\nBOUNDARIES: write into " + OUT + ".",
    expect: { calls: [{ tool: "Write", match: "02_ux/flow\\.md" }], not_calls: [{ tool: "Write", match: "(themes|designs)\\.|\\.html|\\.css"  }, NOCODE], judge: "only flow.md" } }),
  u({ id: "ux_plan_only_report", about: "plan only: it ends with the REPORT line naming flow.md only", after: "ux_plan_only_when_asked",
    stuff: [{ title: "your write", text: "Wrote run_test/plan/02_ux/flow.md (58 lines)." }], user_message: "(go on)",
    expect: { no_calls: true, text_has: ["REPORT:\\s*\\{.*flow\\.md"], text_not: ["designs\\.html", "themes\\.md"] } }),

  // ---- the real plans
  u({ id: "ux_eiffel_flow_keeps_the_features", about: "Eiffel Tower 3D (real feature catalog): the flow follows the tour (Explore, stops, drag, final stop, EN/FR); no account, shop or sharing is added",
    why: "design what was asked; the plan has six features and a one-button visit",
    stuff: [{ title: "run_test/plan/README.md, the feature catalog (what you read)", text: catalog("aistudio_eiffel_tower_3d") }],
    user_message: "OBJECTIVE: plan the UX flow for this plan's visitor (desktop and phone). Plan only.\nBOUNDARIES: write " + OUT + "flow.md only.",
    expect: { calls: [{ tool: "Write", match: "02_ux/flow\\.md", each: ["(tour|stops)", "(FR|French)", "(final stop|stop 12|12 stops)", "(drag|orbit)"] }], not_calls: [NOCODE, { tool: "Write", match: "(sign.?in|account|checkout|comment|share on|newsletter)" }], judge: "the visit step by step; the phone layout; the French toggle; the same wording as the plan" } }),
  u({ id: "ux_composio_many_screens_split_files", about: "AgentDeck dashboard (real catalog, 10 screens): flow.md first, then one short file per screen (more than five screens)", 
    stuff: [{ title: "run_test/plan/README.md, the feature catalog (what you read)", text: catalog("composio_admin_dashboard/multi_phase") }],
    user_message: "OBJECTIVE: plan the UX flow of this dashboard (a developer connects apps to agents). Plan only (no themes, no page). Write flow.md, and also ONE file per screen under 02_ux/screens/ so each builder can own one screen.\nBOUNDARIES: write into " + OUT + ".",
    expect: { calls: [{ tool: "Write", match: "02_ux/flow\\.md", each: ["Toolkits", "Auth Configs", "Connected Accounts", "Triggers", "Settings"] }], not_calls: [NOCODE, { tool: "Write", match: "(themes|designs)\\.|\\.html"  }], judge: "who, the main path (set up an app -> connect an account -> trigger), the screens; screens/<name>.md files follow for the 10 screens" } }),
  u({ id: "ux_composio_screens_files_follow", about: "the task asks for one file per screen under 02_ux/screens/ (plan only otherwise): it writes them, one file each, no themes and no page", after: "ux_composio_many_screens_split_files",
    files: { "run_test/plan/02_ux/flow.md": "# UX flow: connect apps to agents\n## Screens\nHome, Toolkits, Auth Configs, Connected Accounts, Triggers, Playground, Logs, Settings, API Keys, Docs (one block each)\n" },
    stuff: [{ title: "your write", text: "Wrote run_test/plan/02_ux/flow.md (Home, Toolkits, Auth Configs, Connected Accounts, Triggers, Playground, Logs, Settings, API Keys, Docs)." }], user_message: "(go on)",
    expect: { calls: [{ tool: "Write", match: "02_ux/screens/[a-z-]+\\.md" }], not_calls: [NOCODE, { tool: "Write", match: "(themes|designs)\\.|\\.html" }] } }),

  // ---- when it must hand back
  u({ id: "ux_clone_request_goes_back", about: "a request to copy a real website's look is not its job: NEEDS_PARENT (the lookup agents and site_build clone from pictures)",
    why: "a designer inventing a 'clone' from memory gives a look-alike nobody checked against the site",
    stuff: [{ title: "run_test/plan/README.md (what you read)", text: "A ditto clone of a real website (an uptime-monitor product site with a blog), renamed PingHarbor, own text, with scroll animation, light and dark theme and every page linked." }],
    user_message: "OBJECTIVE: design the UX of this clone so that it looks exactly like the real site https://upwatchr.io/blog.\nBOUNDARIES: write into " + OUT + ".",
    expect: { text_has: ["NEEDS_PARENT:", "(clone|real site|picture|capture|lookup|site_build)"], not_calls: [{ tool: "Write" }], judge: "says copying a real site needs the reference capture (lookup / site_build), not a designer's memory" } }),
  u({ id: "ux_product_not_named_needs_parent", about: "no product, no requirements file: it asks what to design (NEEDS_PARENT), it does not invent an app",
    user_message: "OBJECTIVE: design the UX.",
    expect: { text_has: ["NEEDS_PARENT:", "(what|which|product|app|requirement)"], not_calls: [{ tool: "Write" }] } }),
];
