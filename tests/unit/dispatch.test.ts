import { describe, expect, it } from "vitest";
import { buildDispatchPlan } from "../../src/core/dispatch.js";
import type { AgentHarnessPlan, AgentHarnessTask } from "../../src/core/plan-types.js";

function task(overrides: Partial<AgentHarnessTask> & { task_id: string }): AgentHarnessTask {
  return {
    acceptance_criteria: "Run `node --version` and confirm the task passes.",
    files: [`${overrides.task_id}.txt`],
    allowed_commands: ["node --version"],
    parallel_safe: true,
    ...overrides,
  };
}

function plan(tasks: AgentHarnessTask[]): AgentHarnessPlan {
  return {
    schema_version: "agent_harness_plan_v1",
    plan_id: "dispatch-plan",
    risk_level: "L2",
    rollback_expectation: "Revert dispatch test files.",
    gates: ["node --version"],
    tasks,
  };
}

describe("dispatch planning", () => {
  function expectNoRunnableBlocked(dispatch: ReturnType<typeof buildDispatchPlan>): void {
    for (const batch of dispatch.batches) {
      const runnable = new Set(batch.tasks.map((item) => item.task_id));
      for (const blocked of batch.blocked_tasks) {
        expect(runnable.has(blocked.task_id)).toBe(false);
      }
      for (const blocked of dispatch.blocked_tasks) {
        expect(runnable.has(blocked.task_id)).toBe(false);
      }
    }
  }

  it("falls back to one serial task when runtime has no subagents", () => {
    const dispatch = buildDispatchPlan(plan([task({ task_id: "task-a" }), task({ task_id: "task-b" })]));
    expect(dispatch.runtime_capability).toBe("serial_only");
    expect(dispatch.batches[0]).toMatchObject({ mode: "serial" });
    expect(dispatch.batches[0].tasks.map((item) => item.task_id)).toEqual(["task-a"]);
  });

  it("creates a parallel batch for independent parallel-safe tasks", () => {
    const dispatch = buildDispatchPlan(plan([task({ task_id: "task-a" }), task({ task_id: "task-b" })]), { runtime_capability: "subagents" });
    expect(dispatch.batches[0].mode).toBe("parallel");
    expect(dispatch.batches[0].tasks.map((item) => item.task_id)).toEqual(["task-a", "task-b"]);
    expect(dispatch.batches[0].tasks[0].packet?.allowed_files).toEqual(["task-a.txt"]);
  });

  it("derives parallel dispatch from runtime capabilities", () => {
    const dispatch = buildDispatchPlan(plan([task({ task_id: "task-a" }), task({ task_id: "task-b" })]), {
      runtime_capabilities: {
        instruction_files: ["AGENTS.md"],
        supports_subagents: true,
        supports_worktrees: false,
        supports_json_output: true,
        shell_permission_model: "ask",
        preferred_output_format: "compact",
        max_parallel: 2,
      },
    });
    expect(dispatch.runtime_capability).toBe("subagents");
    expect(dispatch.batches[0].mode).toBe("parallel");
    expect(dispatch.batches[0].tasks.map((item) => item.task_id)).toEqual(["task-a", "task-b"]);
  });

  it("honors runtime capability max_parallel", () => {
    const dispatch = buildDispatchPlan(plan([task({ task_id: "task-a" }), task({ task_id: "task-b" })]), {
      runtime_capabilities: {
        instruction_files: ["AGENTS.md"],
        supports_subagents: true,
        supports_worktrees: false,
        supports_json_output: true,
        shell_permission_model: "ask",
        preferred_output_format: "compact",
        max_parallel: 1,
      },
    });
    expect(dispatch.batches[0].mode).toBe("serial");
    expect(dispatch.batches[0].tasks.map((item) => item.task_id)).toEqual(["task-a"]);
    expect(dispatch.batches[0].blocked_tasks).toContainEqual({ task_id: "task-b", reason: "max_parallel_reached" });
  });

  it("blocks dependency tasks until prerequisites are completed", () => {
    const dispatch = buildDispatchPlan(plan([task({ task_id: "setup" }), task({ task_id: "followup", depends_on: ["setup"] })]), {
      runtime_capability: "subagents",
    });
    expect(dispatch.batches[0].tasks.map((item) => item.task_id)).toEqual(["setup"]);
    expect(dispatch.blocked_tasks).toEqual([{ task_id: "followup", reason: "blocked_by:setup" }]);
  });

  it("blocks shared files from the same parallel batch", () => {
    const dispatch = buildDispatchPlan(
      plan([task({ task_id: "task-a", files: ["shared.txt"] }), task({ task_id: "task-b", files: ["shared.txt"] })]),
      { runtime_capability: "subagents" },
    );
    expect(dispatch.batches[0].tasks.map((item) => item.task_id)).toEqual(["task-a"]);
    expect(dispatch.batches[0].blocked_tasks).toContainEqual({ task_id: "task-b", reason: "shared_file:shared.txt" });
  });

  it("runs sensitive surfaces serially even when subagents are available", () => {
    const dispatch = buildDispatchPlan(plan([task({ task_id: "auth-task", surface: "auth" })]), { runtime_capability: "subagents" });
    expect(dispatch.batches[0].mode).toBe("serial");
    expect(dispatch.batches[0].tasks.map((item) => item.task_id)).toEqual(["auth-task"]);
    expectNoRunnableBlocked(dispatch);
  });

  it("blocks tasks without explicit parallel safety from parallel execution", () => {
    const dispatch = buildDispatchPlan(plan([task({ task_id: "task-a", parallel_safe: false })]), { runtime_capability: "subagents" });
    expect(dispatch.batches[0].mode).toBe("serial");
    expect(dispatch.batches[0].tasks.map((item) => item.task_id)).toEqual(["task-a"]);
    expectNoRunnableBlocked(dispatch);
  });

  it("does not list a serial fallback task as blocked when other tasks remain blocked from parallel execution", () => {
    const dispatch = buildDispatchPlan(
      plan([task({ task_id: "task-a", parallel_safe: false }), task({ task_id: "task-b", parallel_safe: false })]),
      { runtime_capability: "subagents" },
    );
    expect(dispatch.batches[0].mode).toBe("serial");
    expect(dispatch.batches[0].tasks.map((item) => item.task_id)).toEqual(["task-a"]);
    expect(dispatch.batches[0].blocked_tasks).toContainEqual({ task_id: "task-b", reason: "parallel_safe_not_declared" });
    expectNoRunnableBlocked(dispatch);
  });
});
