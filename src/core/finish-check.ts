import type { AgentHarnessRunState } from "./run-types.js";
import { missingAutoClaims } from "./auto-claims.js";
import { evaluateEvidencePolicy } from "./evidence-policy.js";
import { applyScopeGuardToState, type GitTouchedFilesResult } from "./scope-guard.js";

export interface FinishReadinessResult {
  ready: boolean;
  errors: string[];
  warnings: string[];
  next_actions: string[];
  data: {
    pending_tasks: string[];
    unverified_claims: number;
    missing_auto_claims: number;
    missing_evidence: string[];
    unexpected_files: string[];
    rollback_defined: boolean;
  };
}

export function assessFinishReadiness(input: {
  state: AgentHarnessRunState;
  touchedFiles?: GitTouchedFilesResult;
  generatedAllowlist?: string[];
  strictScope?: boolean;
}): FinishReadinessResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pendingTasks = input.state.tasks.filter((task) => ["not_started", "in_progress"].includes(task.status)).map((task) => task.task_id);
  const unverifiedClaims = input.state.verified_claims.filter((claim) => !claim.verified).length;
  const missingAutoClaimCount = missingAutoClaims(input.state).length;
  const evidencePolicy = evaluateEvidencePolicy(input.state);
  const missingEvidence = evidencePolicy.missing;
  let unexpectedFiles = input.state.unexpected_files ?? [];

  if (input.touchedFiles) {
    if (!input.touchedFiles.ok) {
      if (input.strictScope) errors.push(`scope_guard_unavailable: ${input.touchedFiles.reason ?? "unknown"}`);
      else warnings.push(`scope_guard_unavailable: ${input.touchedFiles.reason ?? "unknown"}`);
    } else {
      const guarded = applyScopeGuardToState(input.state, input.touchedFiles.files, input.generatedAllowlist ?? []);
      unexpectedFiles = guarded.unexpected_files ?? [];
    }
  }

  if (pendingTasks.length) errors.push(`pending_tasks: ${pendingTasks.join(",")}`);
  if (input.state.pending_gate) errors.push(`pending_gate: ${input.state.pending_gate.command}`);
  if (input.state.current_task_id) errors.push(`task_in_progress: ${input.state.current_task_id}`);
  if (!input.state.plan.rollback_expectation.trim()) errors.push("rollback_missing");
  if (!input.state.verified_claims.length) errors.push("verified_claims_missing");
  if (unverifiedClaims > 0) errors.push(`unverified_claims: ${unverifiedClaims}`);
  if (missingAutoClaimCount > 0) errors.push(`missing_auto_claims: ${missingAutoClaimCount}`);
  if (missingEvidence.length) errors.push(`missing_evidence: ${missingEvidence.join(",")}`);
  if (unexpectedFiles.length) errors.push(`unexpected_files: ${unexpectedFiles.join(",")}`);

  const ready = errors.length === 0;
  return {
    ready,
    errors,
    warnings,
    next_actions: ready ? ["finish --summary \"validated\""] : nextActionsForErrors(errors),
    data: {
      pending_tasks: pendingTasks,
      unverified_claims: unverifiedClaims,
      missing_auto_claims: missingAutoClaimCount,
      missing_evidence: missingEvidence,
      unexpected_files: unexpectedFiles,
      rollback_defined: Boolean(input.state.plan.rollback_expectation.trim()),
    },
  };
}

function nextActionsForErrors(errors: string[]): string[] {
  if (errors.some((error) => error.startsWith("pending_tasks") || error.startsWith("task_in_progress") || error.startsWith("pending_gate"))) return ["next --exact"];
  if (errors.some((error) => error.includes("claim"))) return ["claim auto"];
  if (errors.some((error) => error.startsWith("missing_evidence"))) return ["verify missing evidence"];
  if (errors.some((error) => error.startsWith("unexpected_files"))) return ["revert unexpected files or add them to the plan"];
  if (errors.some((error) => error === "rollback_missing")) return ["add rollback_expectation to the plan"];
  return ["inspect run artifact"];
}
