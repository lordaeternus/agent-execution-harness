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
  tasks: [{ task_id: "bench-task", acceptance_criteria: "node version gate passes.", required_evidence: ["focused_tests"] }],
};
fs.writeFileSync(path.join(tmp, "plan.json"), JSON.stringify(plan));
const cli = path.join(root, "dist", "cli", "index.js");

function run(args) {
  const output = execFileSync(process.execPath, [cli, ...args], { cwd: tmp, encoding: "utf8" });
  return { output, totalChars: args.join(" ").length + output.length };
}

const oldAction = JSON.stringify({ schema_version: "agent_harness_action_v1", type: "read_context", summary: "Read plan and repo context." });
const oldRun = run(["run", "--plan", "plan.json", "--run-id", "old", "--mode", "standard", "--action", oldAction]);
const compactRun = run(["start", "--plan", "plan.json", "--run-id", "new", "--mode", "constrained", "--summary", "ctx"]);
const reduction = Math.round(((oldRun.totalChars - compactRun.totalChars) / oldRun.totalChars) * 100);

console.log(`token-benchmark old_chars=${oldRun.totalChars} compact_chars=${compactRun.totalChars} reduction_pct=${reduction}`);
if (reduction < 30) {
  console.error("token benchmark requires at least 30% output reduction");
  process.exitCode = 1;
}
