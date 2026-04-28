import path from "node:path";
import { ACTION_SCHEMA_VERSION } from "../core/constants.js";
import { loadConfig } from "../core/config.js";
import { loadRun, saveRun } from "../core/artifact-store.js";
import { processHarnessAction } from "../core/runner.js";
import { readJson } from "../core/utils.js";
import type { AgentHarnessPlan } from "../core/plan-types.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeJson } from "./output.js";

export function executeCommand(args: string[], cwd = process.cwd()): void {
  const flags = parseFlags(args);
  const planPath = stringFlag(flags, "plan", true)!;
  const runId = stringFlag(flags, "run-id", true)!;
  const mode = stringFlag(flags, "mode") ?? "constrained";
  const config = loadConfig(cwd, stringFlag(flags, "config") ?? "agent-harness.config.json");
  const artifactDir = stringFlag(flags, "artifact-dir") ?? config.artifact_dir;
  const previous = loadRun(cwd, artifactDir, runId);
  if (previous) {
    writeJson({
      status: previous.status === "halt" ? "halt" : "success",
      summary: `${previous.phase}: resume existing run`,
      artifacts: [{ type: "run_state", path: path.resolve(cwd, artifactDir, `${runId}.json`) }],
      next_actions: previous.phase === "completed" ? [] : ["continue_with_run"],
      errors: previous.errors,
    });
    return;
  }
  const plan = readJson<AgentHarnessPlan>(path.resolve(cwd, planPath));
  const result = processHarnessAction({
    plan,
    previousState: null,
    runId,
    mode,
    config,
    action: { schema_version: ACTION_SCHEMA_VERSION, type: "read_context", summary: "agent-harness execute initialized run" },
  });
  const artifactPath = saveRun(cwd, artifactDir, result.state);
  writeJson({ ...result.observation, artifacts: [{ type: "run_state", path: artifactPath }], next_actions: ["declare_files"] });
}
