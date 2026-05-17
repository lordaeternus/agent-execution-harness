import { describe, expect, it } from "vitest";
import { parseUnifiedDiffChangedFiles, validatePatchIntake } from "../../src/core/patch-intake.js";
import type { AgentHarnessPlan } from "../../src/core/plan-types.js";
import { PLAN_SCHEMA_VERSION } from "../../src/core/constants.js";

const plan: AgentHarnessPlan = {
  schema_version: PLAN_SCHEMA_VERSION,
  plan_id: "patch-intake-plan",
  risk_level: "L2",
  rollback_expectation: "Revert created files.",
  gates: ["node --version"],
  tasks: [
    {
      task_id: "patch-task",
      files: ["src/allowed.ts"],
      forbidden_files: ["src/secret.ts"],
      allowed_commands: ["node --version"],
      acceptance_criteria: "Patch allowed file and run node.",
    },
  ],
};

const validWorkerOutput = {
  status: "done",
  files_changed: ["src/allowed.ts"],
  evidence: [{ command: "node --version", result: "pass", output_excerpt: "v22.0.0" }],
  residual_risk: "none",
};

describe("patch intake", () => {
  it("parses changed files from unified diff headers", () => {
    expect(parseUnifiedDiffChangedFiles(diffFor("src/allowed.ts"))).toEqual(["src/allowed.ts"]);
  });

  it("accepts an allowed patch with valid worker output", () => {
    const result = validatePatchIntake(plan, {
      taskId: "patch-task",
      patchText: diffFor("src/allowed.ts"),
      workerOutput: validWorkerOutput,
    });
    expect(result).toMatchObject({
      valid: true,
      errors: [],
      changed_files: ["src/allowed.ts"],
    });
  });

  it("rejects an empty or malformed patch", () => {
    const result = validatePatchIntake(plan, { taskId: "patch-task", patchText: "not a diff" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("patch must be a non-empty unified diff");
  });

  it("rejects files outside allowed_files", () => {
    const result = validatePatchIntake(plan, { taskId: "patch-task", patchText: diffFor("src/outside.ts") });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("patch changes file outside allowed_files: src/outside.ts");
  });

  it("rejects forbidden files even when they are declared", () => {
    const unsafePlan: AgentHarnessPlan = {
      ...plan,
      tasks: [{ ...plan.tasks[0], files: ["src/secret.ts"], forbidden_files: ["src/secret.ts"] }],
    };
    const result = validatePatchIntake(unsafePlan, { taskId: "patch-task", patchText: diffFor("src/secret.ts") });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("patch changes forbidden file: src/secret.ts");
  });

  it("rejects conflict markers", () => {
    const result = validatePatchIntake(plan, {
      taskId: "patch-task",
      patchText: `${diffFor("src/allowed.ts")}\n<<<<<<< HEAD\n`,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("patch contains conflict markers");
  });
});

function diffFor(file: string): string {
  return [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "",
  ].join("\n");
}
