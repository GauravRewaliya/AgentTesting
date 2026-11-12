// Snippet to add inside `methods` of components/github/github.app.mjs (next to updateIssue / createIssueComment).
// PUT .../lock answers 204 with no body, so the method returns a small object for the action to export.
    async lockIssue({
      repoFullname, issueNumber, data,
    }) {
      await this._client().request(`PUT /repos/${repoFullname}/issues/${issueNumber}/lock`, data);

      return {
        locked: true,
        issue_number: issueNumber,
      };
    },
