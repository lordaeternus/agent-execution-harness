import type { AgentHarnessTask, TaskSurface } from "./plan-types.js";
import type { AgentHarnessRunState, Evidence, EvidencePolicySummary, RunTask } from "./run-types.js";

const SURFACE_REQUIREMENTS: Record<TaskSurface, string[]> = {
  ui_layout: ["focused_tests", "scoped_lint", "scoped_typecheck", "browser_smoke|visual_assertion"],
  ui: ["focused_tests", "scoped_lint", "scoped_typecheck"],
  backend: ["focused_tests", "scoped_typecheck"],
  api: ["focused_tests", "scoped_typecheck", "api_contract"],
  auth: ["focused_tests", "scoped_typecheck", "authz_negative_test"],
  db: ["migration_or_schema_check", "rollback_plan"],
  ai: ["golden_case", "schema_validation", "rollback_plan"],
  docs: [],
  generic: [],
};

export function evaluateEvidencePolicy(state: AgentHarnessRunState): EvidencePolicySummary {
  const planTaskById = new Map(state.plan.tasks.map((task) => [task.task_id, task]));
  const tasks = state.tasks.map((task) => {
    const planTask = planTaskById.get(task.task_id);
    const required = requiredEvidenceForTask(task, planTask);
    const taskEvidence = state.evidence.filter((evidence) => task.evidence_ids.includes(evidence.evidence_id));
    const satisfied = required.filter((requirement) => isRequirementSatisfied(requirement, taskEvidence));
    return {
      task_id: task.task_id,
      required,
      satisfied,
      missing: required.filter((requirement) => !satisfied.includes(requirement)),
    };
  });
  const required = unique(tasks.flatMap((task) => task.required));
  const satisfied = unique(tasks.flatMap((task) => task.satisfied));
  const missing = unique(tasks.flatMap((task) => task.missing));
  const score = required.length === 0 ? 100 : Math.round(((required.length - missing.length) / required.length) * 100);
  return {
    status: missing.length === 0 ? "satisfied" : "missing_required_evidence",
    score,
    required,
    satisfied,
    missing,
    tasks,
  };
}

function requiredEvidenceForTask(task: RunTask, planTask: AgentHarnessTask | undefined): string[] {
  if (planTask?.required_evidence?.length) return unique(planTask.required_evidence);
  if (task.required_evidence?.length) return unique(task.required_evidence);
  const surface = planTask?.surface ?? inferSurface([...(planTask?.files ?? []), ...(task.files ?? [])]);
  return unique(SURFACE_REQUIREMENTS[surface] ?? []);
}

function inferSurface(files: string[]): TaskSurface {
  if (files.some((file) => /(^|\/)supabase\/migrations\//.test(file))) return "db";
  if (files.some((file) => /(^|\/)supabase\/functions\//.test(file))) return "api";
  if (files.some((file) => /(^|\/)(auth|permissions|session|rls)(\/|\.|-)/i.test(file))) return "auth";
  if (files.some((file) => /(^|\/)(ai|llm|prompts?)\//i.test(file))) return "ai";
  if (files.some((file) => /\.(md|mdx)$/i.test(file))) return "docs";
  if (files.some((file) => /(^|\/)(src\/components|src\/pages|src\/features)|\.(tsx|jsx|css)$/i.test(file))) return "ui_layout";
  return "generic";
}

function isRequirementSatisfied(requirement: string, evidence: Evidence[]): boolean {
  const alternatives = requirement.split("|").map((item) => item.trim()).filter(Boolean);
  return alternatives.some((alternative) =>
    evidence.some((item) => item.result === "pass" && evidenceTypes(item).includes(alternative)),
  );
}

function evidenceTypes(evidence: Evidence): string[] {
  return unique([evidence.evidence_type, ...(evidence.evidence_types ?? [])].filter((item): item is string => Boolean(item)));
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
