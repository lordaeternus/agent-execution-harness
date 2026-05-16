import type { AgentHarnessPlan, AgentHarnessTask } from "./plan-types.js";
import type { HandoffPacket, HandoffTaskContext, HandoffValidationResult, WeakWorkerOutput } from "./handoff-types.js";
import { dependenciesForTask } from "./task-graph.js";

const FORBIDDEN_ACTIONS = [
  "decide architecture",
  "edit undeclared files",
  "invent APIs, file paths, IDs, versions, dates or commands",
  "claim success without evidence",
  "paste long logs instead of short excerpts",
];

const BLOCKED_IF = [
  "required file is missing",
  "verification command is unavailable",
  "task needs an extra file",
  "security, auth, database or destructive behavior is unclear",
];

const EXACT_STEPS = [
  "Read only allowed files.",
  "Make the smallest patch.",
  "Run only allowed commands.",
  "Return JSON only.",
];

const PLACEHOLDER_PATTERN = /\b(TODO|FIXME|TBD|placeholder|resto do c[oó]digo|rest of code|continue here|implement later)\b/i;

export function buildHandoffPacket(plan: AgentHarnessPlan, taskId: string): HandoffPacket {
  const context = resolveTaskContext(plan, taskId);
  return {
    role: "implementation_worker_only",
    target: "weak-worker",
    task_id: context.task.task_id,
    depends_on: dependenciesForTask(context.task),
    blocks_tasks: context.blocksTasks,
    allowed_files: context.task.files ?? [],
    allowed_commands: allowedCommands(context),
    context_refs: context.task.context_refs,
    forbidden_actions: FORBIDDEN_ACTIONS,
    blocked_if: BLOCKED_IF,
    exact_steps: EXACT_STEPS,
    output_schema: {
      status: "done|blocked|failed",
      files_changed: "string[]",
      evidence: "array",
      residual_risk: "string",
    },
  };
}

export function buildHandoffPrompt(packet: HandoffPacket): string {
  return [
    "You are an implementation worker only.",
    "Do not decide architecture. Do not invent facts. Do not edit files outside allowed_files.",
    "If blocked, return status=blocked. Return JSON only.",
    JSON.stringify(packet),
  ].join("\n");
}

export function validateWeakWorkerOutput(plan: AgentHarnessPlan, taskId: string, input: unknown): HandoffValidationResult {
  const errors: string[] = [];
  const context = resolveTaskContext(plan, taskId);
  if (!isRecord(input)) return { valid: false, errors: ["worker output must be a JSON object"] };
  const output = input as Partial<WeakWorkerOutput>;
  if (!["done", "blocked", "failed"].includes(String(output.status))) errors.push("status must be done, blocked or failed");
  if (!Array.isArray(output.files_changed) || output.files_changed.some((item) => typeof item !== "string")) errors.push("files_changed must be a string array");
  if (!Array.isArray(output.evidence)) errors.push("evidence must be an array");
  if (typeof output.residual_risk !== "string") errors.push("residual_risk must be a string");
  if (containsPlaceholder(output)) errors.push("worker output contains placeholder text");

  const allowedFiles = new Set(context.task.files ?? []);
  for (const file of output.files_changed ?? []) {
    if (!allowedFiles.has(file)) errors.push(`file outside allowed_files: ${file}`);
  }

  const allowed = new Set(allowedCommands(context));
  for (const evidence of output.evidence ?? []) {
    const command = evidence.command ?? evidence.check;
    if (output.status === "done") {
      if (!command) errors.push("done evidence requires command or check");
      if (evidence.result !== "pass") errors.push("done evidence requires result=pass");
      if (typeof evidence.output_excerpt !== "string" || !evidence.output_excerpt.trim()) errors.push("done evidence requires output_excerpt");
    }
    if (command && allowed.size > 0 && !allowed.has(command)) errors.push(`command outside allowed_commands: ${command}`);
  }

  if (output.status === "done") {
    if (!output.evidence?.length) errors.push("done requires evidence");
    if (!output.files_changed?.length) errors.push("done requires files_changed");
    if (allowed.size === 0) errors.push("done requires allowed_commands");
  }

  return { valid: errors.length === 0, errors };
}

export function parseWeakWorkerOutput(raw: string): WeakWorkerOutput {
  return JSON.parse(raw) as WeakWorkerOutput;
}

function resolveTaskContext(plan: AgentHarnessPlan, taskId: string): HandoffTaskContext {
  const task = plan.tasks.find((item) => item.task_id === taskId);
  if (!task) throw new Error(`unknown task_id: ${taskId}`);
  return {
    task,
    planGates: plan.gates ?? [],
    blocksTasks: plan.tasks.filter((item) => dependenciesForTask(item).includes(taskId)).map((item) => item.task_id).sort(),
  };
}

function allowedCommands(context: HandoffTaskContext): string[] {
  if (context.task.allowed_commands?.length) return [...context.task.allowed_commands];
  return context.planGates.length === 1 ? [context.planGates[0]] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsPlaceholder(value: unknown): boolean {
  if (typeof value === "string") return PLACEHOLDER_PATTERN.test(value);
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  if (isRecord(value)) return Object.values(value).some(containsPlaceholder);
  return false;
}
