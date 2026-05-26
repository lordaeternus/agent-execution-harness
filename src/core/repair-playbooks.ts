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
  ["premature_claim", /(claim auto requires claims|(claim auto|verify_claims|final_report).*all tasks reconciled|all tasks reconciled|claim.*phase task_start)/i, "Run next --exact --micro; finish all tasks before claim/finish."],
  ["missing_file_scope", /(file_scope|missing_required_evidence|missing=file_scope)/i, "Rerun verify with --scope \"file_scope <touched-files>\"."],
  ["wrong_evidence_type", /(requires evidence_type|evidence_type|evidence_types|wrong evidence)/i, "Rerun verify with required --type or --types."],
  ["undeclared_file", /(file not declared|declare_files|undeclared)/i, "Declare exact task files, then rerun task start."],
  ["too_many_files", /(too many files|max_files|touches .* files)/i, "Split the task or keep weak mode within file limits."],
  ["unexpected_file_changed", /(unexpected_file_changed|unexpected_files|outside.*plan|arquivo.*fora)/i, "Revert or add the unexpected file to the plan before finish."],
  ["phase_order", /(not allowed in phase|requires a pending matching gate|pending gate|phase)/i, "Run next --exact --micro and only execute its command."],
  ["command_blocked", /(command blocked|dangerous command)/i, "Stop. Use a non-destructive gate or ask owner for destructive ops."],
  ["schema_validation", /(schema_version|must be|required|invalid|schema|plan-lint)/i, "Fix JSON against schema, then rerun plan-lint."],
  ["typecheck", /(TS\d{4}|Type .* is not assignable|Property .* does not exist|tsc)/i, "Fix the first TS error, then rerun the same typecheck."],
  ["lint", /(eslint|lint|no-unused-vars|prefer-|Parsing error)/i, "Fix the exact lint rule in touched files only."],
  ["test", /(FAIL|AssertionError|expected .* received|vitest|jest|test failed)/i, "Fix behavior from the failing test, then rerun it."],
  ["build", /(build failed|vite|rollup|Cannot find module|Module not found)/i, "Fix missing import/export or build config, then rerun build."],
];

export function classifyRepair(command: string, output: string, maxChars = 280): RepairHint {
  const source = `${command}\n${output}`;
  const match = RULES.find(([, pattern]) => pattern.test(source));
  const hint = match
    ? { kind: match[0], hint: match[2], stop_after_attempts: 3 }
    : { kind: "unknown" as const, hint: "Read the shortest failure, make one scoped fix, rerun same gate; halt after 3 repeats.", stop_after_attempts: 3 };
  return { ...hint, hint: truncate(hint.hint, maxChars) };
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}
