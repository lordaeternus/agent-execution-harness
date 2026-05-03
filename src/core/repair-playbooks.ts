export type RepairKind =
  | "typecheck"
  | "lint"
  | "test"
  | "build"
  | "command_blocked"
  | "schema_validation"
  | "premature_claim"
  | "missing_file_scope"
  | "wrong_evidence_type"
  | "undeclared_file"
  | "too_many_files"
  | "unexpected_file_changed"
  | "phase_order"
  | "unknown";

export interface RepairHint {
  kind: RepairKind;
  hint: string;
  stop_after_attempts: number;
}

const RULES: Array<[RepairKind, RegExp, string]> = [
  ["premature_claim", /(claim auto requires claims|(claim auto|verify_claims|final_report).*all tasks reconciled|all tasks reconciled|claim.*phase task_start)/i, "Run next --exact and complete every remaining task before claim auto or finish."],
  ["missing_file_scope", /(file_scope|missing_required_evidence|missing=file_scope)/i, "Rerun verify with --scope \"file_scope <touched-files>\" for the active task."],
  ["wrong_evidence_type", /(requires evidence_type|evidence_type|evidence_types|wrong evidence)/i, "Rerun verify with --type or --types matching the plan required_evidence."],
  ["undeclared_file", /(file not declared|declare_files|undeclared)/i, "Run files declare with the exact task files, then rerun task start."],
  ["too_many_files", /(too many files|max_files|touches .* files)/i, "Split the task or run weak mode with at most the configured files per task."],
  ["unexpected_file_changed", /(unexpected_file_changed|unexpected_files|outside.*plan|arquivo.*fora)/i, "Revert or explicitly add the unexpected file to the plan before finish."],
  ["phase_order", /(not allowed in phase|requires a pending matching gate|pending gate|phase)/i, "Run next --exact and execute only the returned command for the current phase."],
  ["command_blocked", /(command blocked|dangerous command)/i, "Stop. Replace command with a non-destructive focused gate or ask owner only for destructive ops."],
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
