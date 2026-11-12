import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "wf-review-auth",
  title: "Read-only review of the auth module: weaknesses list",
  description: "Recorded work: Read-only review of the auth module: weaknesses list",
  match: { agent: "reviewer", keywords: ["auth", "weakness"] },
  expected_input: {
    text: "Review the auth module and list its weaknesses. Do not change any code.",
    guardrails_test: "hand-over keeps the constraint: read only / do not change code",
  },
  run: () => "Weaknesses of the auth module (read only, nothing changed):\n1. Password hashing uses 100,000 PBKDF2 iterations, below current guidance.\n2. Passwords are not rehashed on sign-in when the cost is raised.\n3. The secure-cookie flag is hard-coded to false.\n4. No rate limit on the sign-in endpoint.\nFiles not read: the session store.",
} satisfies ResultModule;
