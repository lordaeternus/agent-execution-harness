import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-token-bench-"));
const plan = {
  schema_version: "agent_harness_plan_v1",
  plan_id: "token-bench",
  risk_level: "L2",
  rollback_expectation: "Remove generated files.",
  gates: ["node --version"],
  tasks: [{ task_id: "bench-task", files: ["created.txt"], acceptance_criteria: "node version gate passes.", required_evidence: ["focused_tests"] }],
};
fs.writeFileSync(path.join(tmp, "plan.json"), JSON.stringify(plan));
fs.writeFileSync(path.join(tmp, "created.txt"), "ok");
const cli = path.join(root, "dist", "cli", "index.js");

function run(args) {
  const output = execFileSync(process.execPath, [cli, ...args], { cwd: tmp, encoding: "utf8" });
  return { output, totalChars: args.join(" ").length + output.length };
}

function total(runs) {
  return runs.reduce((sum, item) => sum + item.totalChars, 0);
}

const repeated = ["--plan", "plan.json", "--run-id", "old", "--mode", "constrained"];
const longLog = "x".repeat(520);
function action(input) {
  return JSON.stringify({ schema_version: "agent_harness_action_v1", ...input });
}
const oldRun = total([
  run(["run", ...repeated, "--action", action({ type: "read_context", summary: "Read plan and repo context." })]),
  run(["run", ...repeated, "--action", action({ type: "declare_files", files: ["created.txt"] })]),
  run(["run", ...repeated, "--action", action({ type: "edit_file_ready", task_id: "bench-task", files: ["created.txt"] })]),
  run(["run", ...repeated, "--action", action({ type: "run_gate", command: "node --version" })]),
  run([
    "run",
    ...repeated,
    "--action",
    action({
      type: "record_evidence",
      evidence: {
        evidence_id: "old-ev",
        evidence_type: "focused_tests",
        check: "node --version",
        result: "pass",
        exit_code: 0,
        output_excerpt: longLog,
        scope_covered: "focused test output",
      },
    }),
  ]),
  run([
    "run",
    ...repeated,
    "--action",
    action({
      type: "verify_claims",
      claims: [
        { claim_id: "old-gate", kind: "gate_passed", value: "node --version", evidence_id: "old-ev" },
        { claim_id: "old-accept", kind: "acceptance_criteria_met", value: "bench-task", evidence_id: "old-ev" },
        { claim_id: "old-rollback", kind: "rollback_defined", value: "Remove generated files.", evidence_id: "old-ev" },
      ],
    }),
  ]),
  run(["run", ...repeated, "--action", action({ type: "final_report", summary: "Validated token benchmark run." })]),
]);

const verifyCommand = `${JSON.stringify(process.execPath)} --version`;
const compactRun = total([
  run(["session", "start", "--plan", "plan.json", "--run-id", "new", "--mode", "constrained"]),
  run(["files", "declare", "--files", "created.txt"]),
  run(["task", "start", "--task-id", "bench-task", "--files", "created.txt"]),
  run(["verify", "--task-id", "bench-task", "--type", "focused_tests", "--cmd", verifyCommand]),
  run(["claim", "auto"]),
  run(["finish", "--summary", "validated"]),
]);
const reduction = Math.round(((oldRun - compactRun) / oldRun) * 100);

console.log(`token-benchmark old_chars=${oldRun} compact_chars=${compactRun} reduction_pct=${reduction}`);
if (reduction < 55) {
  console.error("token benchmark requires at least 55% output reduction");
  process.exitCode = 1;
}
