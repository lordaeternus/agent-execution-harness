import { describe, expect, it } from "vitest";
import { compilePlan } from "../../src/core/plan-compiler.js";
import type { AgentHarnessPlan } from "../../src/core/plan-types.js";

function basePlan(overrides: Partial<AgentHarnessPlan> = {}): AgentHarnessPlan {
  return {
    schema_version: "agent_harness_plan_v1",
    plan_id: "compiler-plan",
    risk_level: "L2",
    rollback_expectation: "Revert edited files.",
    gates: ["pnpm test:run tests/unit/plan-compiler.test.ts"],
    tasks: [
      {
        task_id: "compiler-task",
        files: ["src/core/plan-compiler.ts"],
        acceptance_criteria: "Run `pnpm test:run tests/unit/plan-compiler.test.ts` and pass compiler cases.",
      },
    ],
    ...overrides,
  };
}

describe("plan compiler", () => {
  it("compiles a precise task contract", () => {
    const result = compilePlan(basePlan());
    expect(result.status).toBe("success");
    expect(result.tasks[0]).toMatchObject({ task_id: "compiler-task", surface: "backend", max_files_allowed: 3 });
  });

  it("rejects vague criteria and missing files", () => {
    const result = compilePlan(basePlan({ tasks: [{ task_id: "bad", acceptance_criteria: "fix" }] }));
    expect(result.status).toBe("error");
    expect(result.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining(["missing_files", "vague_acceptance"]));
  });

  it("rejects oversized L3 tasks and weak rollback", () => {
    const result = compilePlan(
      basePlan({
        risk_level: "L3",
        rollback_expectation: "revert",
        tasks: [
          {
            task_id: "large",
            files: ["src/a.ts", "src/b.ts", "src/c.ts"],
            acceptance_criteria: "Run `pnpm test` and verify the risky implementation.",
          },
        ],
      }),
    );
    expect(result.status).toBe("error");
    expect(result.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining(["weak_rollback", "too_many_files"]));
  });
});
