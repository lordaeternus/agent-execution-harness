import type { RUN_SCHEMA_VERSION, MODES, PHASES, TASK_STATUSES } from "./constants.js";
import type { AgentHarnessPlan } from "./plan-types.js";
import type { HarnessClaim } from "./action-types.js";

export type HarnessMode = (typeof MODES)[number];
export type HarnessPhase = (typeof PHASES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Evidence {
  evidence_id: string;
  check: string;
  result: "pass" | "fail" | "halt";
  exit_code: number;
  output_excerpt: string;
  scope_covered: string;
  residual_gap?: string;
}

export interface RunTask {
  task_id: string;
  status: TaskStatus;
  acceptance_criteria: string;
  evidence_ids: string[];
  files?: string[];
}

export interface VerifiedClaim extends HarnessClaim {
  verified: boolean;
}

export interface AgentHarnessRunState {
  schema_version: typeof RUN_SCHEMA_VERSION;
  run_id: string;
  mode: HarnessMode;
  status: "in_progress" | "ready_for_report" | "completed" | "halt";
  phase: HarnessPhase;
  plan: AgentHarnessPlan;
  tasks: RunTask[];
  declared_files: string[];
  current_task_id: string | null;
  pending_gate: { task_id: string | null; command: string } | null;
  evidence: Evidence[];
  claims: HarnessClaim[];
  verified_claims: VerifiedClaim[];
  errors: string[];
  final_report: { summary: string; verified_claim_ids: string[] } | null;
  created_at: string;
  updated_at: string;
  context_summary?: string;
}
