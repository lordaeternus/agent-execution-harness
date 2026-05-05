import type { AgentHarnessTask } from "./plan-types.js";

export interface TaskGraphDiagnostic {
  code: "duplicate_dependency" | "missing_dependency" | "self_dependency" | "cycle";
  message: string;
  task_id?: string;
}

export interface TaskWave {
  wave: number;
  task_ids: string[];
}

export function dependenciesForTask(task: Pick<AgentHarnessTask, "depends_on">): string[] {
  return [...new Set(task.depends_on ?? [])].sort();
}

export function validateTaskGraph(tasks: Pick<AgentHarnessTask, "task_id" | "depends_on">[]): TaskGraphDiagnostic[] {
  const diagnostics: TaskGraphDiagnostic[] = [];
  const ids = new Set(tasks.map((task) => task.task_id));
  const byId = new Map(tasks.map((task) => [task.task_id, task]));

  for (const task of tasks) {
    const dependencies = task.depends_on ?? [];
    const seen = new Set<string>();
    for (const dependency of dependencies) {
      if (seen.has(dependency)) diagnostics.push({ code: "duplicate_dependency", task_id: task.task_id, message: `Duplicate dependency ${dependency}.` });
      seen.add(dependency);
      if (dependency === task.task_id) diagnostics.push({ code: "self_dependency", task_id: task.task_id, message: "Task cannot depend on itself." });
      if (!ids.has(dependency)) diagnostics.push({ code: "missing_dependency", task_id: task.task_id, message: `Unknown dependency ${dependency}.` });
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  const cycleKeys = new Set<string>();
  const visit = (taskId: string): void => {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) {
      const cycle = [...stack.slice(stack.indexOf(taskId)), taskId];
      const key = cycle.join(">");
      if (!cycleKeys.has(key)) {
        cycleKeys.add(key);
        diagnostics.push({ code: "cycle", task_id: taskId, message: `Dependency cycle detected: ${cycle.join(" -> ")}.` });
      }
      return;
    }
    const task = byId.get(taskId);
    if (!task) return;
    visiting.add(taskId);
    stack.push(taskId);
    for (const dependency of dependenciesForTask(task)) visit(dependency);
    stack.pop();
    visiting.delete(taskId);
    visited.add(taskId);
  };
  for (const task of tasks) visit(task.task_id);

  return diagnostics;
}

export function taskBlockedBy(task: Pick<AgentHarnessTask, "depends_on">, completedTaskIds: Iterable<string>): string[] {
  const completed = new Set(completedTaskIds);
  return dependenciesForTask(task).filter((dependency) => !completed.has(dependency));
}

export function isTaskUnblocked(task: Pick<AgentHarnessTask, "depends_on">, completedTaskIds: Iterable<string>): boolean {
  return taskBlockedBy(task, completedTaskIds).length === 0;
}

export function calculateTaskWaves(tasks: Pick<AgentHarnessTask, "task_id" | "depends_on">[]): TaskWave[] {
  const diagnostics = validateTaskGraph(tasks);
  if (diagnostics.some((diagnostic) => ["missing_dependency", "self_dependency", "cycle"].includes(diagnostic.code))) {
    throw new Error(diagnostics.map((diagnostic) => `${diagnostic.task_id ? `${diagnostic.task_id}: ` : ""}${diagnostic.code}: ${diagnostic.message}`).join("; "));
  }
  const pending = new Map(tasks.map((task) => [task.task_id, task]));
  const completed = new Set<string>();
  const waves: TaskWave[] = [];
  while (pending.size) {
    const taskIds = [...pending.values()]
      .filter((task) => isTaskUnblocked(task, completed))
      .map((task) => task.task_id)
      .sort();
    if (!taskIds.length) throw new Error("No unblocked tasks found; dependency graph is not executable.");
    for (const taskId of taskIds) {
      pending.delete(taskId);
      completed.add(taskId);
    }
    waves.push({ wave: waves.length + 1, task_ids: taskIds });
  }
  return waves;
}
