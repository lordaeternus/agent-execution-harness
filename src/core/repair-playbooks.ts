export type RepairKind = "typecheck" | "lint" | "test" | "build" | "command_blocked" | "schema_validation" | "unknown";

export interface RepairHint {
  kind: RepairKind;
  hint: string;
  stop_after_attempts: number;
}

const RULES: Array<[RepairKind, RegExp, string]> = [
  ["command_blocked", /(command blocked|dangerous command|not allowed)/i, "Stop. Replace command with a non-destructive focused gate or ask owner only for destructive ops."],
  ["schema_validation", /(schema_version|must be|required|invalid|schema|plan-lint)/i, "Fix JSON shape against the harness schema, then rerun plan-lint before execution."],
  ["typecheck", /(TS\d{4}|Type .* is not assignable|Property .* does not exist|tsc)/i, "Read first TS error, fix the named symbol or type contract, then rerun the same typecheck."],
  ["lint", /(eslint|lint|no-unused-vars|prefer-|Parsing error)/i, "Fix the exact lint rule in the touched file only, then rerun the same lint command."],
  ["test", /(FAIL|AssertionError|expected .* received|vitest|jest|test failed)/i, "Open the failing test and implementation path, fix behavior not the assertion, then rerun the focused test."],
  ["build", /(build failed|vite|rollup|Cannot find module|Module not found)/i, "Resolve the missing import/export or build config mismatch, then rerun build."],
];

export function classifyRepair(command: string, output: string, maxChars = 280): RepairHint {
  const source = `${command}\n${output}`;
  const match = RULES.find(([, pattern]) => pattern.test(source));
  const hint = match
    ? { kind: match[0], hint: match[2], stop_after_attempts: 3 }
    : { kind: "unknown" as const, hint: "Read the shortest failing excerpt, make one scoped fix, rerun the identical gate; halt after 3 equivalent failures.", stop_after_attempts: 3 };
  return { ...hint, hint: truncate(hint.hint, maxChars) };
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}
