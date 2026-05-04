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
import { classifyRepair } from "../core/repair-playbooks.js";
import { effectiveExecutionProfile } from "../core/execution-profile.js";
import { applyScopeGuardToState, collectGitTouchedFilesResult } from "../core/scope-guard.js";
import { executeGateCommand } from "../core/command-execution.js";

export function verifyCommand(args: string[], cwd = process.cwd()): void {
  const flags = parseFlags(args);
  const context = resolveCliRunContext(flags, cwd);
  if (!context.state) throw new Error("verify requires an initialized run");
  const taskId = stringFlag(flags, "task-id") ?? context.state.current_task_id;
  if (!taskId) throw new Error("--task-id is required when no task is active");
  const evidenceType = stringFlag(flags, "type");
  const evidenceTypes = stringFlag(flags, "types") ? splitCsv(stringFlag(flags, "types")!) : undefined;
  if (!evidenceType && !evidenceTypes?.length) throw new Error("--type or --types is required");
  const command = buildCheck(flags, context.mode, context.config.command_policy.strict_disallow_shell !== false);
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

  const result = executeGateCommand({
    cwd,
    command: stringFlag(flags, "cmd"),
    exec: stringFlag(flags, "exec"),
    args: parseArgsJson(stringFlag(flags, "args-json")),
    allowShell: !(context.mode === "strict" && context.config.command_policy.strict_disallow_shell !== false),
  });
  const output = result.output;
  const exitCode = result.exitCode;
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
  if (context.config.scope_guard?.enabled !== false) {
    const touched = collectGitTouchedFilesResult(cwd);
    if (!touched.ok && context.mode === "strict") throw new Error(`scope_guard_unavailable: ${touched.reason}`);
    state = applyScopeGuardToState(state, touched.files, context.config.scope_guard?.generated_allowlist ?? []);
  }
  const artifactPath = saveRun(cwd, context.artifactDir, state);
  const profile = effectiveExecutionProfile(context.mode, context.config);
  const repair = exitCode === 0 ? undefined : classifyRepair(command, output, profile.repairHintMaxChars);
  writeCompactJson({
    status: exitCode === 0 ? "success" : "warning",
    summary: `${state.phase} evidence=${evidenceId} exit=${exitCode}`,
    artifacts: [
      { type: "run_state", path: path.relative(cwd, artifactPath) },
      { type: "evidence_log", path: outputRef },
    ],
    next_actions: state.phase === "report" ? ["claim auto", "finish"] : ["next"],
    errors: state.errors,
    data: { evidence_id: evidenceId, output_ref: outputRef, sha256, ...(repair ? { repair_hint: repair } : {}) },
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

function buildCheck(flags: Record<string, string | boolean>, mode: string, strictDisallowShell: boolean): string {
  const command = stringFlag(flags, "cmd");
  const exec = stringFlag(flags, "exec");
  if (mode === "strict" && strictDisallowShell && command) throw new Error("strict mode blocks --cmd; use --exec and --args-json");
  if (exec) return [exec, ...parseArgsJson(stringFlag(flags, "args-json"))].join(" ");
  if (command) return command;
  throw new Error("--cmd or --exec is required");
}

function parseArgsJson(value: string | undefined): string[] {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) throw new Error("--args-json must be a JSON string array");
  return parsed;
}
