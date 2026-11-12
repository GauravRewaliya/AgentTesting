import type { TestTag } from "./tags.ts";

// Shape of a test case summary; tags come only from ./tags.ts.
export interface TestCaseInfo { id: string; description: string; tags: TestTag[] }
export const test_cases: TestCaseInfo[] = [
  { id: "", description: "", tags: ["multi_ag", "multi_prompt", "coding"] },
  { id: "", description: "", tags: ["multi_ag", "single_prompt", "split_task"] },
  { id: "", description: "", tags: ["single_ag", "single_prompt", "artifacts"] },
];
