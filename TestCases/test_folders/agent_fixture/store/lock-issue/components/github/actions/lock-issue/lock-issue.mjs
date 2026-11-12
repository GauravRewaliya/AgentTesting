import github from "../../github.app.mjs";

export default {
  key: "github-lock-issue",
  name: "Lock Issue",
  description: "Lock the conversation of an issue or pull request so only collaborators can comment. Provide the repository as an `owner/repo` string and the issue number (the `#N` in the GitHub UI). Optionally give a lock reason. To unlock, use the GitHub UI or API. [See the documentation](https://docs.github.com/en/rest/issues/issues#lock-an-issue)",
  version: "0.0.1",
  annotations: {
    destructiveHint: false,
    openWorldHint: true,
    readOnlyHint: false,
  },
  type: "action",
  ai: "optimized",
  props: {
    github,
    repoFullname: {
      propDefinition: [
        github,
        "repoFullnameStatic",
      ],
    },
    issueNumber: {
      propDefinition: [
        github,
        "issueNumberStatic",
      ],
    },
    lockReason: {
      label: "Lock Reason",
      description: "Why the conversation is locked. One of `off-topic`, `too heated`, `resolved`, `spam`.",
      type: "string",
      options: [
        "off-topic",
        "too heated",
        "resolved",
        "spam",
      ],
      optional: true,
    },
  },
  async run({ $ }) {
    const repoFullname = await this.github._resolveRepoFullname(this.repoFullname);
    const response = await this.github.lockIssue({
      repoFullname,
      issueNumber: this.issueNumber,
      data: this.lockReason
        ? {
          lock_reason: this.lockReason,
        }
        : {},
    });

    $.export("$summary", `Successfully locked issue #${this.issueNumber}`);

    return response;
  },
};
