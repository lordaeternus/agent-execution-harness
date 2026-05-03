import type { AgentHarnessPlan } from "./plan-types.js";
import type { AgentHarnessRunState, RunTask } from "./run-types.js";

export interface ExactNextCommand {
  do_now: "run_exact_command" | "halt" | "none";
  command: string;
  stop_if: string;
}

export function buildExactNextCommand(state: AgentHarnessRunState): ExactNextCommand {
  const task = state.tasks.find((item) => item.status === "in_progress") ?? state.tasks.find((item) => item.status === "not_started");
  if (state.phase === "halt") return exact("halt", "", "run is halted; inspect errors");
  if (state.phase === "completed") return exact("none", "", "run already completed");
  if (state.phase === "preflight") return exact("run_exact_command", `agent-harness files declare --files ${quote(allPlanFiles(state.plan))}`, "exit_code_not_zero");
  if (state.phase === "task_start" && task) {
    return exact("run_exact_command", `agent-harness task start --task-id ${task.task_id} --files ${quote(taskFiles(task))}`, "exit_code_not_zero");
  }
  if ((state.phase === "gate" || state.phase === "evidence") && task) {
    const command = state.pending_gate?.command ?? allowedCommandForTask(state.plan, task);
    const evidenceFlag = evidenceFlagForTask(task);
    const scope = task.required_evidence?.includes("file_scope") ? ` --scope ${quote(`file_scope ${taskFiles(task)}`)}` : "";
    return exact("run_exact_command", `agent-harness verify --task-id ${task.task_id} ${evidenceFlag}${scope} --cmd ${quote(command)}`, "exit_code_not_zero");
  }
  if (state.phase === "report") {
    return state.verified_claims.length
      ? exact("run_exact_command", "agent-harness finish --summary \"validated\"", "exit_code_not_zero")
      : exact("run_exact_command", "agent-harness claim auto", "exit_code_not_zero");
  }
  return exact("none", "", "no actionable command");
}

function exact(doNow: ExactNextCommand["do_now"], command: string, stopIf: string): ExactNextCommand {
  return { do_now: doNow, command, stop_if: stopIf };
}

function allPlanFiles(plan: AgentHarnessPlan): string {
  return [...new Set(plan.tasks.flatMap((task) => task.files ?? []))].join(",");
}

function taskFiles(task: RunTask): string {
  return (task.files ?? []).join(",");
}

function allowedCommandForTask(plan: AgentHarnessPlan, task: RunTask): string {
  const planTask = plan.tasks.find((item) => item.task_id === task.task_id);
  return planTask?.allowed_commands?.[0] ?? plan.gates[0] ?? "echo missing allowed command";
}

function evidenceFlagForTask(task: RunTask): string {
  const evidence = task.required_evidence ?? [];
  if (evidence.length > 1) return `--types ${quote(evidence.join(","))}`;
  return `--type ${quote(evidence[0] ?? "focused_tests")}`;
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}
