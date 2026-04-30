import path from "node:path";
import { ACTION_SCHEMA_VERSION } from "../core/constants.js";
import { loadConfig } from "../core/config.js";
import { loadRun, saveRun } from "../core/artifact-store.js";
import { processHarnessAction } from "../core/runner.js";
import { readJson } from "../core/utils.js";
import type { AgentHarnessPlan } from "../core/plan-types.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeCompactJson } from "./output.js";
import { saveActiveSession } from "./session-store.js";

export function sessionCommand(args: string[], cwd = process.cwd()): void {
  const [verb, ...rest] = args;
  if (verb !== "start") throw new Error("unknown session command");
  const flags = parseFlags(rest);
  const config = loadConfig(cwd, stringFlag(flags, "config") ?? "agent-harness.config.json");
  config.token_budget.observation_format = "ultra_compact";
  const artifactDir = stringFlag(flags, "artifact-dir") ?? config.artifact_dir;
  const planPath = stringFlag(flags, "plan", true)!;
  const runId = stringFlag(flags, "run-id", true)!;
  const mode = stringFlag(flags, "mode") ?? "constrained";
  const plan = readJson<AgentHarnessPlan>(path.resolve(cwd, planPath));
  const previousState = loadRun(cwd, artifactDir, runId);
  const result = previousState
    ? { state: previousState, observation: { status: previousState.status === "halt" ? "halt" as const : "success" as const, summary: `${previousState.phase} resume`, next_actions: [], artifacts: [], errors: previousState.errors } }
    : processHarnessAction({
        plan,
        previousState: null,
        runId,
        mode,
        config,
        action: { schema_version: ACTION_SCHEMA_VERSION, type: "read_context", summary: stringFlag(flags, "summary") ?? "ctx" },
      });
  const artifactPath = saveRun(cwd, artifactDir, result.state);
  const sessionPath = saveActiveSession(cwd, artifactDir, { plan_path: planPath, run_id: runId, mode });
  writeCompactJson({
    ...result.observation,
    artifacts: [
      { type: "run_state", path: path.relative(cwd, artifactPath) },
      { type: "active_session", path: path.relative(cwd, sessionPath) },
    ],
    next_actions: result.state.phase === "preflight" ? ["files declare"] : result.observation.next_actions,
  });
}
