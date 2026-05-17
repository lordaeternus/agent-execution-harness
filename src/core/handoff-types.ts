import type { AgentHarnessTask } from "./plan-types.js";

export type WeakWorkerStatus = "done" | "blocked" | "failed";

export interface HandoffPacket {
  role: "implementation_worker_only";
  target: "weak-worker";
  task_id: string;
  depends_on: string[];
  blocks_tasks: string[];
  allowed_files: string[];
  allowed_commands: string[];
  context_refs?: string[];
  forbidden_actions: string[];
  blocked_if: string[];
  exact_steps: string[];
  output_schema: {
    status: "done|blocked|failed";
    files_changed: "string[]";
    evidence: "array";
    residual_risk: "string";
    patch_file: "string";
  };
}

export interface WeakWorkerEvidence {
  command?: string;
  check?: string;
  result?: "pass" | "fail" | "not_run";
  output_excerpt?: string;
}

export interface WeakWorkerOutput {
  status: WeakWorkerStatus;
  files_changed: string[];
  evidence: WeakWorkerEvidence[];
  residual_risk: string;
  patch_file?: string;
}

export interface HandoffValidationResult {
  valid: boolean;
  errors: string[];
}

export interface HandoffTaskContext {
  task: AgentHarnessTask;
  planGates: string[];
  blocksTasks: string[];
}
