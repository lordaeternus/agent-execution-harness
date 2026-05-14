import { PLAN_SCHEMA_VERSION } from "./constants.js";
import type { AgentHarnessPlan, RiskLevel } from "./plan-types.js";
import { validatePlan } from "./schema-validation.js";

const TASK_LINE = /^-\s*\[\s*[ xX]?\s*\]\s*\*\*Tarefa\s*\[(\d+)\]\*\*:\s*(.+)$/i;
const DEPENDENCY_LINE = /^\s*-\s*\*\*Depend[eê]ncia:\*\*\s*(.+)$/i;
const DOD_LINE = /^\s*-\s*\*\*DoD:\*\*\s*(.+)$/i;
const COMMAND_HINT = /\b(pnpm|npm|node|npx|git|tsc|vitest|playwright)\b[^\n\r]*/i;

export interface ImportMarkdownPlanOptions {
  plan_id: string;
  risk_level: RiskLevel;
  rollback_expectation: string;
  gate?: string;
  execution_profile?: "standard" | "constrained" | "weak" | "strict";
}

interface DraftTask {
  number: number;
  line: string;
  files: string[];
  dependency?: string;
  dod?: string;
}

export function importMarkdownPlan(markdown: string, options: ImportMarkdownPlanOptions): AgentHarnessPlan {
  const tasks = parseTasks(markdown);
  if (!tasks.length) throw new Error("No atomic backlog tasks found. Expected '- [ ] **Tarefa [N]**: ...'.");
  for (const task of tasks) {
    if (!task.files.length) throw new Error(`task-${task.number} must declare at least one file in backticks.`);
    if (!task.dod?.trim()) throw new Error(`task-${task.number} must include a DoD line.`);
  }

  const gates = unique([...tasks.map((task) => extractCommand(task.dod ?? "")).filter(isString), options.gate].filter(isString));
  if (!gates.length) throw new Error("No command-like DoD found. Provide --gate <command>.");

  const plan: AgentHarnessPlan = {
    schema_version: PLAN_SCHEMA_VERSION,
    plan_id: options.plan_id,
    risk_level: options.risk_level,
    rollback_expectation: options.rollback_expectation,
    execution_profile: options.execution_profile ?? "weak",
    gates,
    tasks: tasks.map((task) => {
      const dod = task.dod ?? "";
      const command = extractCommand(dod);
      return {
        task_id: taskId(task.number),
        depends_on: parseDependency(task.dependency),
        files: task.files,
        acceptance_criteria: dod.trim(),
        required_checks: command ? [command] : undefined,
        allowed_commands: command ? [command] : undefined,
      };
    }),
  };

  validatePlan(plan);
  return plan;
}

function parseTasks(markdown: string): DraftTask[] {
  const tasks: DraftTask[] = [];
  let current: DraftTask | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    const taskMatch = TASK_LINE.exec(line);
    if (taskMatch) {
      current = {
        number: Number(taskMatch[1]),
        line,
        files: extractBacktickValues(taskMatch[2]),
      };
      tasks.push(current);
      continue;
    }
    if (!current) continue;
    const dependency = DEPENDENCY_LINE.exec(line);
    if (dependency) {
      current.dependency = dependency[1].trim();
      continue;
    }
    const dod = DOD_LINE.exec(line);
    if (dod) current.dod = dod[1].trim();
  }
  return tasks;
}

function extractBacktickValues(value: string): string[] {
  return unique([...value.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim()).filter(Boolean));
}

function parseDependency(value: string | undefined): string[] {
  if (!value || /^nenhum$/i.test(value.trim())) return [];
  return unique([...value.matchAll(/Tarefa\s*(\d+)/gi)].map((match) => taskId(Number(match[1]))));
}

function extractCommand(value: string): string | undefined {
  const backtickCommands = extractBacktickValues(value).filter((item) => COMMAND_HINT.test(item));
  if (backtickCommands[0]) return backtickCommands[0];
  const match = COMMAND_HINT.exec(value);
  return match?.[0]?.trim();
}

function taskId(number: number): string {
  return `task-${number}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
