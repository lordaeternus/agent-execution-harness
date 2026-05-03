import type { RiskLevel, TaskSurface } from "./plan-types.js";

export type PlanDiagnosticSeverity = "error" | "warning";

export interface PlanCompilerDiagnostic {
  code: string;
  severity: PlanDiagnosticSeverity;
  message: string;
  task_id?: string;
}

export interface CompiledTaskContract {
  task_id: string;
  surface: TaskSurface;
  files: string[];
  required_evidence: string[];
  acceptance_criteria: string;
  risk_level: RiskLevel;
  max_files_allowed: number;
}

export interface CompiledPlan {
  plan_id: string;
  risk_level: RiskLevel;
  tasks: CompiledTaskContract[];
  diagnostics: PlanCompilerDiagnostic[];
  status: "success" | "error";
}
