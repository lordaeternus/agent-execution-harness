import { spawnSync } from "node:child_process";
import type { AgentHarnessPlan } from "./plan-types.js";
import type { PatchApplyResult, PatchIntakeRequest, PatchIntakeResult } from "./patch-intake-types.js";
import { evaluateScopeGuard, normalizePath } from "./scope-guard.js";
import { validateWeakWorkerOutput } from "./handoff.js";

const CONFLICT_MARKER_PATTERN = /(^|\n)(<<<<<<<|=======|>>>>>>>)(?:\s|$)/;

export function validatePatchIntake(plan: AgentHarnessPlan, request: PatchIntakeRequest): PatchIntakeResult {
  const errors: string[] = [];
  const task = plan.tasks.find((item) => item.task_id === request.taskId);
  if (!task) {
    return rejected([`unknown task_id: ${request.taskId}`], []);
  }

  if (request.workerOutput !== undefined) {
    const worker = validateWeakWorkerOutput(plan, request.taskId, request.workerOutput);
    errors.push(...worker.errors.map((error) => `worker_output: ${error}`));
  }

  if (CONFLICT_MARKER_PATTERN.test(request.patchText)) errors.push("patch contains conflict markers");

  const changedFiles = parseUnifiedDiffChangedFiles(request.patchText);
  if (changedFiles.length === 0) errors.push("patch must be a non-empty unified diff");

  const allowedFiles = task.files ?? [];
  if (allowedFiles.length === 0) errors.push("task has no allowed files");

  const scope = evaluateScopeGuard({
    declared_files: allowedFiles,
    touched_files: changedFiles,
    generated_allowlist: [],
  });
  for (const file of scope.unexpected_files) errors.push(`patch changes file outside allowed_files: ${file}`);

  for (const file of changedFiles) {
    if (matchesAnyPath(file, task.forbidden_files ?? [])) errors.push(`patch changes forbidden file: ${file}`);
  }

  if (errors.length > 0) return rejected(errors, changedFiles);
  return {
    valid: true,
    errors: [],
    changed_files: changedFiles,
    next_actions: ["agent-harness patch intake --apply", "agent-harness verify"],
  };
}

export function parseUnifiedDiffChangedFiles(patchText: string): string[] {
  const files = new Set<string>();
  for (const line of patchText.split(/\r?\n/)) {
    if (!line.startsWith("--- ") && !line.startsWith("+++ ")) continue;
    const file = normalizeDiffPath(line.slice(4));
    if (file) files.add(file);
  }
  return [...files].sort();
}

export function checkPatchApply(cwd: string, patchPath: string): PatchApplyResult {
  const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd, encoding: "utf8" });
  if (inside.status !== 0 || inside.stdout.trim() !== "true") {
    return { applied: false, errors: ["git worktree required for --apply"] };
  }
  const checked = spawnSync("git", ["apply", "--check", patchPath], { cwd, encoding: "utf8" });
  if (checked.status !== 0) {
    return { applied: false, errors: [`git apply --check failed: ${compactProcessOutput(checked.stderr || checked.stdout)}`] };
  }
  return { applied: false, errors: [] };
}

export function applyPatchFile(cwd: string, patchPath: string): PatchApplyResult {
  const checked = checkPatchApply(cwd, patchPath);
  if (checked.errors.length > 0) return checked;
  const applied = spawnSync("git", ["apply", patchPath], { cwd, encoding: "utf8" });
  if (applied.status !== 0) {
    return { applied: false, errors: [`git apply failed: ${compactProcessOutput(applied.stderr || applied.stdout)}`] };
  }
  return { applied: true, errors: [] };
}

function normalizeDiffPath(value: string): string | null {
  const firstToken = value.trim().split(/\s+/)[0];
  if (!firstToken || firstToken === "/dev/null") return null;
  const withoutPrefix = firstToken.replace(/^[ab]\//, "");
  return normalizePath(withoutPrefix);
}

function matchesAnyPath(file: string, patterns: string[]): boolean {
  return patterns.map(normalizePath).some((pattern) => file === pattern || file.startsWith(`${pattern.replace(/\/$/, "")}/`));
}

function rejected(errors: string[], changedFiles: string[]): PatchIntakeResult {
  return {
    valid: false,
    errors,
    changed_files: changedFiles,
    next_actions: ["rerun task serial", "handoff validate"],
  };
}

function compactProcessOutput(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.slice(0, 240) || "unknown error";
}
