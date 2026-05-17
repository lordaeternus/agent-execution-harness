import { describe, expect, it } from "vitest";
import { importFeatureListPlan, importMarkdownPlan } from "../../src/core/plan-importer.js";

const baseOptions = {
  plan_id: "demo",
  risk_level: "L2" as const,
  rollback_expectation: "Delete generated files.",
};

describe("plan importer", () => {
  it("imports atomic markdown backlog into a harness plan", () => {
    const plan = importMarkdownPlan(
      [
        "- [ ] **Tarefa [1]**: Ajustar runtime em `docs/agent-runtime.md`.",
        "  - **Dependência:** Nenhum",
        "  - **DoD:** `pnpm test:run tests/unit/runtime.test.ts` passa.",
        "- [ ] **Tarefa [2]**: Ajustar template em `templates/generic/docs/agent-runtime.md`.",
        "  - **Dependência:** Tarefa 1",
        "  - **DoD:** `pnpm test:run tests/unit/public-readiness.test.ts` passa.",
      ].join("\n"),
      baseOptions,
    );

    expect(plan).toMatchObject({
      schema_version: "agent_harness_plan_v1",
      plan_id: "demo",
      risk_level: "L2",
      execution_profile: "weak",
      gates: ["pnpm test:run tests/unit/runtime.test.ts", "pnpm test:run tests/unit/public-readiness.test.ts"],
    });
    expect(plan.tasks[0]).toMatchObject({
      task_id: "task-1",
      depends_on: [],
      files: ["docs/agent-runtime.md"],
      required_checks: ["pnpm test:run tests/unit/runtime.test.ts"],
      allowed_commands: ["pnpm test:run tests/unit/runtime.test.ts"],
    });
    expect(plan.tasks[1]).toMatchObject({
      task_id: "task-2",
      depends_on: ["task-1"],
      files: ["templates/generic/docs/agent-runtime.md"],
    });
  });

  it("uses fallback gate when DoD is verifiable but not command-like", () => {
    const plan = importMarkdownPlan(
      [
        "- [ ] **Tarefa [1]**: Revisar texto em `README.md`.",
        "  - **Dependência:** Nenhum",
        "  - **DoD:** README explica o fluxo sem placeholder.",
      ].join("\n"),
      { ...baseOptions, gate: "pnpm test:run tests/unit/public-readiness.test.ts" },
    );

    expect(plan.gates).toEqual(["pnpm test:run tests/unit/public-readiness.test.ts"]);
    expect(plan.tasks[0].required_checks).toBeUndefined();
    expect(plan.tasks[0].allowed_commands).toBeUndefined();
  });

  it("fails when a task does not declare files", () => {
    expect(() =>
      importMarkdownPlan(
        [
          "- [ ] **Tarefa [1]**: Ajustar runtime.",
          "  - **Dependência:** Nenhum",
          "  - **DoD:** `pnpm test:run tests/unit/runtime.test.ts` passa.",
        ].join("\n"),
        baseOptions,
      ),
    ).toThrow("task-1 must declare at least one file");
  });

  it("fails when a task does not include DoD", () => {
    expect(() =>
      importMarkdownPlan(
        [
          "- [ ] **Tarefa [1]**: Ajustar runtime em `docs/agent-runtime.md`.",
          "  - **Dependência:** Nenhum",
        ].join("\n"),
        baseOptions,
      ),
    ).toThrow("task-1 must include a DoD line");
  });

  it("fails when a dependency is not Nenhum or Tarefa N", () => {
    expect(() =>
      importMarkdownPlan(
        [
          "- [ ] **Tarefa [1]**: Ajustar runtime em `docs/agent-runtime.md`.",
          "  - **Dependência:** tarefa anterior aprovada",
          "  - **DoD:** `pnpm test:run tests/unit/runtime.test.ts` passa.",
        ].join("\n"),
        baseOptions,
      ),
    ).toThrow('Unrecognized dependency "tarefa anterior aprovada"');
  });

  it("imports a simple markdown feature list into a harness plan", () => {
    const plan = importFeatureListPlan(
      [
        "- Add safe finish check in `src/cli/macro.ts`",
        "  - **DoD:** `pnpm test:run tests/unit/finish-check.test.ts` passa.",
        "- Add docs example in `README.md`",
        "  - **Dependência:** Feature 1",
        "  - **DoD:** README shows finish --check before finish.",
      ].join("\n"),
      { ...baseOptions, gate: "pnpm test:run tests/unit/public-readiness.test.ts" },
    );

    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks[0]).toMatchObject({
      task_id: "feature-1",
      files: ["src/cli/macro.ts"],
      required_checks: ["pnpm test:run tests/unit/finish-check.test.ts"],
    });
    expect(plan.tasks[1]).toMatchObject({
      task_id: "feature-2",
      depends_on: ["feature-1"],
      files: ["README.md"],
    });
    expect(plan.gates).toEqual(["pnpm test:run tests/unit/finish-check.test.ts", "pnpm test:run tests/unit/public-readiness.test.ts"]);
  });

  it("requires feature-list files to stay explicit", () => {
    expect(() =>
      importFeatureListPlan("- Add safe finish check", { ...baseOptions, gate: "pnpm test:run tests/unit/public-readiness.test.ts" }),
    ).toThrow("feature-1 must declare at least one file");
  });
});
