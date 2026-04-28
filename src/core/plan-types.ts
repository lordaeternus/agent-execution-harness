import type { PLAN_SCHEMA_VERSION } from "./constants.js";

export type RiskLevel = "L1" | "L2" | "L3";

export interface AgentHarnessTask {
  task_id: string;
  acceptance_criteria: string;
}

export interface AgentHarnessPlan {
  schema_version: typeof PLAN_SCHEMA_VERSION;
  plan_id: string;
  risk_level: RiskLevel;
  rollback_expectation: string;
  gates: string[];
  tasks: AgentHarnessTask[];
}
