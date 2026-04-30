import path from "node:path";
import { ACTION_SCHEMA_VERSION } from "../core/constants.js";
import { loadConfig } from "../core/config.js";
import { loadRun, saveRun } from "../core/artifact-store.js";
import { processHarnessAction } from "../core/runner.js";
import { readJson } from "../core/utils.js";
import type { AgentHarnessAction } from "../core/action-types.js";
import type { AgentHarnessPlan } from "../core/plan-types.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeJson } from "./output.js";

export function runCommand(args: string[], cwd = process.cwd()): void {
  const flags = parseFlags(args);
  const planPath = stringFlag(flags, "plan", true)!;
  const runId = stringFlag(flags, "run-id", true)!;
  const mode = stringFlag(flags, "mode") ?? "standard";
  const actionRaw = stringFlag(flags, "action", true)!;
  const config = loadConfig(cwd, stringFlag(flags, "config") ?? "agent-harness.config.json");
  const output = stringFlag(flags, "output");
  if (output === "ultra_compact" || output === "compact" || output === "standard" || output === "full") config.token_budget.observation_format = output;
  const artifactDir = stringFlag(flags, "artifact-dir") ?? config.artifact_dir;
  const plan = readJson<AgentHarnessPlan>(path.resolve(cwd, planPath));
  const action = JSON.parse(actionRaw) as AgentHarnessAction;
  if (!action.schema_version) action.schema_version = ACTION_SCHEMA_VERSION;
  const previousState = loadRun(cwd, artifactDir, runId);
  const result = processHarnessAction({ plan, previousState, action, runId, mode, config });
  const artifactPath = saveRun(cwd, artifactDir, result.state);
  writeJson({ ...result.observation, artifacts: [{ type: "run_state", path: artifactPath }] });
}
