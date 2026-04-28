import type { CONFIG_SCHEMA_VERSION } from "./constants.js";

export interface CommandPolicy {
  allow?: string[];
  deny?: string[];
}

export interface AgentHarnessConfig {
  schema_version: typeof CONFIG_SCHEMA_VERSION;
  artifact_dir: string;
  product_paths: string[];
  required_scripts: string[];
  doctor_profile: "generic" | "stetix" | "strict" | "ci";
  command_policy: CommandPolicy;
}
