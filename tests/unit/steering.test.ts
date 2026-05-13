import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/core/config.js";
import { RUN_SCHEMA_VERSION } from "../../src/core/constants.js";
import { analyzeRepeatedFailures } from "../../src/core/steering.js";
import type { AgentHarnessRunState } from "../../src/core/run-types.js";

describe("repeated failure steering", () => {
  it("suggests controls only after repeated equivalent failures", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-steering-"));
    const config = defaultConfig();
    fs.mkdirSync(path.join(cwd, config.artifact_dir), { recursive: true });

    writeRun(cwd, config.artifact_dir, "one", ["src/outside.ts"]);
    expect(analyzeRepeatedFailures(cwd, config).suggestions).toHaveLength(0);

    writeRun(cwd, config.artifact_dir, "two", ["src/outside.ts"]);
    writeRun(cwd, config.artifact_dir, "three", ["src/outside.ts"]);
    const result = analyzeRepeatedFailures(cwd, config);
    expect(result.suggestions[0]).toMatchObject({ key: "unexpected_file_changed", count: 3 });
  });

  it("suggests compact controls for critical and boundary failures", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-steering-controls-"));
    const config = defaultConfig();
    fs.mkdirSync(path.join(cwd, config.artifact_dir), { recursive: true });

    writeRun(cwd, config.artifact_dir, "one", [], ["architecture boundary violation"]);
    writeRun(cwd, config.artifact_dir, "two", [], ["architecture boundary violation"]);
    writeRun(cwd, config.artifact_dir, "three", [], ["architecture boundary violation"]);
    const architecture = analyzeRepeatedFailures(cwd, config).suggestions;
    expect(architecture.map((item) => item.key)).toContain("architecture_rule");

    writeRun(cwd, config.artifact_dir, "four", [], ["fixture missing"]);
    writeRun(cwd, config.artifact_dir, "five", [], ["fixture missing"]);
    writeRun(cwd, config.artifact_dir, "six", [], ["fixture missing"]);
    const fixture = analyzeRepeatedFailures(cwd, config).suggestions;
    expect(fixture.map((item) => item.key)).toContain("approved_fixture");
  });
});

function writeRun(cwd: string, artifactDir: string, runId: string, unexpectedFiles: string[], errors = ["unexpected file changed"]): void {
  const state: AgentHarnessRunState = {
    schema_version: RUN_SCHEMA_VERSION,
    run_id: runId,
    mode: "weak",
    status: "halt",
    phase: "halt",
    plan: {
      schema_version: "agent_harness_plan_v1",
      plan_id: "steering-plan",
      risk_level: "L2",
      rollback_expectation: "Revert.",
      gates: ["node --version"],
      tasks: [{ task_id: "task-a", acceptance_criteria: "A passes." }],
    },
    tasks: [{ task_id: "task-a", status: "blocked", acceptance_criteria: "A passes.", evidence_ids: [] }],
    declared_files: ["src/a.ts"],
    unexpected_files: unexpectedFiles,
    current_task_id: null,
    pending_gate: null,
    evidence: [],
    claims: [],
    verified_claims: [],
    errors,
    final_report: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(cwd, artifactDir, `${runId}.json`), `${JSON.stringify(state, null, 2)}\n`);
}
