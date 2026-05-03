import type { AgentHarnessPlan, AgentHarnessTask, RiskLevel, TaskSurface } from "./plan-types.js";
import type { CompiledPlan, CompiledTaskContract, PlanCompilerDiagnostic } from "./plan-compiler-types.js";

const SURFACE_BY_PATH: Array<[RegExp, TaskSurface]> = [
  [/^supabase\/migrations\//, "db"],
  [/^supabase\/functions\//, "api"],
  [/(^|\/)(auth|permissions|session|rls)(\/|\.|-)/i, "auth"],
  [/(^|\/)(ai|llm|prompts?)(\/|\.|-)/i, "ai"],
  [/\.(md|mdx)$/i, "docs"],
  [/(^src\/(components|pages|features)\/|\.(tsx|jsx|css)$)/i, "ui_layout"],
  [/^src\//, "backend"],
];

const EVIDENCE_BY_SURFACE: Record<TaskSurface, string[]> = {
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
const VAGUE_WORDS = /^(fix|adjust|improve|change|update|make it work|works|done|ok|corrigir|ajustar|melhorar|alterar|funcionar)$/i;
const COMMAND_HINT = /`[^`]+`|\b(pnpm|npm|node|npx|tsc|vitest|playwright|deno|cargo|go test|pytest|make)\b/i;

export function compilePlan(plan: AgentHarnessPlan): CompiledPlan {
  const diagnostics: PlanCompilerDiagnostic[] = [];
  const maxFiles = MAX_FILES_BY_RISK[plan.risk_level] ?? 3;

  if (plan.risk_level === "L3" && plan.rollback_expectation.trim().length < 16) {
    diagnostics.push({ code: "weak_rollback", severity: "error", message: "L3 plan requires explicit rollback expectation." });
  }

  const tasks = plan.tasks.map((task) => compileTask(task, plan.risk_level, maxFiles, diagnostics));
  const hasError = diagnostics.some((item) => item.severity === "error");
  return { plan_id: plan.plan_id, risk_level: plan.risk_level, tasks, diagnostics, status: hasError ? "error" : "success" };
}

function compileTask(task: AgentHarnessTask, riskLevel: RiskLevel, maxFiles: number, diagnostics: PlanCompilerDiagnostic[]): CompiledTaskContract {
  const files = unique(task.files ?? []);
  const surface = task.surface ?? inferSurface(files);
  const requiredEvidence = unique(task.required_evidence?.length ? task.required_evidence : EVIDENCE_BY_SURFACE[surface]);
  const criteria = task.acceptance_criteria.trim();

  if (files.length === 0) diagnostics.push(error(task, "missing_files", "Task must declare exact files before execution."));
  if (files.length > maxFiles) diagnostics.push(error(task, "too_many_files", `Task touches ${files.length} files; max for ${riskLevel} is ${maxFiles}.`));
  if (criteria.length < 18 || VAGUE_WORDS.test(criteria)) diagnostics.push(error(task, "vague_acceptance", "Acceptance criteria is too vague for autonomous execution."));
  if (riskLevel !== "L1" && !COMMAND_HINT.test(criteria) && requiredEvidence.length === 0) {
    diagnostics.push(error(task, "missing_verifiable_dod", "Task needs command-backed criteria or required evidence."));
  }
  if (["auth", "db", "api", "ai"].includes(surface) && !requiredEvidence.length) {
    diagnostics.push(error(task, "missing_risk_evidence", `Surface ${surface} requires explicit evidence.`));
  }

  return {
    task_id: task.task_id,
    surface,
    files,
    required_evidence: requiredEvidence,
    acceptance_criteria: criteria,
    risk_level: riskLevel,
    max_files_allowed: maxFiles,
  };
}

function inferSurface(files: string[]): TaskSurface {
  for (const file of files) {
    const normalized = file.replace(/\\/g, "/");
    const match = SURFACE_BY_PATH.find(([pattern]) => pattern.test(normalized));
    if (match) return match[1];
  }
  return "generic";
}

function error(task: AgentHarnessTask, code: string, message: string): PlanCompilerDiagnostic {
  return { code, severity: "error", message, task_id: task.task_id };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}
