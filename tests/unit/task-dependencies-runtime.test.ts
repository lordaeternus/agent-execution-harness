import { describe, expect, it } from "vitest";
import { ACTION_SCHEMA_VERSION } from "../../src/core/constants.js";
import { defaultConfig } from "../../src/core/config.js";
import { processHarnessAction } from "../../src/core/runner.js";
import type { AgentHarnessPlan } from "../../src/core/plan-types.js";
import type { AgentHarnessRunState } from "../../src/core/run-types.js";

function dependencyPlan(): AgentHarnessPlan {
  return {
    schema_version: "agent_harness_plan_v1",
    plan_id: "dependency-runtime",
    risk_level: "L2",
    rollback_expectation: "Delete generated files.",
    gates: ["node --version"],
    tasks: [
      {
        task_id: "foundation",
        files: ["foundation.txt"],
        allowed_commands: ["node --version"],
        required_evidence: ["focused_tests"],
        acceptance_criteria: "Run `node --version` and pass foundation.",
      },
      {
        task_id: "dependent",
        depends_on: ["foundation"],
        files: ["dependent.txt"],
        allowed_commands: ["node --version"],
        required_evidence: ["focused_tests"],
        acceptance_criteria: "Run `node --version` and pass dependent.",
      },
    ],
  };
}

function startState(): AgentHarnessRunState {
  const config = defaultConfig();
  let state = processHarnessAction({
    plan: dependencyPlan(),
    previousState: null,
    runId: "dependency-runtime",
    mode: "constrained",
    config,
    action: { schema_version: ACTION_SCHEMA_VERSION, type: "read_context", summary: "ctx" },
  }).state;
  state = processHarnessAction({
    plan: dependencyPlan(),
    previousState: state,
    runId: "dependency-runtime",
    mode: "constrained",
    config,
    action: { schema_version: ACTION_SCHEMA_VERSION, type: "declare_files", files: ["foundation.txt", "dependent.txt"] },
  }).state;
  return state;
}

describe("runtime task dependencies", () => {
  it("blocks a task until dependencies complete", () => {
    expect(() =>
      processHarnessAction({
        plan: dependencyPlan(),
        previousState: startState(),
        runId: "dependency-runtime",
        mode: "constrained",
        config: defaultConfig(),
        action: { schema_version: ACTION_SCHEMA_VERSION, type: "edit_file_ready", task_id: "dependent", files: ["dependent.txt"] },
      }),
    ).toThrow("blocked by incomplete dependencies: foundation");
  });

  it("unblocks dependent tasks after passing evidence", () => {
    const config = defaultConfig();
    let state = startState();
    state = processHarnessAction({
      plan: dependencyPlan(),
      previousState: state,
      runId: "dependency-runtime",
      mode: "constrained",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "edit_file_ready", task_id: "foundation", files: ["foundation.txt"] },
    }).state;
    state = processHarnessAction({
      plan: dependencyPlan(),
      previousState: state,
      runId: "dependency-runtime",
      mode: "constrained",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "run_gate", command: "node --version" },
    }).state;
    state = processHarnessAction({
      plan: dependencyPlan(),
      previousState: state,
      runId: "dependency-runtime",
      mode: "constrained",
      config,
      action: {
        schema_version: ACTION_SCHEMA_VERSION,
        type: "record_evidence",
        evidence: {
          evidence_id: "foundation-pass",
          evidence_type: "focused_tests",
          check: "node --version",
          result: "pass",
          exit_code: 0,
          output_excerpt: "v22",
          scope_covered: "foundation",
        },
      },
    }).state;
    state = processHarnessAction({
      plan: dependencyPlan(),
      previousState: state,
      runId: "dependency-runtime",
      mode: "constrained",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "edit_file_ready", task_id: "dependent", files: ["dependent.txt"] },
    }).state;
    expect(state.current_task_id).toBe("dependent");
  });

  it("does not unblock dependent tasks after failed evidence", () => {
    const config = defaultConfig();
    let state = startState();
    state = processHarnessAction({
      plan: dependencyPlan(),
      previousState: state,
      runId: "dependency-runtime",
      mode: "constrained",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "edit_file_ready", task_id: "foundation", files: ["foundation.txt"] },
    }).state;
    state = processHarnessAction({
      plan: dependencyPlan(),
      previousState: state,
      runId: "dependency-runtime",
      mode: "constrained",
      config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "run_gate", command: "node --version" },
    }).state;
    state = processHarnessAction({
      plan: dependencyPlan(),
      previousState: state,
      runId: "dependency-runtime",
      mode: "constrained",
      config,
      action: {
        schema_version: ACTION_SCHEMA_VERSION,
        type: "record_evidence",
        evidence: {
          evidence_id: "foundation-fail",
          evidence_type: "focused_tests",
          check: "node --version",
          result: "fail",
          exit_code: 1,
          output_excerpt: "failed",
          scope_covered: "foundation",
        },
      },
    }).state;
    expect(() =>
      processHarnessAction({
        plan: dependencyPlan(),
        previousState: state,
        runId: "dependency-runtime",
        mode: "constrained",
        config,
        action: { schema_version: ACTION_SCHEMA_VERSION, type: "edit_file_ready", task_id: "dependent", files: ["dependent.txt"] },
      }),
    ).toThrow("blocked by incomplete dependencies: foundation");
  });
});
