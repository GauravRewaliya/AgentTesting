import type { TestTag } from "../../../../tags.ts";
import type { Case } from "@core/types.ts";

// SoLoWork: the lead works ALONE (no router prompt, no sub-agent call) and follows the user's confirm-first request:
// "mention the content first" -> the agent returns the content -> the user confirms -> only then it proceeds (writes the file).
// Judged from the report (files in run_test show whether anything was written early).
export const tags: TestTag[] = ["single_ag", "coding"];   // each case adds single_prompt / multi_prompt
const solo = { external: true, router: false, lead: "solo", tools: ["Write", "Read", "Agent"], agents: ["writer"], needs: ["sandbox.files"], allow_real_subAg: true as const };
export const cases: Case[] = [
  {
    id: "solo_1_confirm_then_write", title: "[SoLoWork] show the content first; after the OK, write exactly that content", tags: ["multi_prompt"], ...solo,
    turns: [
      { user: "I need a short README.md for a tiny todo command-line tool called `tdl`. Show me the content first and wait for my OK before you write the file.",
        expected: { context: "Turn 1: the lead shows the full README content in its reply, asks for confirmation and ENDS the turn. NO file is written yet (run_test stays empty) and no sub-agent is called.", expected_agents_res: [] } },
      { user: "Looks good, write it.",
        expected: { context: "Turn 2: the lead writes README.md with exactly the content it showed (title tdl), using the Write tool itself. No sub-agent is called.", expected_agents_res: [] } },
    ],
  },
  {
    id: "solo_2_edit_then_write", title: "[SoLoWork] show first, the user asks for a change, the written file has the change", tags: ["multi_prompt"], ...solo,
    turns: [
      { user: "Draft a short NOTES.md with three bullet points about why we use Bun. Show it to me first, do not write the file yet.",
        expected: { context: "Turn 1: three bullet points shown, nothing written, asks to confirm.", expected_agents_res: [] } },
      { user: "Change the title to 'Why Bun' and then write it.",
        expected: { context: "Turn 2: the lead applies the change (the title is 'Why Bun') and writes NOTES.md itself; the file contains 'Why Bun' and the three bullets.", expected_agents_res: [] } },
    ],
  },
  {
    id: "solo_3_declined_nothing_written", title: "[SoLoWork] show first, the user cancels: nothing may be written", tags: ["multi_prompt"], ...solo,
    turns: [
      { user: "Prepare a LICENSE.md with the MIT license for 'Acme'. Show me the text first and wait for my decision.",
        expected: { context: "Turn 1: the MIT text is shown, nothing written, asks to confirm.", expected_agents_res: [] } },
      { user: "No, cancel it. I changed my mind.",
        expected: { context: "Turn 2: the lead acknowledges the cancel and writes NOTHING (run_test stays empty); no sub-agent.", expected_agents_res: [] } },
    ],
  },
  {
    id: "solo_4_no_confirm_asked", title: "[SoLoWork] no 'show first' in the request: the lead just does the work", tags: ["single_prompt"], ...solo,
    turns: [
      { user: "Create a file hello.txt that contains the single word: hello",
        expected: { context: "The lead does NOT stop to ask: it writes hello.txt (content 'hello') itself, with the Write tool, no sub-agent.", expected_agents_res: [] } },
    ],
  },
];
