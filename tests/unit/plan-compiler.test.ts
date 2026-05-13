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
        allowed_commands: ["pnpm test:run tests/unit/plan-compiler.test.ts"],
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
    expect(result.tasks[0]).toMatchObject({
      task_id: "compiler-task",
      depends_on: [],
      surface: "backend",
      max_files_allowed: 3,
      allowed_commands: ["pnpm test:run tests/unit/plan-compiler.test.ts"],
      next_allowed_action: "task_start",
    });
    expect(result.waves).toEqual([["compiler-task"]]);
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
            allowed_commands: ["pnpm test"],
            acceptance_criteria: "Run `pnpm test` and verify the risky implementation.",
          },
        ],
      }),
    );
    expect(result.status).toBe("error");
    expect(result.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining(["weak_rollback", "too_many_files"]));
  });

  it("requires task allowed_commands when plan gates are ambiguous", () => {
    const result = compilePlan(
      basePlan({
        gates: ["pnpm lint", "pnpm test"],
        tasks: [
          {
            task_id: "ambiguous",
            files: ["src/core/plan-compiler.ts"],
            required_evidence: ["focused_tests"],
            acceptance_criteria: "Run the focused compiler validation.",
          },
        ],
      }),
    );
    expect(result.status).toBe("error");
    expect(result.diagnostics.map((item) => item.code)).toContain("missing_allowed_commands");
  });

  it("uses the single plan gate as allowed command when unambiguous", () => {
    const result = compilePlan(
      basePlan({
        tasks: [
          {
            task_id: "single-gate",
            files: ["src/core/plan-compiler.ts"],
            required_evidence: ["focused_tests"],
            acceptance_criteria: "Run the focused compiler validation.",
          },
        ],
      }),
    );
    expect(result.status).toBe("success");
    expect(result.tasks[0].allowed_commands).toEqual(["pnpm test:run tests/unit/plan-compiler.test.ts"]);
    expect(result.diagnostics.map((item) => item.code)).toContain("acceptance_should_name_verification");
  });

  it("accepts structured task controls and rejects vague ones", () => {
    const result = compilePlan(
      basePlan({
        gates: ["pnpm lint", "pnpm test"],
        tasks: [
          {
            task_id: "structured",
            files: ["src/core/plan-compiler.ts"],
            forbidden_files: ["src/core/plan-compiler.ts", "src/core/runner.ts"],
            expected_diff: "fix",
            required_checks: ["focused test"],
            rollback_command: "revert",
            required_evidence: ["focused_tests"],
            acceptance_criteria: "Run `pnpm test:run tests/unit/plan-compiler.test.ts` and pass.",
          },
        ],
      }),
    );

    expect(result.status).toBe("error");
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["file_both_allowed_and_forbidden", "vague_expected_diff", "vague_required_check", "vague_rollback_command"]),
    );
  });

  it("uses required_checks as allowed commands when task commands are omitted", () => {
    const result = compilePlan(
      basePlan({
        gates: ["pnpm lint", "pnpm test"],
        tasks: [
          {
            task_id: "required-checks",
            files: ["src/core/plan-compiler.ts"],
            required_checks: ["pnpm test:run tests/unit/plan-compiler.test.ts"],
            required_evidence: ["focused_tests"],
            expected_diff: "Add structured validation coverage for compiler task contracts.",
            rollback_command: "git diff -- src/core/plan-compiler.ts",
            acceptance_criteria: "Run `pnpm test:run tests/unit/plan-compiler.test.ts` and pass.",
          },
        ],
      }),
    );

    expect(result.status).toBe("success");
    expect(result.tasks[0].allowed_commands).toEqual(["pnpm test:run tests/unit/plan-compiler.test.ts"]);
  });

  it("rejects invalid dependency graphs", () => {
    const result = compilePlan(
      basePlan({
        tasks: [
          {
            task_id: "dependent",
            depends_on: ["missing"],
            files: ["src/core/plan-compiler.ts"],
            allowed_commands: ["pnpm test"],
            acceptance_criteria: "Run `pnpm test` and pass.",
          },
        ],
      }),
    );
    expect(result.status).toBe("error");
    expect(result.diagnostics.map((item) => item.code)).toContain("missing_dependency");
  });

  it("warns when same-wave tasks touch shared files or sensitive surfaces", () => {
    const result = compilePlan(
      basePlan({
        tasks: [
          {
            task_id: "auth-a",
            surface: "auth",
            files: ["src/auth/session.ts"],
            allowed_commands: ["pnpm test"],
            required_evidence: ["focused_tests"],
            acceptance_criteria: "Run `pnpm test` and pass auth A.",
          },
          {
            task_id: "auth-b",
            surface: "auth",
            files: ["src/auth/session.ts"],
            allowed_commands: ["pnpm test"],
            required_evidence: ["focused_tests"],
            acceptance_criteria: "Run `pnpm test` and pass auth B.",
          },
        ],
      }),
    );
    expect(result.status).toBe("success");
    expect(result.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining(["parallel_shared_files", "parallel_sensitive_surface"]));
  });
});
