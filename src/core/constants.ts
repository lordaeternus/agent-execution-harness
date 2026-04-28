export const PLAN_SCHEMA_VERSION = "agent_harness_plan_v1";
export const ACTION_SCHEMA_VERSION = "agent_harness_action_v1";
export const RUN_SCHEMA_VERSION = "agent_harness_run_v1";
export const CONFIG_SCHEMA_VERSION = "agent_harness_config_v1";
export const DEFAULT_ARTIFACT_DIR = ".agent-harness/runs";
export const MODES = ["strong", "standard", "constrained"] as const;
export const PHASES = ["init", "preflight", "task_start", "gate", "evidence", "report", "halt", "completed"] as const;
export const TASK_STATUSES = ["not_started", "in_progress", "completed", "blocked", "deferred", "cancelled"] as const;
