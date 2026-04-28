import type { ACTION_SCHEMA_VERSION } from "./constants.js";
import type { Evidence } from "./run-types.js";

export type HarnessActionType =
  | "read_context"
  | "declare_files"
  | "edit_file_ready"
  | "run_gate"
  | "record_evidence"
  | "verify_claims"
  | "final_report"
  | "halt_for_risk";

export interface HarnessClaim {
  claim_id: string;
  kind:
    | "file_exists"
    | "command_ran"
    | "gate_passed"
    | "gate_failed"
    | "dangerous_command_blocked"
    | "task_reconciled"
    | "bug_reproduced_before_fix"
    | "bug_fixed_after_fix"
    | "acceptance_criteria_met"
    | "contract_preserved"
    | "rollback_defined"
    | "no_product_code_changed";
  value: string;
  evidence_id: string;
}

export interface AgentHarnessAction {
  schema_version: typeof ACTION_SCHEMA_VERSION;
  type: HarnessActionType;
  summary?: string;
  files?: string[];
  task_id?: string;
  command?: string;
  evidence?: Evidence;
  claims?: HarnessClaim[];
  reason?: string;
  residual_risk?: string;
}
