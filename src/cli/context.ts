import path from "node:path";
import { loadConfig } from "../core/config.js";
import { loadRun } from "../core/artifact-store.js";
import { readJson } from "../core/utils.js";
import type { AgentHarnessConfig } from "../core/config-types.js";
import type { AgentHarnessPlan } from "../core/plan-types.js";
import type { AgentHarnessRunState } from "../core/run-types.js";
import { stringFlag } from "./args.js";
import { loadActiveSession } from "./session-store.js";

export interface CliRunContext {
  planPath: string;
  runId: string;
  mode: string;
  artifactDir: string;
  config: AgentHarnessConfig;
  plan: AgentHarnessPlan;
  state: AgentHarnessRunState | null;
}

export function resolveCliRunContext(flags: Record<string, string | boolean>, cwd: string): CliRunContext {
  const config = loadConfig(cwd, stringFlag(flags, "config") ?? "agent-harness.config.json");
  const output = stringFlag(flags, "output");
  if (output === "ultra_compact" || output === "compact" || output === "standard" || output === "full") config.token_budget.observation_format = output;
  const artifactDir = stringFlag(flags, "artifact-dir") ?? config.artifact_dir;
  const session = loadActiveSession(cwd, artifactDir);
  const planPath = stringFlag(flags, "plan") ?? session?.plan_path;
  const runId = stringFlag(flags, "run-id") ?? session?.run_id;
  const mode = stringFlag(flags, "mode") ?? session?.mode ?? "constrained";
  if (!planPath) throw new Error("--plan is required when no active session exists");
  if (!runId) throw new Error("--run-id is required when no active session exists");
  const plan = readJson<AgentHarnessPlan>(path.resolve(cwd, planPath));
  const state = loadRun(cwd, artifactDir, runId);
  return { planPath, runId, mode, artifactDir, config, plan, state };
}
