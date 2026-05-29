import { describe, expect, it } from "vitest";
import { ACTION_SCHEMA_VERSION } from "../../src/core/constants.js";
import { defaultConfig } from "../../src/core/config.js";
import { buildAutoClaims } from "../../src/core/auto-claims.js";
import { assessFinishReadiness } from "../../src/core/finish-check.js";
import { processHarnessAction } from "../../src/core/runner.js";
import type { AgentHarnessPlan } from "../../src/core/plan-types.js";
import type { AgentHarnessRunState } from "../../src/core/run-types.js";

const plan: AgentHarnessPlan = {
  schema_version: "agent_harness_plan_v1",
  plan_id: "finish-check-plan",
  risk_level: "L2",
  rollback_expectation: "Revert the touched files.",
  gates: ["node --version"],
  tasks: [
    {
      task_id: "task-a",
      files: ["created.txt"],
      required_evidence: ["focused_tests"],
      acceptance_criteria: "Run `node --version` and record focused evidence.",
    },
  ],
};

describe("finish readiness check", () => {
  it("passes for a completed, evidenced and claimed run", () => {
    const state = readyState();
    const result = assessFinishReadiness({ state, touchedFiles: { ok: true, files: ["created.txt"] } });

    expect(result.ready).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.next_actions).toEqual(['finish --summary "validated"']);
  });

  it("fails when required auto claims are missing", () => {
    const state = readyState();
    state.verified_claims = state.verified_claims.filter((claim) => claim.kind !== "task_reconciled");
    const result = assessFinishReadiness({ state, touchedFiles: { ok: true, files: ["created.txt"] } });

    expect(result.ready).toBe(false);
    expect(result.errors).toContain("missing_auto_claims: 1");
    expect(result.data.missing_auto_claims).toBe(1);
    expect(result.next_actions).toEqual(["claim auto"]);
  });

  it("fails for pending tasks without mutating the run", () => {
    const state = startState();
    const before = JSON.stringify(state);
    const result = assessFinishReadiness({ state });

    expect(result.ready).toBe(false);
    expect(result.errors.join("\n")).toContain("pending_tasks");
    expect(result.next_actions).toEqual(["next --exact"]);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("fails for files outside the declared plan scope", () => {
    const result = assessFinishReadiness({ state: readyState(), touchedFiles: { ok: true, files: ["created.txt", "outside.txt"] } });

    expect(result.ready).toBe(false);
    expect(result.errors.join("\n")).toContain("unexpected_files: outside.txt");
  });
});

function startState(): AgentHarnessRunState {
  return processHarnessAction({
    plan,
    previousState: null,
    runId: "finish-check-run",
    mode: "standard",
    config: defaultConfig(),
    action: { schema_version: ACTION_SCHEMA_VERSION, type: "read_context", summary: "ctx" },
  }).state;
}

function readyState(): AgentHarnessRunState {
  const config = defaultConfig();
  let state = startState();
  state = processHarnessAction({ plan, previousState: state, runId: "finish-check-run", mode: "standard", config, action: { schema_version: ACTION_SCHEMA_VERSION, type: "declare_files", files: ["created.txt"] } }).state;
  state = processHarnessAction({ plan, previousState: state, runId: "finish-check-run", mode: "standard", config, action: { schema_version: ACTION_SCHEMA_VERSION, type: "edit_file_ready", task_id: "task-a", files: ["created.txt"] } }).state;
  state = processHarnessAction({ plan, previousState: state, runId: "finish-check-run", mode: "standard", config, action: { schema_version: ACTION_SCHEMA_VERSION, type: "run_gate", command: "node --version" } }).state;
  state = processHarnessAction({
    plan,
    previousState: state,
    runId: "finish-check-run",
    mode: "standard",
    config,
    action: {
      schema_version: ACTION_SCHEMA_VERSION,
      type: "record_evidence",
      evidence: {
        evidence_id: "ev",
        evidence_type: "focused_tests",
        check: "node --version",
        result: "pass",
        exit_code: 0,
        output_excerpt: "v24",
        scope_covered: "created.txt",
      },
    },
  }).state;
  return processHarnessAction({
    plan,
    previousState: state,
    runId: "finish-check-run",
    mode: "standard",
    config,
    action: { schema_version: ACTION_SCHEMA_VERSION, type: "verify_claims", claims: buildAutoClaims(state) },
  }).state;
}
