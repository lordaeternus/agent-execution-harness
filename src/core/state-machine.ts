import { ACTION_SCHEMA_VERSION, RUN_SCHEMA_VERSION } from "./constants.js";
import type { AgentHarnessAction } from "./action-types.js";
import type { AgentHarnessPlan } from "./plan-types.js";
import type { AgentHarnessRunState } from "./run-types.js";
import { evaluateCommandPolicy } from "./command-policy.js";
import { normalizeEvidence } from "./evidence.js";
import { verifyClaim } from "./claims.js";
import { assertNonEmptyString, assertSafeId, assertSafeRelativePath } from "./utils.js";
import type { AgentHarnessConfig } from "./config-types.js";
import { evaluateEvidencePolicy } from "./evidence-policy.js";

const ALLOWED: Record<string, string[]> = {
  init: ["read_context", "halt_for_risk"],
  preflight: ["declare_files", "halt_for_risk"],
  task_start: ["edit_file_ready", "verify_claims", "halt_for_risk"],
  gate: ["run_gate", "halt_for_risk"],
  evidence: ["record_evidence", "halt_for_risk"],
  report: ["verify_claims", "final_report", "halt_for_risk"],
  halt: [],
  completed: [],
};

export function createInitialState(plan: AgentHarnessPlan, runId: string, mode = "standard"): AgentHarnessRunState {
  assertSafeId(runId, "run_id");
  const now = new Date().toISOString();
  return {
    schema_version: RUN_SCHEMA_VERSION,
    run_id: runId,
    mode: mode as AgentHarnessRunState["mode"],
    status: "in_progress",
    phase: "init",
    plan,
    tasks: plan.tasks.map((task) => ({ ...task, status: "not_started", evidence_ids: [] })),
    declared_files: [],
    current_task_id: null,
    pending_gate: null,
    evidence: [],
    claims: [],
    verified_claims: [],
    errors: [],
    final_report: null,
    created_at: now,
    updated_at: now,
  };
}

export function applyAction(state: AgentHarnessRunState, action: AgentHarnessAction, config: AgentHarnessConfig): AgentHarnessRunState {
  if (action.schema_version !== ACTION_SCHEMA_VERSION) throw new Error("invalid action schema_version");
  if (!ALLOWED[state.phase]?.includes(action.type)) throw new Error(`action ${action.type} not allowed in phase ${state.phase}`);
  if (state.mode === "constrained" && Array.isArray(action.claims) && action.claims.length > 20) throw new Error("too many claims for constrained mode");
  if (state.mode === "constrained" && action.summary && action.summary.length > config.token_budget.summary_max_chars) {
    throw new Error(`summary exceeds constrained limit ${config.token_budget.summary_max_chars}`);
  }

  const next = structuredClone(state) as AgentHarnessRunState;
  next.updated_at = new Date().toISOString();

  if (action.type === "halt_for_risk") {
    next.phase = "halt";
    next.status = "halt";
    next.errors.push(action.reason ?? "halt requested");
    return next;
  }
  if (action.type === "read_context") {
    assertNonEmptyString(action.summary, "summary");
    next.context_summary = action.summary;
    next.phase = "preflight";
    return next;
  }
  if (action.type === "declare_files") {
    if (!action.files?.length) throw new Error("declare_files requires files");
    for (const file of action.files) assertSafeRelativePath(file, "file");
    next.declared_files = [...new Set(action.files)].sort();
    next.phase = "task_start";
    return next;
  }
  if (action.type === "edit_file_ready") {
    assertNonEmptyString(action.task_id, "task_id");
    if (!action.files?.length) throw new Error("edit_file_ready requires files");
    const task = next.tasks.find((item) => item.task_id === action.task_id);
    if (!task) throw new Error(`unknown task_id: ${action.task_id}`);
    for (const file of action.files) {
      assertSafeRelativePath(file, "file");
      if (!next.declared_files.includes(file)) throw new Error(`file not declared: ${file}`);
    }
    task.status = "in_progress";
    task.files = action.files;
    next.current_task_id = task.task_id;
    next.phase = "gate";
    return next;
  }
  if (action.type === "run_gate") {
    assertNonEmptyString(action.command, "command");
    const policy = evaluateCommandPolicy(action.command, config.command_policy);
    if (!policy.allowed) {
      next.phase = "halt";
      next.status = "halt";
      next.errors.push(`dangerous command blocked: ${policy.reason}`);
      return next;
    }
    next.pending_gate = { task_id: next.current_task_id, command: action.command };
    next.phase = "evidence";
    return next;
  }
  if (action.type === "record_evidence") {
    if (!next.pending_gate) throw new Error("record_evidence requires pending gate");
    const evidence = normalizeEvidence(action.evidence);
    const task = next.tasks.find((item) => item.task_id === next.pending_gate?.task_id);
    if (state.mode === "constrained" && task?.required_evidence?.length && !evidence.evidence_type && !evidence.evidence_types?.length) {
      throw new Error("constrained mode requires evidence_type or evidence_types");
    }
    if (evidence.output_excerpt.length > config.token_budget.output_excerpt_max_chars) {
      throw new Error(`evidence.output_excerpt exceeds limit ${config.token_budget.output_excerpt_max_chars}`);
    }
    if (evidence.check !== next.pending_gate.command) throw new Error("evidence.check must match pending gate");
    if (next.evidence.some((item) => item.evidence_id === evidence.evidence_id)) throw new Error("duplicate evidence_id");
    next.evidence.push(evidence);
    if (task) {
      task.evidence_ids.push(evidence.evidence_id);
      task.status = evidence.result === "pass" ? "completed" : "blocked";
    }
    next.pending_gate = null;
    next.current_task_id = null;
    next.phase = next.tasks.every((item) => !["not_started", "in_progress"].includes(item.status)) ? "report" : "task_start";
    next.status = next.phase === "report" ? "ready_for_report" : "in_progress";
    return next;
  }
  if (action.type === "verify_claims") {
    if (!action.claims?.length) throw new Error("verify_claims requires claims");
    next.claims = action.claims;
    next.verified_claims = action.claims.map((claim) => verifyClaim(next, claim, config));
    next.phase = "report";
    next.status = "ready_for_report";
    return next;
  }
  if (action.type === "final_report") {
    assertNonEmptyString(action.summary, "summary");
    if (!next.verified_claims.length) throw new Error("final_report requires verified claims");
    if (next.verified_claims.some((claim) => !claim.verified)) throw new Error("final_report requires all claims verified");
    if (next.tasks.some((task) => ["not_started", "in_progress"].includes(task.status))) throw new Error("final_report requires all tasks reconciled");
    next.final_report = { summary: action.summary, verified_claim_ids: next.verified_claims.map((claim) => claim.claim_id) };
    next.evidence_policy = evaluateEvidencePolicy(next);
    next.phase = "completed";
    next.status = next.evidence_policy.status === "satisfied" ? "completed" : "partial_validated";
    return next;
  }
  return next;
}
