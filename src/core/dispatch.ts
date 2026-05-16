import type { AgentHarnessPlan, AgentHarnessTask, TaskSurface } from "./plan-types.js";
import type { DispatchBatch, DispatchBlockedTask, DispatchOptions, DispatchPlan, DispatchRuntimeCapability, DispatchTaskRef } from "./dispatch-types.js";
import { buildHandoffPacket } from "./handoff.js";
import { calculateTaskWaves, taskBlockedBy } from "./task-graph.js";

const SENSITIVE_SURFACES: TaskSurface[] = ["auth", "db", "api", "ai"];

export function buildDispatchPlan(
  plan: AgentHarnessPlan,
  options: DispatchOptions & { completed_task_ids?: string[] } = {},
): DispatchPlan {
  const runtime = options.runtime_capability ?? "serial_only";
  const completed = new Set(options.completed_task_ids ?? []);
  const waves = calculateTaskWaves(plan.tasks);
  const blockedByDependencies = plan.tasks
    .map((task) => ({ task, blocked_by: taskBlockedBy(task, completed) }))
    .filter((item) => item.blocked_by.length > 0)
    .map((item) => blocked(item.task.task_id, `blocked_by:${item.blocked_by.join(",")}`));
  const executable = plan.tasks.filter((task) => taskBlockedBy(task, completed).length === 0 && !completed.has(task.task_id));

  if (runtime === "serial_only") {
    const task = executable[0];
    return {
      plan_id: plan.plan_id,
      runtime_capability: runtime,
      batches: task ? [buildSerialBatch(plan, task, blockedByDependencies)] : [],
      blocked_tasks: blockedByDependencies,
    };
  }

  let batches = waves
    .map((wave) => wave.task_ids.map((taskId) => executable.find((task) => task.task_id === taskId)).filter((task): task is AgentHarnessTask => Boolean(task)))
    .filter((waveTasks) => waveTasks.length > 0)
    .slice(0, 1)
    .map((waveTasks) => buildParallelBatch(plan, waveTasks, runtime, options.max_parallel ?? Number.POSITIVE_INFINITY));
  if (batches[0] && batches[0].tasks.length === 0 && executable[0]) {
    const serialTask = executable[0];
    batches = [buildSerialBatch(plan, serialTask, [...blockedByDependencies, ...batches[0].blocked_tasks.filter((task) => task.task_id !== serialTask.task_id)])];
  }
  return {
    plan_id: plan.plan_id,
    runtime_capability: runtime,
    batches,
    blocked_tasks: uniqueBlockedTasks([...blockedByDependencies, ...(batches[0]?.blocked_tasks ?? [])]),
  };
}

function buildSerialBatch(plan: AgentHarnessPlan, task: AgentHarnessTask, blockedTasks: DispatchBlockedTask[]): DispatchBatch {
  return {
    batch_id: `${plan.plan_id}-serial-1`,
    mode: "serial",
    tasks: [{ task_id: task.task_id, mode: "serial", packet: buildHandoffPacket(plan, task.task_id) }],
    blocked_tasks: blockedTasks,
  };
}

function buildParallelBatch(plan: AgentHarnessPlan, tasks: AgentHarnessTask[], runtime: DispatchRuntimeCapability, maxParallel: number): DispatchBatch {
  const accepted: AgentHarnessTask[] = [];
  const blockedTasks: DispatchBlockedTask[] = [];
  for (const task of tasks) {
    const reason = parallelBlockReason(task, accepted, runtime);
    if (reason) {
      blockedTasks.push(blocked(task.task_id, reason));
      continue;
    }
    if (accepted.length >= maxParallel) {
      blockedTasks.push(blocked(task.task_id, "max_parallel_reached"));
      continue;
    }
    accepted.push(task);
  }
  const refs: DispatchTaskRef[] = accepted.map((task) => ({
    task_id: task.task_id,
    mode: accepted.length > 1 ? "parallel" : "serial",
    packet: buildHandoffPacket(plan, task.task_id),
  }));
  return {
    batch_id: `${plan.plan_id}-batch-1`,
    mode: refs.length > 1 ? "parallel" : "serial",
    tasks: refs,
    blocked_tasks: blockedTasks,
  };
}

function parallelBlockReason(task: AgentHarnessTask, accepted: AgentHarnessTask[], runtime: DispatchRuntimeCapability): string | undefined {
  if (runtime !== "subagents") return "runtime_has_no_subagents";
  if (task.parallel_safe !== true) return "parallel_safe_not_declared";
  if (!task.allowed_commands?.length) return "missing_allowed_commands";
  if (task.surface && SENSITIVE_SURFACES.includes(task.surface)) return `sensitive_surface:${task.surface}`;
  const files = new Set(task.files ?? []);
  for (const other of accepted) {
    for (const file of other.files ?? []) {
      if (files.has(file)) return `shared_file:${file}`;
    }
  }
  const resources = new Set(task.shared_resources ?? []);
  for (const other of accepted) {
    for (const resource of other.shared_resources ?? []) {
      if (resources.has(resource)) return `shared_resource:${resource}`;
    }
  }
  return undefined;
}

function blocked(task_id: string, reason: string): DispatchBlockedTask {
  return { task_id, reason };
}

function uniqueBlockedTasks(tasks: DispatchBlockedTask[]): DispatchBlockedTask[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = `${task.task_id}\0${task.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
