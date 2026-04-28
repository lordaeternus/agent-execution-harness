import fs from "node:fs";
import path from "node:path";
import type { AgentHarnessRunState } from "./run-types.js";
import { assertSafeId, assertSafeRelativePath } from "./utils.js";
import { validateRunState } from "./schema-validation.js";

export function artifactPath(cwd: string, artifactDir: string, runId: string): string {
  assertSafeRelativePath(artifactDir, "artifact_dir");
  assertSafeId(runId, "run_id");
  return path.resolve(cwd, artifactDir, `${runId}.json`);
}

export function loadRun(cwd: string, artifactDir: string, runId: string): AgentHarnessRunState | null {
  const file = artifactPath(cwd, artifactDir, runId);
  if (!fs.existsSync(file)) return null;
  const state = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  validateRunState(state);
  return state;
}

export function saveRun(cwd: string, artifactDir: string, state: AgentHarnessRunState): string {
  const file = artifactPath(cwd, artifactDir, state.run_id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
  return file;
}
