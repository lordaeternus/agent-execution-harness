import { describe, expect, it } from "vitest";
import { calculateTaskWaves, isTaskUnblocked, taskBlockedBy, validateTaskGraph } from "../../src/core/task-graph.js";
import type { AgentHarnessTask } from "../../src/core/plan-types.js";

function task(task_id: string, depends_on: string[] = []): AgentHarnessTask {
  return {
    task_id,
    depends_on,
    files: [`${task_id}.txt`],
    acceptance_criteria: "Run `node --version` and pass.",
  };
}

describe("task graph", () => {
  it("calculates deterministic waves", () => {
    expect(calculateTaskWaves([task("T3", ["T1", "T2"]), task("T2"), task("T1"), task("T4", ["T3"])])).toEqual([
      { wave: 1, task_ids: ["T1", "T2"] },
      { wave: 2, task_ids: ["T3"] },
      { wave: 3, task_ids: ["T4"] },
    ]);
  });

  it("detects missing dependencies, self dependencies and duplicates", () => {
    const diagnostics = validateTaskGraph([task("T1", ["T1", "T2", "T2"])]);
    expect(diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining(["self_dependency", "missing_dependency", "duplicate_dependency"]));
  });

  it("detects cycles", () => {
    const diagnostics = validateTaskGraph([task("T1", ["T2"]), task("T2", ["T1"])]);
    expect(diagnostics.map((item) => item.code)).toContain("cycle");
    expect(() => calculateTaskWaves([task("T1", ["T2"]), task("T2", ["T1"])])).toThrow("cycle");
  });

  it("reports blocked and unblocked tasks from completed ids", () => {
    const dependent = task("T3", ["T1", "T2"]);
    expect(taskBlockedBy(dependent, ["T1"])).toEqual(["T2"]);
    expect(isTaskUnblocked(dependent, ["T1"])).toBe(false);
    expect(isTaskUnblocked(dependent, ["T1", "T2"])).toBe(true);
  });
});
