import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "wf-build-signup",
  title: "Add signup validation",
  description: "Recorded work: Add signup validation",
  match: { agent: "builder", keywords: ["signup", "validation"] },
  expected_input: {
    text: "Add input validation to the signup form (email format, password length 12+).",
    guardrails_test: "hand-over carries both rules",
  },
  run: (req) => {
    req.write("signup/validate.ts", "export const validate = (email: string, pw: string) => /^[^@]+@[^@]+$/.test(email) && pw.length >= 12;\n");
    return "Added signup/validate.ts: email format and password length >= 12.";
  },
} satisfies ResultModule;
