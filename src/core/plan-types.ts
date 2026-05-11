import type { PLAN_SCHEMA_VERSION } from "./constants.js";

export type RiskLevel = "L1" | "L2" | "L3";
export type TaskSurface = "ui_layout" | "ui" | "backend" | "api" | "auth" | "db" | "ai" | "docs" | "generic";

export interface AgentHarnessTask {
  task_id: string;
  acceptance_criteria: string;
  depends_on?: string[];
  surface?: TaskSurface;
  files?: string[];
  forbidden_files?: string[];
  expected_diff?: string;
  required_evidence?: string[];
  required_checks?: string[];
  allowed_commands?: string[];
  rollback_command?: string;
}

export interface AgentHarnessPlan {
  schema_version: typeof PLAN_SCHEMA_VERSION;
  plan_id: string;
  risk_level: RiskLevel;
  rollback_expectation: string;
  execution_profile?: "standard" | "constrained" | "weak" | "strict";
  gates: string[];
  tasks: AgentHarnessTask[];
}
