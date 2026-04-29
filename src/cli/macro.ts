import path from "node:path";
import { ACTION_SCHEMA_VERSION } from "../core/constants.js";
import { loadConfig } from "../core/config.js";
import { loadRun, saveRun } from "../core/artifact-store.js";
import { processHarnessAction } from "../core/runner.js";
import { readJson } from "../core/utils.js";
import { buildAutoClaims } from "../core/auto-claims.js";
import type { AgentHarnessAction } from "../core/action-types.js";
import type { AgentHarnessPlan } from "../core/plan-types.js";
import type { AgentHarnessRunState } from "../core/run-types.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeCompactJson } from "./output.js";

export function macroCommand(args: string[], cwd = process.cwd()): void {
  const [resource, maybeVerb] = args;
  const hasVerb = maybeVerb !== undefined && !maybeVerb.startsWith("--");
  const verb = hasVerb ? maybeVerb : undefined;
  const flags = parseFlags(args.slice(hasVerb ? 2 : 1));
  const planPath = stringFlag(flags, "plan") ?? "plan.json";
  const runId = stringFlag(flags, "run-id", true)!;
  const mode = stringFlag(flags, "mode") ?? "constrained";
  const config = loadConfig(cwd, stringFlag(flags, "config") ?? "agent-harness.config.json");
  config.token_budget.observation_format = "compact";
  const artifactDir = stringFlag(flags, "artifact-dir") ?? config.artifact_dir;
  const plan = readJson<AgentHarnessPlan>(path.resolve(cwd, planPath));
  const previousState = loadRun(cwd, artifactDir, runId);
  if (resource === "gate" && (verb === "pass" || verb === "fail") && !previousState?.pending_gate) {
    const check = stringFlag(flags, "check", true)!;
    const gate = processHarnessAction({
      plan,
      previousState,
      action: { schema_version: ACTION_SCHEMA_VERSION, type: "run_gate", command: check },
      runId,
      mode,
      config,
    });
    const evidence = buildMacroAction(resource, verb, flags, gate.state);
    const result = processHarnessAction({ plan, previousState: gate.state, action: evidence, runId, mode, config });
    const artifactPath = saveRun(cwd, artifactDir, result.state);
    writeCompactJson({
      ...result.observation,
      artifacts: [
        { type: "run_state", path: path.relative(cwd, artifactPath) },
      ],
    });
    return;
  }
  const action = buildMacroAction(resource, verb, flags, previousState);
  const result = processHarnessAction({ plan, previousState, action, runId, mode, config });
  const artifactPath = saveRun(cwd, artifactDir, result.state);
  writeCompactJson({
    ...result.observation,
    artifacts: [
      { type: "run_state", path: path.relative(cwd, artifactPath) },
    ],
  });
}

function buildMacroAction(
  resource: string | undefined,
  verb: string | undefined,
  flags: Record<string, string | boolean>,
  state: AgentHarnessRunState | null,
): AgentHarnessAction {
  if (resource === "start") {
    return { schema_version: ACTION_SCHEMA_VERSION, type: "read_context", summary: stringFlag(flags, "summary") ?? "started token-aware harness run" };
  }
  if (resource === "files" && verb === "declare") {
    return { schema_version: ACTION_SCHEMA_VERSION, type: "declare_files", files: splitCsv(stringFlag(flags, "files", true)!) };
  }
  if (resource === "task" && verb === "start") {
    return {
      schema_version: ACTION_SCHEMA_VERSION,
      type: "edit_file_ready",
      task_id: stringFlag(flags, "task-id", true)!,
      files: splitCsv(stringFlag(flags, "files", true)!),
    };
  }
  if (resource === "gate" && (verb === "pass" || verb === "fail")) {
    const check = stringFlag(flags, "check", true)!;
    if (!state?.pending_gate) return { schema_version: ACTION_SCHEMA_VERSION, type: "run_gate", command: check };
    return {
      schema_version: ACTION_SCHEMA_VERSION,
      type: "record_evidence",
      evidence: {
        evidence_id: stringFlag(flags, "evidence-id") ?? `${state.pending_gate.task_id ?? "gate"}-${Date.now()}`,
        evidence_type: stringFlag(flags, "type"),
        evidence_types: stringFlag(flags, "types") ? splitCsv(stringFlag(flags, "types")!) : undefined,
        check,
        result: verb,
        exit_code: Number(stringFlag(flags, "exit-code") ?? (verb === "pass" ? "0" : "1")),
        output_excerpt: stringFlag(flags, "excerpt") ?? (verb === "pass" ? "gate passed" : "gate failed"),
        scope_covered: stringFlag(flags, "scope") ?? check,
        residual_gap: stringFlag(flags, "residual-gap") ?? "none",
      },
    };
  }
  if (resource === "claim" && verb === "auto") {
    if (!state) throw new Error("claim auto requires existing run");
    return { schema_version: ACTION_SCHEMA_VERSION, type: "verify_claims", claims: buildAutoClaims(state) };
  }
  if (resource === "finish") {
    return { schema_version: ACTION_SCHEMA_VERSION, type: "final_report", summary: stringFlag(flags, "summary", true)! };
  }
  throw new Error("unknown macro command");
}

function splitCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
