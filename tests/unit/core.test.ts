import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION_SCHEMA_VERSION } from "../../src/core/constants.js";
import { defaultConfig } from "../../src/core/config.js";
import { classifyDangerousCommand } from "../../src/core/dangerous-command.js";
import { evaluateCommandPolicy } from "../../src/core/command-policy.js";
import { calculateBenchmark } from "../../src/core/benchmark.js";
import { processHarnessAction } from "../../src/core/runner.js";
import { buildReport } from "../../src/core/report.js";
import type { AgentHarnessPlan } from "../../src/core/plan-types.js";
import { buildExactNextCommand } from "../../src/core/next-command.js";

function plan(): AgentHarnessPlan {
  return {
    schema_version: "agent_harness_plan_v1",
    plan_id: "unit-plan",
    risk_level: "L2",
    rollback_expectation: "Delete temp files.",
    gates: ["node --version"],
    tasks: [{ task_id: "unit-task", acceptance_criteria: "Evidence passes." }],
  };
}

function uiPlan(): AgentHarnessPlan {
  return {
    schema_version: "agent_harness_plan_v1",
    plan_id: "ui-plan",
    risk_level: "L2",
    rollback_expectation: "Revert UI files.",
    gates: ["pnpm agent:verify:ui"],
    tasks: [
      {
        task_id: "ui-task",
        surface: "ui_layout",
        files: ["src/components/AppLayout.tsx"],
        acceptance_criteria: "Sidebar layout has no visual overlap.",
      },
    ],
  };
}

function twoTaskPlan(): AgentHarnessPlan {
  return {
    schema_version: "agent_harness_plan_v1",
    plan_id: "two-task-plan",
    risk_level: "L2",
    rollback_expectation: "Delete temp files.",
    gates: ["node --version"],
    tasks: [
      { task_id: "task-1", files: ["one.txt"], acceptance_criteria: "Task one passes." },
      { task_id: "task-2", depends_on: ["task-1"], files: ["two.txt"], acceptance_criteria: "Task two passes." },
    ],
  };
}

describe("core harness", () => {
  it("blocks dangerous commands", () => {
    expect(classifyDangerousCommand("git reset --hard HEAD")).toContain("git reset");
    expect(evaluateCommandPolicy("node --version", defaultConfig().command_policy)).toEqual({ allowed: true });
  });

  it("runs full transactional flow and builds report", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-"));
    fs.writeFileSync(path.join(tmp, "created.txt"), "ok");
    const oldCwd = process.cwd();
    process.chdir(tmp);
    try {
      const config = defaultConfig();
      let state = processHarnessAction({
        plan: plan(),
        previousState: null,
        runId: "unit-run",
        mode: "constrained",
        config,
        action: { schema_version: ACTION_SCHEMA_VERSION, type: "read_context", summary: "ctx" },
      }).state;
      state = processHarnessAction({
        plan: plan(),
        previousState: state,
        runId: "unit-run",
        mode: "constrained",
        config,
        action: { schema_version: ACTION_SCHEMA_VERSION, type: "declare_files", files: ["created.txt"] },
      }).state;
      state = processHarnessAction({
        plan: plan(),
        previousState: state,
        runId: "unit-run",
        mode: "constrained",
        config,
        action: { schema_version: ACTION_SCHEMA_VERSION, type: "edit_file_ready", task_id: "unit-task", files: ["created.txt"] },
      }).state;
      state = processHarnessAction({
        plan: plan(),
        previousState: state,
        runId: "unit-run",
        mode: "constrained",
        config,
        action: { schema_version: ACTION_SCHEMA_VERSION, type: "run_gate", command: "node --version" },
      }).state;
      state = processHarnessAction({
        plan: plan(),
        previousState: state,
        runId: "unit-run",
        mode: "constrained",
        config,
        action: {
          schema_version: ACTION_SCHEMA_VERSION,
          type: "record_evidence",
          evidence: {
            evidence_id: "ev-green",
            check: "node --version",
            result: "pass",
            exit_code: 0,
            output_excerpt: "v20",
            scope_covered: "test contract",
          },
        },
      }).state;
      state = processHarnessAction({
        plan: plan(),
        previousState: state,
        runId: "unit-run",
        mode: "constrained",
        config,
        action: {
          schema_version: ACTION_SCHEMA_VERSION,
          type: "verify_claims",
          claims: [
            { claim_id: "c-file", kind: "file_exists", value: "created.txt", evidence_id: "ev-green" },
            { claim_id: "c-gate", kind: "gate_passed", value: "node --version", evidence_id: "ev-green" },
            { claim_id: "c-accept", kind: "acceptance_criteria_met", value: "unit-task", evidence_id: "ev-green" },
            { claim_id: "c-rollback", kind: "rollback_defined", value: "rollback", evidence_id: "ev-green" },
          ],
        },
      }).state;
      state = processHarnessAction({
        plan: plan(),
        previousState: state,
        runId: "unit-run",
        mode: "constrained",
        config,
        action: { schema_version: ACTION_SCHEMA_VERSION, type: "final_report", summary: "done" },
      }).state;
      expect(state.status).toBe("completed");
      expect(buildReport(state)).toContain("Agent Harness Final Report");
    } finally {
      process.chdir(oldCwd);
    }
  });

  it("keeps the run in task_start when claims are verified before all tasks are complete", () => {
    const config = defaultConfig();
    let state = processHarnessAction({
      plan: twoTaskPlan(),
      previousState: null,
      runId: "two-task-run",
      mode: "constrained",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "read_context", summary: "ctx" },
    }).state;
    state = processHarnessAction({
      plan: twoTaskPlan(),
      previousState: state,
      runId: "two-task-run",
      mode: "constrained",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "declare_files", files: ["one.txt", "two.txt"] },
    }).state;
    state = processHarnessAction({
      plan: twoTaskPlan(),
      previousState: state,
      runId: "two-task-run",
      mode: "constrained",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "edit_file_ready", task_id: "task-1", files: ["one.txt"] },
    }).state;
    state = processHarnessAction({
      plan: twoTaskPlan(),
      previousState: state,
      runId: "two-task-run",
      mode: "constrained",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "run_gate", command: "node --version" },
    }).state;
    state = processHarnessAction({
      plan: twoTaskPlan(),
      previousState: state,
      runId: "two-task-run",
      mode: "constrained",
      config,
      action: {
        schema_version: ACTION_SCHEMA_VERSION,
        type: "record_evidence",
        evidence: {
          evidence_id: "task-1-ev",
          check: "node --version",
          result: "pass",
          exit_code: 0,
          output_excerpt: "v20",
          scope_covered: "task one",
        },
      },
    }).state;
    state = processHarnessAction({
      plan: twoTaskPlan(),
      previousState: state,
      runId: "two-task-run",
      mode: "constrained",
      config,
      action: {
        schema_version: ACTION_SCHEMA_VERSION,
        type: "verify_claims",
        claims: [{ claim_id: "task-1-claim", kind: "gate_passed", value: "node --version", evidence_id: "task-1-ev" }],
      },
    }).state;

    expect(state.phase).toBe("task_start");
    expect(state.status).toBe("in_progress");
    expect(state.tasks.find((task) => task.task_id === "task-2")?.status).toBe("not_started");
    expect(buildExactNextCommand(state).command).toContain("agent-harness task start --task-id task-2");
  });

  it("guides file declaration before a pending task if claims moved the run forward with missing declared files", () => {
    const config = defaultConfig();
    let state = processHarnessAction({
      plan: twoTaskPlan(),
      previousState: null,
      runId: "missing-declared-run",
      mode: "constrained",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "read_context", summary: "ctx" },
    }).state;
    state = processHarnessAction({
      plan: twoTaskPlan(),
      previousState: state,
      runId: "missing-declared-run",
      mode: "constrained",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "declare_files", files: ["one.txt"] },
    }).state;
    state.tasks[0].status = "completed";
    state.tasks[0].evidence_ids = ["task-1-ev"];
    state.phase = "task_start";
    state = processHarnessAction({
      plan: twoTaskPlan(),
      previousState: state,
      runId: "missing-declared-run",
      mode: "constrained",
      config,
      action: {
        schema_version: ACTION_SCHEMA_VERSION,
        type: "verify_claims",
        claims: [{ claim_id: "task-1-claim", kind: "task_reconciled", value: "task-1", evidence_id: "task-1-ev" }],
      },
    }).state;

    expect(buildExactNextCommand(state).command).toBe('agent-harness files declare --files "one.txt,two.txt"');
  });

  it("marks UI work partial_validated when required visual evidence is missing", () => {
    const config = defaultConfig();
    let state = processHarnessAction({
      plan: uiPlan(),
      previousState: null,
      runId: "ui-run",
      mode: "standard",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "read_context", summary: "ctx" },
    }).state;
    state = processHarnessAction({
      plan: uiPlan(),
      previousState: state,
      runId: "ui-run",
      mode: "standard",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "declare_files", files: ["src/components/AppLayout.tsx"] },
    }).state;
    state = processHarnessAction({
      plan: uiPlan(),
      previousState: state,
      runId: "ui-run",
      mode: "standard",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "edit_file_ready", task_id: "ui-task", files: ["src/components/AppLayout.tsx"] },
    }).state;
    state = processHarnessAction({
      plan: uiPlan(),
      previousState: state,
      runId: "ui-run",
      mode: "standard",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "run_gate", command: "pnpm agent:verify:ui" },
    }).state;
    state = processHarnessAction({
      plan: uiPlan(),
      previousState: state,
      runId: "ui-run",
      mode: "standard",
      config,
      action: {
        schema_version: ACTION_SCHEMA_VERSION,
        type: "record_evidence",
        evidence: {
          evidence_id: "ui-ev-partial",
          evidence_types: ["focused_tests", "scoped_lint", "scoped_typecheck"],
          check: "pnpm agent:verify:ui",
          result: "pass",
          exit_code: 0,
          output_excerpt: "Focused tests, lint and scoped typecheck passed. Browser smoke not run.",
          scope_covered: "focused tests, scoped lint, scoped typecheck",
          residual_gap: "browser smoke not run",
        },
      },
    }).state;
    state = processHarnessAction({
      plan: uiPlan(),
      previousState: state,
      runId: "ui-run",
      mode: "standard",
      config,
      action: {
        schema_version: ACTION_SCHEMA_VERSION,
        type: "verify_claims",
        claims: [
          { claim_id: "c-ui-gate", kind: "gate_passed", value: "pnpm agent:verify:ui", evidence_id: "ui-ev-partial" },
          { claim_id: "c-ui-rollback", kind: "rollback_defined", value: "rollback", evidence_id: "ui-ev-partial" },
        ],
      },
    }).state;
    state = processHarnessAction({
      plan: uiPlan(),
      previousState: state,
      runId: "ui-run",
      mode: "standard",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "final_report", summary: "implemented but visual smoke missing" },
    }).state;
    expect(state.status).toBe("partial_validated");
    expect(state.evidence_policy?.missing).toEqual(["browser_smoke|visual_assertion"]);
    expect(buildReport(state)).toContain("partial_validated");
  });

  it("completes UI work when all required evidence types are present", () => {
    const config = defaultConfig();
    let state = processHarnessAction({
      plan: uiPlan(),
      previousState: null,
      runId: "ui-run-complete",
      mode: "standard",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "read_context", summary: "ctx" },
    }).state;
    state = processHarnessAction({
      plan: uiPlan(),
      previousState: state,
      runId: "ui-run-complete",
      mode: "standard",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "declare_files", files: ["src/components/AppLayout.tsx"] },
    }).state;
    state = processHarnessAction({
      plan: uiPlan(),
      previousState: state,
      runId: "ui-run-complete",
      mode: "standard",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "edit_file_ready", task_id: "ui-task", files: ["src/components/AppLayout.tsx"] },
    }).state;
    state = processHarnessAction({
      plan: uiPlan(),
      previousState: state,
      runId: "ui-run-complete",
      mode: "standard",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "run_gate", command: "pnpm agent:verify:ui" },
    }).state;
    state = processHarnessAction({
      plan: uiPlan(),
      previousState: state,
      runId: "ui-run-complete",
      mode: "standard",
      config,
      action: {
        schema_version: ACTION_SCHEMA_VERSION,
        type: "record_evidence",
        evidence: {
          evidence_id: "ui-ev-complete",
          evidence_types: ["focused_tests", "scoped_lint", "scoped_typecheck", "visual_assertion"],
          check: "pnpm agent:verify:ui",
          result: "pass",
          exit_code: 0,
          output_excerpt: "All UI gates passed.",
          scope_covered: "focused tests, scoped lint, scoped typecheck, visual assertion",
        },
      },
    }).state;
    state = processHarnessAction({
      plan: uiPlan(),
      previousState: state,
      runId: "ui-run-complete",
      mode: "standard",
      config,
      action: {
        schema_version: ACTION_SCHEMA_VERSION,
        type: "verify_claims",
        claims: [
          { claim_id: "c-ui-gate", kind: "gate_passed", value: "pnpm agent:verify:ui", evidence_id: "ui-ev-complete" },
          { claim_id: "c-ui-accept", kind: "acceptance_criteria_met", value: "ui-task", evidence_id: "ui-ev-complete" },
          { claim_id: "c-ui-rollback", kind: "rollback_defined", value: "rollback", evidence_id: "ui-ev-complete" },
        ],
      },
    }).state;
    state = processHarnessAction({
      plan: uiPlan(),
      previousState: state,
      runId: "ui-run-complete",
      mode: "standard",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "final_report", summary: "validated" },
    }).state;
    expect(state.status).toBe("completed");
    expect(state.evidence_policy?.score).toBe(100);
  });

  it("calculates deterministic benchmark metrics", () => {
    expect(calculateBenchmark([{ model_executor: "x", status: "pass", attempt: 1, retries: 0, gate_passed: true, halted: false, cost_usd: 1 }])["pass@1"]).toBe(1);
  });
});
