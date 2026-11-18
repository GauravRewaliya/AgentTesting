// The --settings JSON that loads the two hooks for one launch. (Under the real product this is the Loopferry mod; same decisions.)
import { join } from "node:path";
export function hookArgs(harnessDir: string): string[] {
  const g = `bun --smol ${join(harnessDir, "hooks", "guard.ts")}`, a = `bun --smol ${join(harnessDir, "hooks", "activity.ts")}`;
  return ["--settings", JSON.stringify({ hooks: {
    PreToolUse: [{ matcher: "Write|Edit|MultiEdit|NotebookEdit|Bash", hooks: [{ type: "command", command: g }] }],
    PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: a }] }] } })];
}
