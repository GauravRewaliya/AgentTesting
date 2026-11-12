import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "wf-fix-auth",
  title: "Fix the first two auth weaknesses",
  description: "Recorded work: Fix the first two auth weaknesses",
  match: { agent: "builder", keywords: ["pbkdf2", "cookie"] },
  expected_input: {
    text: "Fix these two weaknesses: PBKDF2 iterations too low, secure-cookie flag hard-coded to false.",
    guardrails_test: "hand-over carries the two findings from the earlier answer (the sub-agent has no memory of it)",
  },
  run: (req) => {
    req.write("auth/hash.ts", "export const ITERATIONS = 600_000; // raised from 100_000\n");
    req.write("auth/cookies.ts", "export const secureCookies = process.env.NODE_ENV === \"production\";\n");
    return "Fixed both: PBKDF2 iterations raised to 600,000 (auth/hash.ts); secure cookies now follow NODE_ENV (auth/cookies.ts).";
  },
} satisfies ResultModule;
