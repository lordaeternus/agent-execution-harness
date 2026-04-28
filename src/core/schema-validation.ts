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
  requireString(value, "mode");
  requireString(value, "status");
  requireString(value, "phase");
  if (!Array.isArray(value.tasks)) throw new Error("run.tasks must be an array");
  if (!Array.isArray(value.evidence)) throw new Error("run.evidence must be an array");
}

export function validateConfig(config: unknown): asserts config is AgentHarnessConfig {
  const value = asRecord(config, "config");
  requireString(value, "schema_version", CONFIG_SCHEMA_VERSION);
  requireString(value, "artifact_dir");
  requireArray(value, "product_paths");
  requireArray(value, "required_scripts");
  requireString(value, "doctor_profile");
  if (!value.command_policy || typeof value.command_policy !== "object") throw new Error("config.command_policy is required");
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
    requireString(value, "risk_level");
    requireString(value, "rollback_expectation");
    requireArray(value, "gates");
    requireArray(value, "tasks");
    if ((value.tasks as unknown[]).length === 0) throw new Error("plan.tasks must be non-empty");
    for (const task of value.tasks as unknown[]) {
      const record = asRecord(task, "task");
      requireString(record, "task_id");
      requireString(record, "acceptance_criteria");
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
    requireString(value, "type");
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
