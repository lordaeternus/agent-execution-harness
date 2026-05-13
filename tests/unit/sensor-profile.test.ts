import { describe, expect, it } from "vitest";
import { PLAN_SCHEMA_VERSION } from "../../src/core/constants.js";
import { sensorProfileForRisk, sensorWarningsForPlan } from "../../src/core/sensor-profile.js";

describe("sensor profile", () => {
  it("keeps L1 cheap and avoids heavy build or smoke requirements", () => {
    const ids = sensorProfileForRisk("L1").sensors.map((sensor) => sensor.id);
    expect(ids).toContain("focused_validation");
    expect(ids).not.toContain("build_or_contract_gate");
    expect(ids).not.toContain("smoke_when_applicable");
  });

  it("recommends stronger gates for L3 plans", () => {
    const ids = sensorProfileForRisk("L3").sensors.map((sensor) => sensor.id);
    expect(ids).toEqual(expect.arrayContaining(["build_or_contract_gate", "rollback_review", "smoke_when_applicable"]));
  });

  it("warns when L3 tasks omit evidence and broad gates", () => {
    const warnings = sensorWarningsForPlan({
      schema_version: PLAN_SCHEMA_VERSION,
      plan_id: "l3-warning",
      risk_level: "L3",
      rollback_expectation: "Revert files.",
      gates: ["pnpm test"],
      tasks: [{ task_id: "task-a", acceptance_criteria: "A passes." }],
    });
    expect(warnings.join("\n")).toContain("L3 task should declare required_evidence");
    expect(warnings.join("\n")).toContain("build, typecheck, or contract gate");
  });

  it("warns when L3 critical surfaces omit approved fixture evidence or justification", () => {
    const warnings = sensorWarningsForPlan({
      schema_version: PLAN_SCHEMA_VERSION,
      plan_id: "l3-fixture-warning",
      risk_level: "L3",
      rollback_expectation: "Revert files.",
      gates: ["pnpm exec tsc --noEmit", "pnpm test"],
      tasks: [{
        task_id: "auth-risk",
        surface: "auth",
        files: ["src/auth/session.ts"],
        acceptance_criteria: "Run `pnpm test` and pass auth behavior.",
        required_evidence: ["focused_tests", "authz_negative_test"],
      }],
    });
    expect(warnings.join("\n")).toContain("approved_fixture");
  });
});
