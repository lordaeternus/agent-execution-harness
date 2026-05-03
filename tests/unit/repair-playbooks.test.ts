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
  ])("classifies %s", (command, output, kind) => {
    const repair = classifyRepair(command, output, 120);
    expect(repair.kind).toBe(kind);
    expect(repair.hint.length).toBeLessThanOrEqual(120);
    expect(repair.stop_after_attempts).toBe(3);
  });
});
