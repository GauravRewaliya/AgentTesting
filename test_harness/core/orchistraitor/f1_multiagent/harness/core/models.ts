// MODEL POLICY. Every real agent runs on sonnet (agent.json). A caller may pick the cheaper haiku for ONE call when the job is small
// (a copy, a rename, a one-file edit, a lookup): `delegate --model haiku`, a `model` on a fork_all / plan task. Only the execution roles may be
// downgraded; the lead, planner, pm and reviewer always stay on sonnet (their mistakes cost the most). Nothing else is accepted.
export const MODELS = ["sonnet", "haiku"] as const;
export type ModelName = (typeof MODELS)[number];
export const SMALL_JOB_ROLES = new Set(["builder", "researcher", "writer", "package-researcher"]);

/** Why this (role, model) pair is refused; undefined = fine (or no override). */
export function modelProblem(role: string, model: unknown): string | undefined {
  if (model === undefined || model === null || model === "") return undefined;
  if (!MODELS.includes(model as ModelName)) return `model "${String(model)}" is not allowed (use ${MODELS.join(" or ")})`;
  if (model === "haiku" && !SMALL_JOB_ROLES.has(role)) return `${role} always runs on sonnet; haiku is only for small jobs of: ${[...SMALL_JOB_ROLES].join(", ")}`;
  return undefined;
}
