import type { AgentHarnessPlan, AgentHarnessTask, RiskLevel } from "./plan-types.js";
import type { CompiledPlan, CompiledTaskContract, PlanCompilerDiagnostic } from "./plan-compiler-types.js";
import { allowedCommandsForTask, inferTaskSurface, maxFilesForRisk, requiredEvidenceForTask } from "./task-contract.js";
import { calculateTaskWaves, dependenciesForTask, validateTaskGraph } from "./task-graph.js";

const VAGUE_WORDS = /^(fix|adjust|improve|change|update|make it work|works|done|ok|corrigir|ajustar|melhorar|alterar|funcionar)$/i;
const COMMAND_HINT = /`[^`]+`|\b(pnpm|npm|node|npx|git|tsc|vitest|playwright|deno|cargo|go test|pytest|make)\b/i;

export function compilePlan(plan: AgentHarnessPlan): CompiledPlan {
  const diagnostics: PlanCompilerDiagnostic[] = [];
  const maxFiles = maxFilesForRisk(plan.risk_level);

  if (plan.risk_level === "L3" && plan.rollback_expectation.trim().length < 16) {
    diagnostics.push({ code: "weak_rollback", severity: "error", message: "L3 plan requires explicit rollback expectation." });
  }

  const graphDiagnostics = validateTaskGraph(plan.tasks);
  diagnostics.push(...graphDiagnostics.map((item) => ({
    code: item.code,
    severity: item.code === "duplicate_dependency" ? "warning" as const : "error" as const,
    message: item.message,
    task_id: item.task_id,
  })));
  const tasks = plan.tasks.map((task) => compileTask(task, plan.risk_level, maxFiles, plan.gates, diagnostics, plan.execution_profile));
  const waves = diagnostics.some((item) => item.severity === "error" && ["missing_dependency", "self_dependency", "cycle"].includes(item.code))
    ? []
    : calculateTaskWaves(plan.tasks).map((wave) => wave.task_ids);
  diagnostics.push(...parallelRiskWarnings(tasks, waves));
  const hasError = diagnostics.some((item) => item.severity === "error");
  return { plan_id: plan.plan_id, risk_level: plan.risk_level, waves, tasks, diagnostics, status: hasError ? "error" : "success" };
}

function compileTask(task: AgentHarnessTask, riskLevel: RiskLevel, maxFiles: number, planGates: string[], diagnostics: PlanCompilerDiagnostic[], profile?: string): CompiledTaskContract {
  const files = unique(task.files ?? []);
  const forbiddenFiles = unique(task.forbidden_files ?? []);
  const surface = task.surface ?? inferTaskSurface(files);
  const requiredEvidence = requiredEvidenceForTask({ planTask: { ...task, files, surface } });
  const allowedCommands = allowedCommandsForTask({ taskAllowedCommands: task.allowed_commands, requiredChecks: task.required_checks, planGates });
  const criteria = task.acceptance_criteria.trim();

  if (files.length === 0) diagnostics.push(error(task, "missing_files", "Task must declare exact files before execution."));
  if (files.length > maxFiles) diagnostics.push(error(task, "too_many_files", `Task touches ${files.length} files; max for ${riskLevel} is ${maxFiles}.`));
  if (criteria.length < 18 || VAGUE_WORDS.test(criteria)) diagnostics.push(error(task, "vague_acceptance", "Acceptance criteria is too vague for autonomous execution."));
  if (task.expected_diff && (task.expected_diff.trim().length < 16 || VAGUE_WORDS.test(task.expected_diff.trim()))) {
    diagnostics.push(error(task, "vague_expected_diff", "expected_diff is too vague for autonomous execution."));
  }
  for (const file of files) {
    if (forbiddenFiles.includes(file)) diagnostics.push(error(task, "file_both_allowed_and_forbidden", `File is both allowed and forbidden: ${file}.`));
  }
  for (const check of task.required_checks ?? []) {
    if (!COMMAND_HINT.test(check)) diagnostics.push(error(task, "vague_required_check", `required_check is not command-like: ${check}.`));
  }
  if (task.rollback_command && !COMMAND_HINT.test(task.rollback_command)) diagnostics.push(error(task, "vague_rollback_command", "rollback_command must be command-like."));
  if (riskLevel !== "L1" && !COMMAND_HINT.test(criteria) && !task.required_checks?.length) {
    diagnostics.push(warning(task, "acceptance_should_name_verification", "Non-trivial tasks should name the focused verification command or required_checks."));
  }
  if (riskLevel !== "L1" && !COMMAND_HINT.test(criteria) && requiredEvidence.length === 0) {
    diagnostics.push(error(task, "missing_verifiable_dod", "Task needs command-backed criteria or required evidence."));
  }
  if ((riskLevel !== "L1" || profile === "strict") && allowedCommands.length === 0) {
    diagnostics.push(error(task, "missing_allowed_commands", "Task needs allowed_commands when the plan has multiple or no unambiguous gates."));
  }
  if (profile === "strict" && !task.allowed_commands?.length) {
    diagnostics.push(error(task, "strict_missing_allowed_commands", "Strict tasks must declare allowed_commands explicitly."));
  }
  if (["auth", "db", "api", "ai"].includes(surface) && !requiredEvidence.length) {
    diagnostics.push(error(task, "missing_risk_evidence", `Surface ${surface} requires explicit evidence.`));
  }

  return {
    task_id: task.task_id,
    depends_on: dependenciesForTask(task),
    surface,
    files,
    required_evidence: requiredEvidence,
    allowed_commands: allowedCommands,
    acceptance_criteria: criteria,
    risk_level: riskLevel,
    max_files_allowed: maxFiles,
    next_allowed_action: "task_start",
  };
}

function parallelRiskWarnings(tasks: CompiledTaskContract[], waves: string[][]): PlanCompilerDiagnostic[] {
  const byId = new Map(tasks.map((task) => [task.task_id, task]));
  const diagnostics: PlanCompilerDiagnostic[] = [];
  for (const wave of waves) {
    for (let leftIndex = 0; leftIndex < wave.length; leftIndex += 1) {
      const left = byId.get(wave[leftIndex]);
      if (!left) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < wave.length; rightIndex += 1) {
        const right = byId.get(wave[rightIndex]);
        if (!right) continue;
        const sharedFiles = left.files.filter((file) => right.files.includes(file));
        if (sharedFiles.length) {
          diagnostics.push({
            code: "parallel_shared_files",
            severity: "warning",
            task_id: left.task_id,
            message: `Tasks ${left.task_id} and ${right.task_id} are in the same wave and share files: ${sharedFiles.join(", ")}.`,
          });
        }
        const riskySurfaces = new Set([left.surface, right.surface].filter((surface) => ["auth", "db", "api", "ai"].includes(surface)));
        if (riskySurfaces.size) {
          diagnostics.push({
            code: "parallel_sensitive_surface",
            severity: "warning",
            task_id: left.task_id,
            message: `Tasks ${left.task_id} and ${right.task_id} are in the same wave across sensitive surface(s): ${[...riskySurfaces].sort().join(", ")}.`,
          });
        }
      }
    }
  }
  return diagnostics;
}

function error(task: AgentHarnessTask, code: string, message: string): PlanCompilerDiagnostic {
  return { code, severity: "error", message, task_id: task.task_id };
}

function warning(task: AgentHarnessTask, code: string, message: string): PlanCompilerDiagnostic {
  return { code, severity: "warning", message, task_id: task.task_id };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}
