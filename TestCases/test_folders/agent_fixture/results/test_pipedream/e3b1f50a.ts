import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "pd-lock-issue",
  title: "Create a GitHub action Lock Issue for the Pipedream components repo, f",
  description: "Recorded answer: Create a GitHub action Lock Issue for the Pipedream components repo, following the existing create-issue action.",
  match: {"keywords":["lock","issue","github"]},
  expected_input: {
    text: "Create a GitHub action Lock Issue for the Pipedream components repo, following the existing create-issue action.",
    guardrails_test: "hand-over must carry the pasted guidance and the old action: github-create-issue, repoFullnameStatic, propDefinition, lock",
  },
  run: (req) => {
    req.cp("lock-issue");   // components/github/actions/lock-issue/lock-issue.mjs + components/github/github.app.lockIssue.patch.mjs
    return "Prepared a new action modelled on github-create-issue: key \"github-lock-issue\", props github + repoFullname (repoFullnameStatic) + issueNumber (issueNumberStatic) + optional lockReason (off-topic | too heated | resolved | spam), run() resolves the repo, calls this.github.lockIssue(...), exports a $summary and returns the result.\nIt needs one new method in github.app.mjs (the thin wrapper over PUT /repos/{owner}/{repo}/issues/{n}/lock); that method is in the second file (a patch snippet, not a full app file).\nFiles are in the workspace folder listed below. Version 0.0.1; bump @pipedream/github package version when merging. Not run against the real API.\nfiles: /tmp/lk-epLOCt/\n- components/github/actions/lock-issue/lock-issue.mjs\n- components/github/github.app.lockIssue.patch.mjs";
  },
} satisfies ResultModule;
