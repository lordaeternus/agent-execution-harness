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
  tasks: [{
    task_id: "bench-task",
    files: ["created.txt"],
    forbidden_files: ["outside.txt"],
    expected_diff: "Create or update only the benchmark target file.",
    acceptance_criteria: "node version gate passes.",
    required_evidence: ["focused_tests"],
    required_checks: ["node --version"],
    rollback_command: "git diff -- created.txt",
  }],
};
fs.writeFileSync(path.join(tmp, "plan.json"), JSON.stringify(plan));
fs.writeFileSync(path.join(tmp, "created.txt"), "ok");
fs.mkdirSync(path.join(tmp, "src/auth"), { recursive: true });
fs.writeFileSync(path.join(tmp, "src/auth/session.ts"), "export const session = true;\n");
fs.mkdirSync(path.join(tmp, ".agent-harness/runs"), { recursive: true });
fs.writeFileSync(path.join(tmp, ".agent-harness/runs/bench.full.json"), "{}\n");
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
run([
  "learn",
  "capture",
  "--lesson-id",
  "bench-lesson",
  "--surface",
  "generic",
  "--kind",
  "verification_rule",
  "--summary",
  "Benchmark lesson proves query output stays compact while preserving evidence-backed operational context.",
  "--files",
  "created.txt",
  "--evidence-ref",
  ".agent-harness/runs/bench.full.json",
  "--failure-signature",
  "benchmark verification gate failed",
]);
const validateOutput = run(["learn", "validate", "--lesson-id", "bench-lesson"]);
run(["learn", "promote", "--lesson-id", "bench-lesson"]);
const learnQuery = run(["learn", "query", "--surface", "generic", "--top-k", "3"]);
const learnQueryCompact = run(["learn", "query", "--surface", "generic", "--top-k", "3", "--compact"]);
run([
  "map",
  "record",
  "--surface",
  "auth",
  "--files",
  "src/auth/session.ts,created.txt",
  "--summary",
  "Auth benchmark memory preserves compact executor context while source files remain the final authority.",
  "--confidence",
  "high",
]);
const mapQuery = run(["map", "query", "--surface", "auth"]);
const mapQueryCompact = run(["map", "query", "--surface", "auth", "--compact", "--max-files", "1"]);
run(["session", "start", "--plan", "plan.json", "--run-id", "std-next", "--mode", "standard"]);
const standardNext = run(["next", "--plan", "plan.json", "--run-id", "std-next", "--mode", "standard"]);
run(["session", "start", "--plan", "plan.json", "--run-id", "weak-next", "--mode", "weak"]);
const weakNext = run(["next", "--plan", "plan.json", "--run-id", "weak-next", "--mode", "weak"]);
const weakNextExact = run(["next", "--plan", "plan.json", "--run-id", "weak-next", "--mode", "weak", "--exact"]);
const nextMicro = run(["next", "--plan", "plan.json", "--run-id", "weak-next", "--mode", "weak", "--exact", "--micro"]);
const handoff = run(["handoff", "--plan", "plan.json", "--task-id", "bench-task"]);
const handoffCompact = run(["handoff", "--plan", "plan.json", "--task-id", "bench-task", "--compact"]);
run(["session", "start", "--plan", "plan.json", "--run-id", "repeat-bench", "--mode", "weak"]);
run(["files", "declare", "--files", "created.txt"]);
run(["task", "start", "--task-id", "bench-task", "--files", "created.txt"]);
const failingVerifyCommand = `${JSON.stringify(process.execPath)} -e "process.exit(1)"`;
run(["verify", "--task-id", "bench-task", "--type", "focused_tests", "--cmd", failingVerifyCommand]);
const repeatedRunFile = path.join(tmp, ".agent-harness/runs/repeat-bench.full.json");
const repeatedState = JSON.parse(fs.readFileSync(repeatedRunFile, "utf8"));
repeatedState.status = "in_progress";
repeatedState.phase = "gate";
repeatedState.current_task_id = "bench-task";
repeatedState.pending_gate = null;
repeatedState.tasks[0].status = "in_progress";
fs.writeFileSync(repeatedRunFile, `${JSON.stringify(repeatedState, null, 2)}\n`);
fs.writeFileSync(path.join(tmp, ".agent-harness/runs/repeat-bench.json"), `${JSON.stringify(repeatedState, null, 2)}\n`);
const repeatedFailure = run(["verify", "--task-id", "bench-task", "--type", "focused_tests", "--cmd", failingVerifyCommand]);
const repeatedFailureHint = JSON.parse(repeatedFailure.output).data.learning_hint ?? "";
const compactRun = total([
  run(["session", "start", "--plan", "plan.json", "--run-id", "new", "--mode", "constrained"]),
  run(["files", "declare", "--files", "created.txt"]),
  run(["task", "start", "--task-id", "bench-task", "--files", "created.txt"]),
  run(["verify", "--task-id", "bench-task", "--type", "focused_tests", "--cmd", verifyCommand]),
  run(["claim", "auto"]),
  run(["finish", "--summary", "validated"]),
]);
run([
  "learn",
  "capture",
  "--lesson-id",
  "bench-low-confidence",
  "--surface",
  "generic",
  "--kind",
  "verification_rule",
  "--summary",
  "Benchmark low confidence lesson triggers compact learning audit guidance without deleting stored memory.",
  "--files",
  "created.txt",
  "--evidence-ref",
  ".agent-harness/runs/bench.full.json",
  "--confidence",
  "low",
]);
const learnHealthCompact = run(["learn", "health", "--compact"]);
const learnAuditCompact = run(["learn", "audit", "--compact"]);
const reduction = Math.round(((oldRun - compactRun) / oldRun) * 100);

const weakReduction = Math.round(((standardNext.totalChars - weakNext.totalChars) / standardNext.totalChars) * 100);
const learnCompactReduction = Math.round(((learnQuery.totalChars - learnQueryCompact.totalChars) / learnQuery.totalChars) * 100);
const mapCompactReduction = Math.round(((mapQuery.totalChars - mapQueryCompact.totalChars) / mapQuery.totalChars) * 100);
const nextMicroReduction = Math.round(((weakNextExact.totalChars - nextMicro.totalChars) / weakNextExact.totalChars) * 100);
const handoffCompactReduction = Math.round(((handoff.totalChars - handoffCompact.totalChars) / handoff.totalChars) * 100);
const smokeBenchmark = execFileSync(process.execPath, [cli, "benchmark", "--mode", "smoke"], { cwd: root, encoding: "utf8" });
console.log(`token-benchmark old_chars=${oldRun} compact_chars=${compactRun} reduction_pct=${reduction} validate_output_chars=${validateOutput.totalChars} repeated_failure_hint_chars=${repeatedFailureHint.length} learn_query_chars=${learnQuery.totalChars} learn_query_compact_chars=${learnQueryCompact.totalChars} learn_health_compact_chars=${learnHealthCompact.totalChars} learn_audit_compact_chars=${learnAuditCompact.totalChars} learn_query_compact_reduction_pct=${learnCompactReduction} map_query_chars=${mapQuery.totalChars} map_query_compact_chars=${mapQueryCompact.totalChars} map_query_compact_reduction_pct=${mapCompactReduction} standard_next_chars=${standardNext.totalChars} weak_next_chars=${weakNext.totalChars} weak_reduction_pct=${weakReduction} weak_next_exact_chars=${weakNextExact.totalChars} next_micro_chars=${nextMicro.totalChars} next_micro_reduction_pct=${nextMicroReduction} handoff_chars=${handoff.totalChars} handoff_compact_chars=${handoffCompact.totalChars} handoff_compact_reduction_pct=${handoffCompactReduction} smoke_benchmark_chars=${smokeBenchmark.length}`);
if (weakReduction < 10) {
  console.error("weak next benchmark requires at least 10% output reduction");
  process.exitCode = 1;
}
if (reduction < 55) {
  console.error("token benchmark requires at least 55% output reduction");
  process.exitCode = 1;
}
if (learnCompactReduction < 25 || mapCompactReduction < 15 || nextMicroReduction < 10 || handoffCompactReduction < 20) {
  console.error("compact output benchmarks require positive reductions across learn/map/next/handoff");
  process.exitCode = 1;
}
