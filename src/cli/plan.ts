import path from "node:path";
import fs from "node:fs";
import { compilePlan } from "../core/plan-compiler.js";
import { calculateTaskWaves, taskBlockedBy } from "../core/task-graph.js";
import type { AgentHarnessPlan } from "../core/plan-types.js";
import { validatePlan } from "../core/schema-validation.js";
import { readJson } from "../core/utils.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeJson } from "./output.js";
import { importMarkdownPlan } from "../core/plan-importer.js";

export function planCommand(args: string[], cwd = process.cwd()): void {
  const [subcommand, ...rest] = args;
  if (subcommand === "import") return importPlanCommand(rest, cwd);
  if (subcommand !== "waves") throw new Error("plan command must be: plan waves --plan <path> OR plan import --from <md> --out <json> --plan-id <id> --risk <L1|L2|L3> --rollback <text>");
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

function importPlanCommand(args: string[], cwd: string): void {
  const flags = parseFlags(args);
  const from = stringFlag(flags, "from", true)!;
  const out = stringFlag(flags, "out", true)!;
  const planId = stringFlag(flags, "plan-id", true)!;
  const risk = stringFlag(flags, "risk", true)!;
  const rollback = stringFlag(flags, "rollback", true)!;
  if (!["L1", "L2", "L3"].includes(risk)) throw new Error("--risk must be one of L1, L2, L3");
  const markdown = fs.readFileSync(path.resolve(cwd, from), "utf8");
  const plan = importMarkdownPlan(markdown, {
    plan_id: planId,
    risk_level: risk as "L1" | "L2" | "L3",
    rollback_expectation: rollback,
    gate: stringFlag(flags, "gate"),
  });
  const outputPath = path.resolve(cwd, out);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
  writeJson({
    status: "success",
    summary: "markdown backlog imported",
    artifacts: [{ type: "plan", path: path.relative(cwd, outputPath) }],
    next_actions: [`agent-harness plan-lint --plan ${out}`, `agent-harness session start --plan ${out} --run-id ${planId} --mode weak`],
    errors: [],
    data: { tasks: plan.tasks.length, gates: plan.gates },
  });
}
