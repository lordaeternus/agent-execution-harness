import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ACTION_SCHEMA_VERSION } from "../core/constants.js";
import { evaluateCommandPolicy } from "../core/command-policy.js";
import { processHarnessAction } from "../core/runner.js";
import { saveRun } from "../core/artifact-store.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeCompactJson } from "./output.js";
import { resolveCliRunContext } from "./context.js";

export function verifyCommand(args: string[], cwd = process.cwd()): void {
  const flags = parseFlags(args);
  const context = resolveCliRunContext(flags, cwd);
  if (!context.state) throw new Error("verify requires an initialized run");
  const taskId = stringFlag(flags, "task-id") ?? context.state.current_task_id;
  if (!taskId) throw new Error("--task-id is required when no task is active");
  const evidenceType = stringFlag(flags, "type");
  const evidenceTypes = stringFlag(flags, "types") ? splitCsv(stringFlag(flags, "types")!) : undefined;
  if (!evidenceType && !evidenceTypes?.length) throw new Error("--type or --types is required");
  const command = stringFlag(flags, "cmd", true)!;
  const policy = evaluateCommandPolicy(command, context.config.command_policy);
  if (!policy.allowed) throw new Error(`command blocked: ${policy.reason}`);

  let state = context.state;
  if (state.phase === "gate") {
    state = processHarnessAction({
      plan: context.plan,
      previousState: state,
      runId: context.runId,
      mode: context.mode,
      config: context.config,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "run_gate", command },
    }).state;
  }
  if (state.phase !== "evidence" || state.pending_gate?.command !== command) throw new Error("verify requires a pending matching gate");

  const result = spawnSync(command, { cwd, shell: true, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const exitCode = typeof result.status === "number" ? result.status : 1;
  const evidenceId = stringFlag(flags, "evidence-id") ?? `${taskId}-${Date.now()}`;
  const outputRef = writeEvidenceLog(cwd, context.artifactDir, context.runId, evidenceId, output);
  const sha256 = crypto.createHash("sha256").update(output).digest("hex");
  state = processHarnessAction({
    plan: context.plan,
    previousState: state,
    runId: context.runId,
    mode: context.mode,
    config: context.config,
    action: {
      schema_version: ACTION_SCHEMA_VERSION,
      type: "record_evidence",
      evidence: {
        evidence_id: evidenceId,
        evidence_type: evidenceType,
        evidence_types: evidenceTypes,
        check: command,
        result: exitCode === 0 ? "pass" : "fail",
        exit_code: exitCode,
        output_excerpt: excerpt(output, context.config.token_budget.output_excerpt_max_chars),
        output_ref: outputRef,
        sha256,
        scope_covered: stringFlag(flags, "scope") ?? command,
        residual_gap: stringFlag(flags, "residual-gap") ?? "none",
      },
    },
  }).state;
  const artifactPath = saveRun(cwd, context.artifactDir, state);
  writeCompactJson({
    status: exitCode === 0 ? "success" : "warning",
    summary: `${state.phase} evidence=${evidenceId} exit=${exitCode}`,
    artifacts: [
      { type: "run_state", path: path.relative(cwd, artifactPath) },
      { type: "evidence_log", path: outputRef },
    ],
    next_actions: state.phase === "report" ? ["claim auto", "finish"] : ["next"],
    errors: state.errors,
    data: { evidence_id: evidenceId, output_ref: outputRef, sha256 },
  });
}

function writeEvidenceLog(cwd: string, artifactDir: string, runId: string, evidenceId: string, output: string): string {
  const relativePath = path.join(artifactDir, "logs", runId, `${evidenceId}.log`).replace(/\\/g, "/");
  const file = path.resolve(cwd, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, output);
  return relativePath;
}

function excerpt(output: string, maxChars: number): string {
  const normalized = output.trim().replace(/\s+/g, " ");
  if (!normalized) return "no output";
  if (normalized.length <= maxChars) return normalized;
  const head = normalized.slice(0, Math.max(0, Math.floor(maxChars / 2) - 20));
  const tail = normalized.slice(Math.max(0, normalized.length - Math.floor(maxChars / 2)));
  return `${head} ... ${tail}`;
}

function splitCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
