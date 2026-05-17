import { parseFlags } from "./args.js";
import { writeCompactJson } from "./output.js";
import { resolveCliRunContext } from "./context.js";
import { effectiveExecutionProfile } from "../core/execution-profile.js";
import { buildExactNextCommand, nextUnblockedTask } from "../core/next-command.js";
import { taskBlockedBy } from "../core/task-graph.js";
import type { AgentHarnessRunState } from "../core/run-types.js";

export function nextCommand(args: string[], cwd = process.cwd()): void {
  const flags = parseFlags(args);
  const context = resolveCliRunContext(flags, cwd);
  if (!context.state) throw new Error("no run artifact found");
  const state = context.state;
  const completedIds = state.tasks.filter((task) => task.status === "completed").map((task) => task.task_id);
  const nextTask = state.tasks.find((task) => task.status === "in_progress") ?? nextUnblockedTask(state);
  const blockedTasks = state.tasks
    .filter((task) => task.status === "not_started" && taskBlockedBy(task, completedIds).length)
    .map((task) => ({ task_id: task.task_id, blocked_by: taskBlockedBy(task, completedIds) }));
  const completed = state.tasks.filter((task) => task.status === "completed").length;
  const missing = nextTask ? state.evidence_policy?.tasks.find((task) => task.task_id === nextTask.task_id)?.missing ?? nextTask.required_evidence ?? [] : [];
  const profile = effectiveExecutionProfile(context.mode, context.config);
  const actions = nextActionsForState(state);
  const exact = flags.exact === true ? { exact: buildExactNextCommand(state) } : {};
  if (flags.micro === true) {
    const exactCommand = buildExactNextCommand(state);
    process.stdout.write(`${JSON.stringify({
      status: state.status === "halt" ? "halt" : state.status === "partial_validated" ? "warning" : "success",
      state: state.phase,
      task_id: nextTask?.task_id ?? null,
      command: exactCommand.command,
      stop_if: exactCommand.stop_if,
      ...(blockedTasks.length ? { blocked_tasks: blockedTasks } : {}),
    })}\n`);
    return;
  }
  const weakData = nextTask
    ? {
        task_id: nextTask.task_id,
        files: nextTask.files ?? [],
        action: actions[0] ?? "none",
        ...(blockedTasks.length ? { blocked_tasks: blockedTasks } : {}),
        ...exact,
        ...(state.phase === "evidence" || state.phase === "report" ? { missing_evidence: missing } : {}),
      }
    : { missing_evidence: state.evidence_policy?.missing ?? [], action: actions[0] ?? "none", ...(blockedTasks.length ? { blocked_tasks: blockedTasks } : {}), ...exact };
  writeCompactJson({
    status: state.status === "halt" ? "halt" : state.status === "partial_validated" ? "warning" : "success",
    summary: `${state.phase} ${completed}/${state.tasks.length}`,
    artifacts: [{ type: "run_state", run_id: state.run_id }],
    next_actions: actions,
    errors: state.errors,
    data:
      profile.observationFormat === "ultra_compact"
        ? weakData
        : nextTask
          ? {
              task_id: nextTask.task_id,
              files: nextTask.files ?? [],
              required_evidence: nextTask.required_evidence ?? [],
              missing_evidence: missing,
              ...(blockedTasks.length ? { blocked_tasks: blockedTasks } : {}),
              ...exact,
            }
          : { missing_evidence: state.evidence_policy?.missing ?? [], ...(blockedTasks.length ? { blocked_tasks: blockedTasks } : {}), ...exact },
  });
}

function nextActionsForState(state: Pick<AgentHarnessRunState, "phase" | "tasks" | "declared_files">): string[] {
  const task = nextUnblockedTask(state);
  if ((state.phase === "task_start" || state.phase === "report") && task?.files?.some((file) => !state.declared_files.includes(file))) return ["files declare"];
  if (state.phase === "report" && task) return ["task start"];
  return nextActions(state.phase);
}

function nextActions(phase: string): string[] {
  const map: Record<string, string[]> = {
    preflight: ["files declare"],
    task_start: ["task start"],
    gate: ["verify"],
    evidence: ["verify"],
    report: ["claim auto", "finish"],
    completed: [],
    halt: [],
  };
  return map[phase] ?? [];
}
