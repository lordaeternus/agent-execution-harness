import type { AgentHarnessConfig } from "./config-types.js";
import type { HarnessMode } from "./run-types.js";

export interface EffectiveExecutionProfile {
  mode: HarnessMode;
  maxFilesPerTask: number;
  maxClaimsPerAction: number;
  summaryMaxChars: number;
  outputExcerptMaxChars: number;
  repairHintMaxChars: number;
  enforceStructuredEvidence: boolean;
  observationFormat: "ultra_compact" | "compact" | "standard" | "full";
}

export function effectiveExecutionProfile(mode: string, config: AgentHarnessConfig): EffectiveExecutionProfile {
  const weak = config.weak_model;
  if (mode === "weak") {
    return {
      mode: "weak",
      maxFilesPerTask: weak?.max_files_per_task ?? 2,
      maxClaimsPerAction: weak?.max_claims_per_action ?? 8,
      summaryMaxChars: weak?.summary_max_chars ?? 180,
      outputExcerptMaxChars: weak?.output_excerpt_max_chars ?? 360,
      repairHintMaxChars: weak?.repair_hint_max_chars ?? 280,
      enforceStructuredEvidence: true,
      observationFormat: weak?.next_output_format ?? "ultra_compact",
    };
  }
  if (mode === "constrained") {
    return {
      mode: "constrained",
      maxFilesPerTask: 3,
      maxClaimsPerAction: 20,
      summaryMaxChars: config.token_budget.summary_max_chars,
      outputExcerptMaxChars: config.token_budget.output_excerpt_max_chars,
      repairHintMaxChars: 360,
      enforceStructuredEvidence: true,
      observationFormat: config.token_budget.observation_format,
    };
  }
  return {
    mode: mode === "strong" ? "strong" : "standard",
    maxFilesPerTask: Number.POSITIVE_INFINITY,
    maxClaimsPerAction: Number.POSITIVE_INFINITY,
    summaryMaxChars: config.token_budget.summary_max_chars,
    outputExcerptMaxChars: config.token_budget.output_excerpt_max_chars,
    repairHintMaxChars: 420,
    enforceStructuredEvidence: false,
    observationFormat: config.token_budget.observation_format,
  };
}
