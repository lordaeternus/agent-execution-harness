import type { AgentHarnessTask, RiskLevel, TaskSurface } from "./plan-types.js";
import type { RunTask } from "./run-types.js";

const SURFACE_BY_PATH: Array<[RegExp, TaskSurface]> = [
  [/^supabase\/migrations\//, "db"],
  [/^supabase\/functions\//, "api"],
  [/(^|\/)(auth|permissions|session|rls)(\/|\.|-)/i, "auth"],
  [/(^|\/)(ai|llm|prompt|prompts)(\/|\.|-)/i, "ai"],
  [/\.(md|mdx)$/i, "docs"],
  [/(^src\/(components|pages|features)\/|\.(tsx|jsx|css)$)/i, "ui_layout"],
  [/^src\//, "backend"],
];

export const SURFACE_REQUIREMENTS: Record<TaskSurface, string[]> = {
  ui_layout: ["focused_tests", "scoped_lint", "scoped_typecheck", "browser_smoke|visual_assertion"],
  ui: ["focused_tests", "scoped_lint", "scoped_typecheck"],
  backend: ["focused_tests", "scoped_typecheck"],
  api: ["focused_tests", "scoped_typecheck", "api_contract"],
  auth: ["focused_tests", "scoped_typecheck", "authz_negative_test"],
  db: ["migration_or_schema_check", "rollback_plan"],
  ai: ["golden_case", "schema_validation", "rollback_plan"],
  docs: [],
  generic: ["focused_tests"],
};

const MAX_FILES_BY_RISK: Record<RiskLevel, number> = { L1: 3, L2: 3, L3: 2 };
const HIGH_RISK_SURFACES: TaskSurface[] = ["auth", "db", "api", "ai"];
const SURFACE_PRIORITY: Record<TaskSurface, number> = {
  db: 60,
  api: 59,
  auth: 58,
  ai: 57,
  ui_layout: 40,
  ui: 35,
  backend: 30,
  docs: 20,
  generic: 0,
};

export function inferTaskSurface(files: string[]): TaskSurface {
  let surface: TaskSurface = "generic";

  for (const file of files) {
    const normalized = file.replace(/\\/g, "/");
    const match = SURFACE_BY_PATH.find(([pattern]) => pattern.test(normalized));
    if (match && SURFACE_PRIORITY[match[1]] > SURFACE_PRIORITY[surface]) {
      surface = match[1];
    }
  }

  return surface;
}

export function requiredEvidenceForTask(input: {
  planTask?: Pick<AgentHarnessTask, "files" | "required_evidence" | "surface">;
  runTask?: Pick<RunTask, "files" | "required_evidence" | "status" | "surface">;
}): string[] {
  if (input.planTask?.required_evidence?.length) return unique(input.planTask.required_evidence);
  if (input.runTask?.required_evidence?.length) return unique(input.runTask.required_evidence);
  const files = [...(input.planTask?.files ?? []), ...(input.runTask?.files ?? [])];
  const surface = (input.planTask?.surface ?? input.runTask?.surface ?? inferTaskSurface(files)) as TaskSurface;
  const base = SURFACE_REQUIREMENTS[surface] ?? [];
  const memory = input.runTask && taskNeedsFreshCodebaseMemory(input.runTask, surface) ? ["codebase_memory_fresh"] : [];
  return unique([...base, ...memory]);
}

export function maxFilesForRisk(riskLevel: RiskLevel): number {
  return MAX_FILES_BY_RISK[riskLevel] ?? 3;
}

export function allowedCommandsForTask(input: { taskAllowedCommands?: string[]; requiredChecks?: string[]; planGates?: string[] }): string[] {
  if (input.taskAllowedCommands?.length) return unique(input.taskAllowedCommands);
  if (input.requiredChecks?.length) return unique(input.requiredChecks);
  if (input.planGates?.length === 1) return unique(input.planGates);
  return [];
}

function taskNeedsFreshCodebaseMemory(task: Pick<RunTask, "status">, surface: TaskSurface): boolean {
  return HIGH_RISK_SURFACES.includes(surface) && task.status !== "not_started";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}
