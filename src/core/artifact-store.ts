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

export function fullArtifactPath(cwd: string, artifactDir: string, runId: string): string {
  assertSafeRelativePath(artifactDir, "artifact_dir");
  assertSafeId(runId, "run_id");
  return path.resolve(cwd, artifactDir, `${runId}.full.json`);
}

export function currentArtifactPath(cwd: string, artifactDir: string, runId: string): string {
  assertSafeRelativePath(artifactDir, "artifact_dir");
  assertSafeId(runId, "run_id");
  return path.resolve(cwd, artifactDir, `${runId}.current.json`);
}

export function loadRun(cwd: string, artifactDir: string, runId: string): AgentHarnessRunState | null {
  const file = [fullArtifactPath(cwd, artifactDir, runId), artifactPath(cwd, artifactDir, runId)].find((candidate) => fs.existsSync(candidate));
  if (!file) return null;
  const state = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  validateRunState(state);
  return state;
}

export function saveRun(cwd: string, artifactDir: string, state: AgentHarnessRunState): string {
  const full = fullArtifactPath(cwd, artifactDir, state.run_id);
  const current = currentArtifactPath(cwd, artifactDir, state.run_id);
  const legacy = artifactPath(cwd, artifactDir, state.run_id);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(state, null, 2)}\n`);
  fs.writeFileSync(current, `${JSON.stringify(minimalRunState(state))}\n`);
  fs.writeFileSync(legacy, `${JSON.stringify(state, null, 2)}\n`);
  return full;
}

function minimalRunState(state: AgentHarnessRunState): Record<string, unknown> {
  return {
    schema_version: state.schema_version,
    run_id: state.run_id,
    mode: state.mode,
    status: state.status,
    phase: state.phase,
    current_task_id: state.current_task_id,
    pending_gate: state.pending_gate,
    tasks: state.tasks.map((task) => ({
      task_id: task.task_id,
      status: task.status,
      evidence_ids: task.evidence_ids,
      missing: state.evidence_policy?.tasks.find((item) => item.task_id === task.task_id)?.missing ?? [],
    })),
    evidence_policy: state.evidence_policy,
    errors: state.errors,
    updated_at: state.updated_at,
  };
}
