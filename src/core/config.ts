import fs from "node:fs";
import path from "node:path";
import { CONFIG_SCHEMA_VERSION, DEFAULT_ARTIFACT_DIR } from "./constants.js";
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
  };
}

export function loadConfig(cwd = process.cwd(), configPath = "agent-harness.config.json"): AgentHarnessConfig {
  const resolved = path.resolve(cwd, configPath);
  if (!fs.existsSync(resolved)) return defaultConfig();
  const config = JSON.parse(fs.readFileSync(resolved, "utf8")) as AgentHarnessConfig;
  validateConfig(config);
  assertSafeRelativePath(config.artifact_dir, "artifact_dir");
  return config;
}
