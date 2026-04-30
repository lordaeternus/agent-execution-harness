import { parseFlags } from "./args.js";
import { writeCompactJson } from "./output.js";
import { resolveCliRunContext } from "./context.js";

export function nextCommand(args: string[], cwd = process.cwd()): void {
  const context = resolveCliRunContext(parseFlags(args), cwd);
  if (!context.state) throw new Error("no run artifact found");
  const state = context.state;
  const nextTask = state.tasks.find((task) => task.status === "in_progress") ?? state.tasks.find((task) => task.status === "not_started");
  const completed = state.tasks.filter((task) => task.status === "completed").length;
  const missing = nextTask ? state.evidence_policy?.tasks.find((task) => task.task_id === nextTask.task_id)?.missing ?? nextTask.required_evidence ?? [] : [];
  writeCompactJson({
    status: state.status === "halt" ? "halt" : state.status === "partial_validated" ? "warning" : "success",
    summary: `${state.phase} ${completed}/${state.tasks.length}`,
    artifacts: [{ type: "run_state", run_id: state.run_id }],
    next_actions: nextActions(state.phase),
    errors: state.errors,
    data: nextTask
      ? {
          task_id: nextTask.task_id,
          files: nextTask.files ?? [],
          required_evidence: nextTask.required_evidence ?? [],
          missing_evidence: missing,
        }
      : { missing_evidence: state.evidence_policy?.missing ?? [] },
  });
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
