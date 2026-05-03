import { describe, expect, it } from "vitest";
import { classifyRepair } from "../../src/core/repair-playbooks.js";

describe("repair playbooks", () => {
  it.each([
    ["pnpm exec tsc --noEmit", "TS2322 Type string is not assignable", "typecheck"],
    ["pnpm lint", "eslint no-unused-vars", "lint"],
    ["pnpm test", "FAIL AssertionError expected true received false", "test"],
    ["pnpm build", "Cannot find module './x'", "build"],
    ["git reset --hard HEAD", "command blocked", "command_blocked"],
    ["agent-harness plan-lint", "schema_version must be agent_harness_plan_v1", "schema_validation"],
    ["agent-harness claim auto", "action verify_claims not allowed in phase task_start", "premature_claim"],
    ["agent-harness finish", "final_report requires all tasks reconciled", "premature_claim"],
    ["agent-harness report", "evidence_policy: score=80 missing=file_scope", "missing_file_scope"],
    ["agent-harness verify", "weak mode requires evidence_type or evidence_types", "wrong_evidence_type"],
    ["agent-harness task start", "file not declared: src/a.ts", "undeclared_file"],
    ["agent-harness task start", "too many files for weak mode", "too_many_files"],
    ["agent-harness task start", "action edit_file_ready not allowed in phase report", "phase_order"],
  ])("classifies %s", (command, output, kind) => {
    const repair = classifyRepair(command, output, 120);
    expect(repair.kind).toBe(kind);
    expect(repair.hint.length).toBeLessThanOrEqual(120);
    expect(repair.stop_after_attempts).toBe(3);
  });
});
