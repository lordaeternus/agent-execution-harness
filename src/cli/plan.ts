import path from "node:path";
import { compilePlan } from "../core/plan-compiler.js";
import { calculateTaskWaves, taskBlockedBy } from "../core/task-graph.js";
import type { AgentHarnessPlan } from "../core/plan-types.js";
import { validatePlan } from "../core/schema-validation.js";
import { readJson } from "../core/utils.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeJson } from "./output.js";

export function planCommand(args: string[], cwd = process.cwd()): void {
  const [subcommand, ...rest] = args;
  if (subcommand !== "waves") throw new Error("plan command must be: plan waves --plan <path>");
  const flags = parseFlags(rest);
  const planPath = stringFlag(flags, "plan", true)!;
  const plan = readJson<AgentHarnessPlan>(path.resolve(cwd, planPath));
  validatePlan(plan);
  const compiled = compilePlan(plan);
  const errors = compiled.diagnostics.filter((item) => item.severity === "error");
  if (errors.length) {
    writeJson({
      status: "error",
      summary: "plan graph invalid",
      artifacts: [],
      next_actions: ["fix_plan"],
      errors: errors.map((item) => `${item.task_id ? `${item.task_id}: ` : ""}${item.code}: ${item.message}`),
      data: { warnings: compiled.diagnostics.filter((item) => item.severity === "warning") },
    });
    process.exitCode = 1;
    return;
  }
  const waves = calculateTaskWaves(plan.tasks);
  writeJson({
    status: "success",
    summary: `${waves.length} execution wave${waves.length === 1 ? "" : "s"}`,
    artifacts: [],
    next_actions: ["session start", "next --exact"],
    errors: [],
    data: {
      waves,
      blocked_tasks: plan.tasks
        .map((task) => ({ task_id: task.task_id, blocked_by: taskBlockedBy(task, []) }))
        .filter((task) => task.blocked_by.length),
      warnings: compiled.diagnostics.filter((item) => item.severity === "warning"),
    },
  });
}
