import { describe, expect, it } from "vitest";
import { ACTION_SCHEMA_VERSION } from "../../src/core/constants.js";
import { defaultConfig } from "../../src/core/config.js";
import { processHarnessAction } from "../../src/core/runner.js";
import type { AgentHarnessPlan } from "../../src/core/plan-types.js";

const plan: AgentHarnessPlan = {
  schema_version: "agent_harness_plan_v1",
  plan_id: "coverage-plan",
  risk_level: "L2",
  rollback_expectation: "Revert coverage fixture.",
  gates: ["node --version"],
  tasks: [
    {
      task_id: "coverage-task",
      files: ["src/covered.ts"],
      required_evidence: ["focused_tests", "file_scope"],
      acceptance_criteria: "Run `node --version` and prove file_scope evidence exists.",
    },
  ],
};

describe("evidence policy coverage", () => {
  it("keeps run partial when explicit file_scope evidence is missing", () => {
    const config = defaultConfig();
    let state = processHarnessAction({ plan, previousState: null, runId: "coverage-run", mode: "standard", config, action: { schema_version: ACTION_SCHEMA_VERSION, type: "read_context", summary: "ctx" } }).state;
    state = processHarnessAction({ plan, previousState: state, runId: "coverage-run", mode: "standard", config, action: { schema_version: ACTION_SCHEMA_VERSION, type: "declare_files", files: ["src/covered.ts"] } }).state;
    state = processHarnessAction({ plan, previousState: state, runId: "coverage-run", mode: "standard", config, action: { schema_version: ACTION_SCHEMA_VERSION, type: "edit_file_ready", task_id: "coverage-task", files: ["src/covered.ts"] } }).state;
    state = processHarnessAction({ plan, previousState: state, runId: "coverage-run", mode: "standard", config, action: { schema_version: ACTION_SCHEMA_VERSION, type: "run_gate", command: "node --version" } }).state;
    state = processHarnessAction({ plan, previousState: state, runId: "coverage-run", mode: "standard", config, action: { schema_version: ACTION_SCHEMA_VERSION, type: "record_evidence", evidence: { evidence_id: "ev", evidence_type: "focused_tests", check: "node --version", result: "pass", exit_code: 0, output_excerpt: "v20", scope_covered: "focused test" } } }).state;
    state = processHarnessAction({ plan, previousState: state, runId: "coverage-run", mode: "standard", config, action: { schema_version: ACTION_SCHEMA_VERSION, type: "verify_claims", claims: [ { claim_id: "gate", kind: "gate_passed", value: "node --version", evidence_id: "ev" }, { claim_id: "accept", kind: "acceptance_criteria_met", value: "coverage-task", evidence_id: "ev" }, { claim_id: "rollback", kind: "rollback_defined", value: "rollback", evidence_id: "ev" } ] } }).state;
    state = processHarnessAction({ plan, previousState: state, runId: "coverage-run", mode: "standard", config, action: { schema_version: ACTION_SCHEMA_VERSION, type: "final_report", summary: "done" } }).state;
    expect(state.status).toBe("partial_validated");
    expect(state.evidence_policy?.missing).toContain("file_scope");
  });
});
