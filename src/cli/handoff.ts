import fs from "node:fs";
import path from "node:path";
import { buildHandoffPacket, buildHandoffPrompt, parseWeakWorkerOutput, validateWeakWorkerOutput } from "../core/handoff.js";
import type { AgentHarnessPlan } from "../core/plan-types.js";
import { readJson } from "../core/utils.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeCompactJson } from "./output.js";

export function handoffCommand(args: string[], cwd = process.cwd()): void {
  const [verb, ...rest] = args;
  if (verb === "validate") return validateCommand(rest, cwd);
  if (verb === "--help" || verb === "help") return help();
  return createCommand(args, cwd);
}

function createCommand(args: string[], cwd: string): void {
  const flags = parseFlags(args);
  const plan = loadPlan(cwd, flags);
  const taskId = stringFlag(flags, "task-id", true)!;
  const packet = buildHandoffPacket(plan, taskId);
  const prompt = buildHandoffPrompt(packet);
  const compact = flags.compact === true;
  if (compact) {
    process.stdout.write(`${JSON.stringify({ task_id: taskId, prompt, prompt_chars: prompt.length })}\n`);
    return;
  }
  writeCompactJson({
    status: "success",
    summary: `handoff generated task=${taskId} chars=${prompt.length}`,
    artifacts: [],
    next_actions: ["paste data.prompt into weak worker", "handoff validate --input <worker-output.json>"],
    errors: [],
    data: { packet, prompt, prompt_chars: prompt.length },
  });
}

function validateCommand(args: string[], cwd: string): void {
  const flags = parseFlags(args);
  const plan = loadPlan(cwd, flags);
  const taskId = stringFlag(flags, "task-id", true)!;
  const inputPath = stringFlag(flags, "input", true)!;
  const raw = fs.readFileSync(path.resolve(cwd, inputPath), "utf8");
  const output = parseWeakWorkerOutput(raw);
  const result = validateWeakWorkerOutput(plan, taskId, output);
  if (!result.valid) throw new Error(`handoff validation failed: ${result.errors.join("; ")}`);
  writeCompactJson({
    status: "success",
    summary: `handoff validation passed task=${taskId}`,
    artifacts: [{ type: "worker_output", path: inputPath }],
    next_actions: ["record evidence", "review diff"],
    errors: [],
    data: result,
  });
}

function loadPlan(cwd: string, flags: Record<string, string | boolean>): AgentHarnessPlan {
  return readJson<AgentHarnessPlan>(path.resolve(cwd, stringFlag(flags, "plan", true)!));
}

function help(): void {
  process.stdout.write("agent-harness handoff --plan plan.json --task-id task-id\nagent-harness handoff validate --plan plan.json --task-id task-id --input worker-output.json\n");
}
