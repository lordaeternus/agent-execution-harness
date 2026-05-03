export interface ScopeGuardConfig {
  enabled: boolean;
  generated_allowlist: string[];
}

export interface ScopeGuardResult {
  allowed: boolean;
  declared_files: string[];
  touched_files: string[];
  unexpected_files: string[];
  summary: string;
}

export function evaluateScopeGuard(input: {
  declared_files: string[];
  touched_files: string[];
  generated_allowlist: string[];
}): ScopeGuardResult {
  const declared = unique(input.declared_files.map(normalizePath));
  const touched = unique(input.touched_files.map(normalizePath));
  const allowlist = input.generated_allowlist.map(normalizePattern);
  const unexpected = touched.filter((file) => !isDeclared(file, declared) && !isAllowlisted(file, allowlist));
  return {
    allowed: unexpected.length === 0,
    declared_files: declared,
    touched_files: touched,
    unexpected_files: unexpected,
    summary: unexpected.length ? `unexpected_files=${unexpected.join(",")}` : `touched_files=${touched.length}`,
  };
}

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

export function collectGitTouchedFiles(cwd: string): string[] {
  const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd, encoding: "utf8" });
  if (inside.status !== 0 || inside.stdout.trim() !== "true") return [];
  const diff = spawnSync("git", ["diff", "--name-only"], { cwd, encoding: "utf8" });
  if (diff.status !== 0) return [];
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd, encoding: "utf8" });
  return unique(`${diff.stdout}\n${untracked.status === 0 ? untracked.stdout : ""}`.split(/\r?\n/).map(normalizePath));
}

export function applyScopeGuardToState(
  state: AgentHarnessRunState,
  touchedFiles: string[],
  generatedAllowlist: string[],
): AgentHarnessRunState {
  const baseline = new Set((state.baseline_touched_files ?? []).map(normalizePath));
  const newTouchedFiles = touchedFiles.filter((file) => !baseline.has(normalizePath(file)));
  const result = evaluateScopeGuard({
    declared_files: state.declared_files,
    touched_files: newTouchedFiles,
    generated_allowlist: generatedAllowlist,
  });
  return {
    ...state,
    touched_files: result.touched_files,
    unexpected_files: result.unexpected_files,
    errors: result.allowed ? state.errors : [...state.errors.filter((item) => !item.startsWith("unexpected_file_changed:")), `unexpected_file_changed: ${result.unexpected_files.join(",")}`],
  };
}

export function applyScopeBaselineToState(state: AgentHarnessRunState, touchedFiles: string[]): AgentHarnessRunState {
  return { ...state, baseline_touched_files: unique(touchedFiles.map(normalizePath)) };
}

function normalizePattern(value: string): string {
  return normalizePath(value).replace(/\*\*$/, "").replace(/\*$/, "");
}

function isDeclared(file: string, declared: string[]): boolean {
  return declared.some((item) => file === item || file.startsWith(`${item.replace(/\/$/, "")}/`));
}

function isAllowlisted(file: string, allowlist: string[]): boolean {
  return allowlist.some((item) => item && (file === item || file.startsWith(item)));
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
import { spawnSync } from "node:child_process";
import type { AgentHarnessRunState } from "./run-types.js";
