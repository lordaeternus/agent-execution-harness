import path from "node:path";
import { buildDispatchPlan } from "../core/dispatch.js";
import type { DispatchRuntimeCapability } from "../core/dispatch-types.js";
import type { AgentHarnessPlan } from "../core/plan-types.js";
import type { AgentHarnessRunState } from "../core/run-types.js";
import { readJson } from "../core/utils.js";
import { parseFlags, stringFlag } from "./args.js";
import { resolveCliRunContext } from "./context.js";
import { writeCompactJson } from "./output.js";

export function dispatchCommand(args: string[], cwd = process.cwd()): void {
  const [verb, ...rest] = args;
  if (verb === "plan") return planCommand(rest, cwd);
  if (verb === "next") return nextCommand(rest, cwd);
  if (verb === "--help" || verb === "help") return help();
  throw new Error("dispatch command must be: dispatch plan --plan <path> OR dispatch next --batch");
}

function planCommand(args: string[], cwd: string): void {
  const flags = parseFlags(args);
  const planPath = stringFlag(flags, "plan", true)!;
  const plan = readJson<AgentHarnessPlan>(path.resolve(cwd, planPath));
  const runtime = runtimeCapability(flags);
  const dispatch = buildDispatchPlan(plan, { runtime_capability: runtime, max_parallel: numberFlag(flags, "max-parallel") });
  writeCompactJson({
    status: "success",
    summary: `dispatch plan batches=${dispatch.batches.length} runtime=${dispatch.runtime_capability}`,
    artifacts: [],
    next_actions: nextActionsForBatch(dispatch.batches[0]?.mode, planPath),
    errors: [],
    data: dispatch,
  });
}

function nextCommand(args: string[], cwd: string): void {
  const flags = parseFlags(args);
  if (flags.batch !== true) throw new Error("dispatch next requires --batch");
  const context = resolveCliRunContext(flags, cwd);
  const activeBlock = activeDispatchBlock(context.state);
  if (activeBlock) {
    writeCompactJson({
      status: "warning",
      summary: activeBlock,
      artifacts: [{ type: "run_state", run_id: context.runId }],
      next_actions: ["next --exact"],
      errors: [],
      data: { batch: null, blocked_tasks: [], phase: context.state?.phase, current_task_id: context.state?.current_task_id, pending_gate: context.state?.pending_gate },
    });
    return;
  }
  const completed = context.state?.tasks.filter((task) => task.status === "completed").map((task) => task.task_id) ?? [];
  const runtime = runtimeCapability(flags);
  const dispatch = buildDispatchPlan(context.plan, {
    runtime_capability: runtime,
    max_parallel: numberFlag(flags, "max-parallel"),
    completed_task_ids: completed,
  });
  const batch = dispatch.batches[0];
  writeCompactJson({
    status: batch ? "success" : "warning",
    summary: batch ? `dispatch ${batch.mode} tasks=${batch.tasks.length}` : "no dispatchable tasks",
    artifacts: [{ type: "run_state", run_id: context.runId }],
    next_actions: nextActionsForBatch(batch?.mode, context.planPath),
    errors: [],
    data: { batch, blocked_tasks: dispatch.blocked_tasks },
  });
}

function runtimeCapability(flags: Record<string, string | boolean>): DispatchRuntimeCapability {
  const value = stringFlag(flags, "runtime") ?? "serial_only";
  if (value === "serial_only" || value === "subagents") return value;
  throw new Error("--runtime must be serial_only or subagents");
}

function numberFlag(flags: Record<string, string | boolean>, key: string): number | undefined {
  const value = stringFlag(flags, key);
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`--${key} must be a positive number`);
  return parsed;
}

function nextActionsForBatch(mode: "serial" | "parallel" | undefined, planPath: string): string[] {
  if (mode === "parallel") {
    return ["spawn_subagents", "collect worker JSON", `handoff validate --plan ${quoteArg(planPath)} --task-id <task-id> --input <worker-output.json>`];
  }
  return ["run serial task", "next --exact"];
}

function activeDispatchBlock(state: AgentHarnessRunState | null): string | undefined {
  if (!state) return undefined;
  if (state.current_task_id) return `dispatch blocked: task already in progress (${state.current_task_id})`;
  if (state.pending_gate) return `dispatch blocked: gate already pending (${state.pending_gate.command})`;
  if (!["init", "preflight", "task_start"].includes(state.phase)) return `dispatch blocked: run phase is ${state.phase}`;
  return undefined;
}

function quoteArg(value: string): string {
  return /\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function help(): void {
  process.stdout.write("agent-harness dispatch plan --plan plan.json --runtime serial_only|subagents\nagent-harness dispatch next --batch --runtime serial_only|subagents\n");
}
