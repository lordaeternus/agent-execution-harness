import { ACTION_SCHEMA_VERSION, CONFIG_SCHEMA_VERSION, PLAN_SCHEMA_VERSION, RUN_SCHEMA_VERSION } from "./constants.js";
import type { AgentHarnessAction } from "./action-types.js";
import type { AgentHarnessConfig } from "./config-types.js";
import type { AgentHarnessPlan } from "./plan-types.js";
import type { AgentHarnessRunState } from "./run-types.js";

export interface ValidationResult {
  status: "success" | "error";
  errors: string[];
}

export function validatePlan(plan: unknown): asserts plan is AgentHarnessPlan {
  const errors = collectPlanErrors(plan);
  if (errors.length) throw new Error(errors.join("; "));
}

export function validateAction(action: unknown): asserts action is AgentHarnessAction {
  const errors = collectActionErrors(action);
  if (errors.length) throw new Error(errors.join("; "));
}

export function validateRunState(state: unknown): asserts state is AgentHarnessRunState {
  const value = asRecord(state, "run");
  requireString(value, "schema_version", RUN_SCHEMA_VERSION);
  requireString(value, "run_id");
  requireEnum(value, "mode", ["strong", "standard", "constrained"]);
  requireEnum(value, "status", ["in_progress", "ready_for_report", "completed", "partial_validated", "halt"]);
  requireEnum(value, "phase", ["init", "preflight", "task_start", "gate", "evidence", "report", "halt", "completed"]);
  if (!value.plan || typeof value.plan !== "object") throw new Error("run.plan is required");
  if (!Array.isArray(value.tasks)) throw new Error("run.tasks must be an array");
  if (!Array.isArray(value.evidence)) throw new Error("run.evidence must be an array");
  if (!Array.isArray(value.verified_claims)) throw new Error("run.verified_claims must be an array");
}

export function validateConfig(config: unknown): asserts config is AgentHarnessConfig {
  const value = asRecord(config, "config");
  requireString(value, "schema_version", CONFIG_SCHEMA_VERSION);
  requireString(value, "artifact_dir");
  requireArray(value, "product_paths");
  requireArray(value, "required_scripts");
  requireEnum(value, "doctor_profile", ["generic", "stetix", "strict", "ci"]);
  const policy = asRecord(value.command_policy, "config.command_policy");
  if (policy.allow !== undefined && !Array.isArray(policy.allow)) throw new Error("config.command_policy.allow must be an array");
  if (policy.deny !== undefined && !Array.isArray(policy.deny)) throw new Error("config.command_policy.deny must be an array");
}

export function lintPlan(plan: unknown): ValidationResult {
  const errors = collectPlanErrors(plan);
  return { status: errors.length ? "error" : "success", errors };
}

function collectPlanErrors(plan: unknown): string[] {
  try {
    const value = asRecord(plan, "plan");
    requireString(value, "schema_version", PLAN_SCHEMA_VERSION);
    requireString(value, "plan_id");
    requireSafeId(value, "plan_id");
    requireEnum(value, "risk_level", ["L1", "L2", "L3"]);
    requireString(value, "rollback_expectation");
    requireArray(value, "gates");
    requireArray(value, "tasks");
    if ((value.gates as unknown[]).length === 0) throw new Error("plan.gates must be non-empty");
    if ((value.tasks as unknown[]).length === 0) throw new Error("plan.tasks must be non-empty");
    const seenTasks = new Set<string>();
    for (const task of value.tasks as unknown[]) {
      const record = asRecord(task, "task");
      requireString(record, "task_id");
      requireSafeId(record, "task_id");
      requireString(record, "acceptance_criteria");
      if (record.surface !== undefined) requireEnum(record, "surface", ["ui_layout", "ui", "backend", "api", "auth", "db", "ai", "docs", "generic"]);
      if (record.files !== undefined) requireArray(record, "files");
      if (record.required_evidence !== undefined) requireArray(record, "required_evidence");
      if (seenTasks.has(record.task_id as string)) throw new Error(`duplicate task_id: ${String(record.task_id)}`);
      seenTasks.add(record.task_id as string);
    }
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

function collectActionErrors(action: unknown): string[] {
  try {
    const value = asRecord(action, "action");
    requireString(value, "schema_version", ACTION_SCHEMA_VERSION);
    requireEnum(value, "type", ["read_context", "declare_files", "edit_file_ready", "run_gate", "record_evidence", "verify_claims", "final_report", "halt_for_risk"]);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function requireString(value: Record<string, unknown>, field: string, expected?: string): void {
  if (typeof value[field] !== "string" || String(value[field]).trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (expected && value[field] !== expected) throw new Error(`${field} must be ${expected}`);
}

function requireArray(value: Record<string, unknown>, field: string): void {
  if (!Array.isArray(value[field])) throw new Error(`${field} must be an array`);
}

function requireEnum(value: Record<string, unknown>, field: string, allowed: string[]): void {
  requireString(value, field);
  if (!allowed.includes(value[field] as string)) throw new Error(`${field} must be one of ${allowed.join(", ")}`);
}

function requireSafeId(value: Record<string, unknown>, field: string): void {
  requireString(value, field);
  if (!/^[a-zA-Z0-9._-]+$/.test(value[field] as string)) throw new Error(`${field} contains unsafe characters`);
}
