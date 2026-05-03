import type { CONFIG_SCHEMA_VERSION } from "./constants.js";
import type { LearningMemoryConfig } from "./learning-types.js";

export interface CommandPolicy {
  allow?: string[];
  deny?: string[];
}

export type ObservationFormat = "ultra_compact" | "compact" | "standard" | "full";

export interface TokenBudget {
  observation_format: ObservationFormat;
  summary_max_chars: number;
  output_excerpt_max_chars: number;
  report_compact_max_chars: number;
}

export interface CodebaseMemoryConfig {
  enabled: boolean;
  memory_dir: string;
  default_strategy: "off" | "query" | "refresh";
  stale_after_days: number;
  max_summary_chars: number;
  surface_budgets: Record<string, number>;
  high_risk_surfaces: string[];
}

export interface WeakModelProfile {
  enabled: boolean;
  max_files_per_task: number;
  max_claims_per_action: number;
  summary_max_chars: number;
  output_excerpt_max_chars: number;
  repair_hint_max_chars: number;
  next_output_format: "ultra_compact" | "compact";
}

export interface AgentHarnessConfig {
  schema_version: typeof CONFIG_SCHEMA_VERSION;
  artifact_dir: string;
  product_paths: string[];
  required_scripts: string[];
  doctor_profile: "generic" | "stetix" | "strict" | "ci";
  command_policy: CommandPolicy;
  token_budget: TokenBudget;
  codebase_memory?: CodebaseMemoryConfig;
  learning_memory?: LearningMemoryConfig;
  weak_model?: WeakModelProfile;
}
