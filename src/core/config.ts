import fs from "node:fs";
import path from "node:path";
import { CONFIG_SCHEMA_VERSION, DEFAULT_ARTIFACT_DIR } from "./constants.js";
import { defaultCodebaseMemoryConfig } from "./codebase-memory.js";
import { defaultLearningMemoryConfig } from "./learning-memory.js";
import type { AgentHarnessConfig } from "./config-types.js";
import { validateConfig } from "./schema-validation.js";
import { assertSafeRelativePath } from "./utils.js";

export function defaultConfig(): AgentHarnessConfig {
  return {
    schema_version: CONFIG_SCHEMA_VERSION,
    artifact_dir: DEFAULT_ARTIFACT_DIR,
    product_paths: ["src/", "supabase/"],
    required_scripts: [],
    doctor_profile: "generic",
    command_policy: {
      allow: [],
      deny: ["DROP", "TRUNCATE", "git reset --hard", "push --force", "force-with-lease"],
    },
    token_budget: {
      observation_format: "standard",
      summary_max_chars: 240,
      output_excerpt_max_chars: 600,
      report_compact_max_chars: 1600,
    },
    codebase_memory: defaultCodebaseMemoryConfig(),
    learning_memory: defaultLearningMemoryConfig(),
    weak_model: {
      enabled: true,
      max_files_per_task: 2,
      max_claims_per_action: 8,
      summary_max_chars: 180,
      output_excerpt_max_chars: 360,
      repair_hint_max_chars: 280,
      next_output_format: "ultra_compact",
    },
  };
}

export function loadConfig(cwd = process.cwd(), configPath = "agent-harness.config.json"): AgentHarnessConfig {
  const resolved = path.resolve(cwd, configPath);
  if (!fs.existsSync(resolved)) return defaultConfig();
  const config = JSON.parse(fs.readFileSync(resolved, "utf8")) as AgentHarnessConfig;
  const defaults = defaultConfig();
  const merged = {
    ...defaults,
    ...config,
    command_policy: { ...defaults.command_policy, ...(config.command_policy ?? {}) },
    token_budget: { ...defaults.token_budget, ...(config.token_budget ?? {}) },
    codebase_memory: { ...defaults.codebase_memory, ...(config.codebase_memory ?? {}) },
    learning_memory: { ...defaults.learning_memory, ...(config.learning_memory ?? {}) },
    weak_model: { ...defaults.weak_model, ...(config.weak_model ?? {}) },
  };
  validateConfig(merged);
  assertSafeRelativePath(merged.artifact_dir, "artifact_dir");
  return merged;
}
