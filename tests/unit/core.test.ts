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

  it("calculates deterministic benchmark metrics", () => {
    expect(calculateBenchmark([{ model_executor: "x", status: "pass", attempt: 1, retries: 0, gate_passed: true, halted: false, cost_usd: 1 }])["pass@1"]).toBe(1);
  });
});
