import fs from "node:fs";
import path from "node:path";
import type { AgentHarnessConfig } from "./config-types.js";
import type { AgentHarnessRunState } from "./run-types.js";
import { validateRunState } from "./schema-validation.js";

export interface SteeringSuggestion {
  key: string;
  count: number;
  suggestion: string;
}

export interface SteeringSummary {
  scanned: number;
  suggestions: SteeringSuggestion[];
}

export function analyzeRepeatedFailures(cwd: string, config: AgentHarnessConfig, threshold = 3, maxFiles = 30): SteeringSummary {
  const dir = path.resolve(cwd, config.artifact_dir);
  if (!fs.existsSync(dir)) return { scanned: 0, suggestions: [] };
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json") && !file.endsWith(".current.json"))
    .map((file) => path.join(dir, file))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    .slice(0, maxFiles);
  const counts = new Map<string, number>();
  let scanned = 0;
  for (const file of files) {
    const state = readRunState(file);
    if (!state) continue;
    scanned += 1;
    for (const key of failureKeys(state)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const suggestions = [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort(([left], [right]) => priority(left) - priority(right))
    .map(([key, count]) => ({ key, count, suggestion: suggestionForKey(key) }));
  return { scanned, suggestions };
}

function readRunState(file: string): AgentHarnessRunState | null {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    validateRunState(value);
    return value;
  } catch {
    return null;
  }
}

function failureKeys(state: AgentHarnessRunState): string[] {
  const keys = new Set<string>();
  if (state.status === "halt") keys.add("halt");
  if (state.unexpected_files?.length) keys.add("unexpected_file_changed");
  if (state.evidence_policy?.status === "missing_required_evidence") keys.add("missing_required_evidence");
  for (const error of state.errors) {
    const normalized = error.toLowerCase();
    if (normalized.includes("dangerous")) keys.add("dangerous_command");
    else if (normalized.includes("scope") || normalized.includes("unexpected")) keys.add("unexpected_file_changed");
    else if (normalized.includes("evidence")) keys.add("missing_required_evidence");
    else keys.add("generic_failure");
  }
  for (const evidence of state.evidence) {
    if (evidence.result !== "pass") keys.add(`gate_failed:${evidence.check}`);
  }
  return [...keys];
}

function suggestionForKey(key: string): string {
  if (key === "unexpected_file_changed") return "Make file_scope mandatory for similar L2/L3 plans and run scope guard before finish.";
  if (key === "missing_required_evidence") return "Declare required_evidence per task and block finish until evidence_policy is satisfied.";
  if (key === "dangerous_command") return "Move this flow to strict mode with task allowed_commands.";
  if (key.startsWith("gate_failed:")) return "Add a focused repair hint or cheaper preflight for the repeatedly failing gate.";
  if (key === "halt") return "Review halted artifacts and add the smallest feedforward rule that would have stopped the repeated failure earlier.";
  return "Review repeated failures and add one small control, test, or doc rule only if it prevents recurrence.";
}

function priority(key: string): number {
  if (key === "unexpected_file_changed") return 1;
  if (key === "missing_required_evidence") return 2;
  if (key === "dangerous_command") return 3;
  if (key.startsWith("gate_failed:")) return 4;
  if (key === "halt") return 9;
  return 8;
}
