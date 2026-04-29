import type { AgentHarnessAction } from "./action-types.js";
import type { AgentHarnessConfig } from "./config-types.js";
import type { AgentHarnessPlan } from "./plan-types.js";
import type { AgentHarnessRunState } from "./run-types.js";
import { createInitialState, applyAction } from "./state-machine.js";
import { validateAction, validatePlan } from "./schema-validation.js";

export interface RunnerResult {
  state: AgentHarnessRunState;
  observation: {
    status: "success" | "warning" | "error" | "halt";
    summary: string;
    next_actions: string[];
    artifacts: Array<{ type: string; path?: string; run_id?: string }>;
    errors: string[];
  };
}

export function processHarnessAction(input: {
  plan: AgentHarnessPlan;
  previousState: AgentHarnessRunState | null;
  action: AgentHarnessAction;
  runId: string;
  mode: string;
  config: AgentHarnessConfig;
}): RunnerResult {
  validatePlan(input.plan);
  validateAction(input.action);
  const initial = input.previousState ?? createInitialState(input.plan, input.runId, input.mode);
  const state = applyAction(initial, input.action, input.config);
  return {
    state,
    observation: {
      status: state.status === "halt" ? "halt" : state.status === "partial_validated" ? "warning" : "success",
      summary: `${state.phase}: ${state.tasks.filter((task) => task.status === "completed").length}/${state.tasks.length} tasks completed`,
      next_actions: nextActions(state.phase),
      artifacts: [{ type: "run_state", run_id: state.run_id }],
      errors: state.errors,
    },
  };
}

function nextActions(phase: string): string[] {
  const map: Record<string, string[]> = {
    init: ["read_context"],
    preflight: ["declare_files"],
    task_start: ["edit_file_ready", "verify_claims"],
    gate: ["run_gate"],
    evidence: ["record_evidence"],
    report: ["verify_claims", "final_report"],
    halt: [],
    completed: [],
  };
  return map[phase] ?? [];
}
