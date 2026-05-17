import fs from "node:fs";
import path from "node:path";
import { applyPatchFile, validatePatchIntake } from "../core/patch-intake.js";
import type { AgentHarnessPlan } from "../core/plan-types.js";
import { readJson } from "../core/utils.js";
import { parseWeakWorkerOutput } from "../core/handoff.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeCompactJson } from "./output.js";

export function patchCommand(args: string[], cwd = process.cwd()): void {
  const [verb, ...rest] = args;
  if (verb === "intake") return intakeCommand(rest, cwd);
  if (verb === "--help" || verb === "help") return help();
  throw new Error(`unknown patch command: ${verb ?? ""}`.trim());
}

function intakeCommand(args: string[], cwd: string): void {
  const flags = parseFlags(args);
  const plan = readJson<AgentHarnessPlan>(path.resolve(cwd, stringFlag(flags, "plan", true)!));
  const taskId = stringFlag(flags, "task-id", true)!;
  const patchPath = stringFlag(flags, "patch", true)!;
  const absolutePatchPath = path.resolve(cwd, patchPath);
  const workerOutputPath = stringFlag(flags, "worker-output");
  const patchText = fs.readFileSync(absolutePatchPath, "utf8");
  const workerOutput = workerOutputPath ? parseWeakWorkerOutput(fs.readFileSync(path.resolve(cwd, workerOutputPath), "utf8")) : undefined;
  const result = validatePatchIntake(plan, { taskId, patchText, workerOutput });

  if (!result.valid) {
    process.exitCode = 1;
    writeCompactJson({
      status: "error",
      summary: `patch intake rejected task=${taskId}`,
      artifacts: intakeArtifacts(patchPath, workerOutputPath),
      next_actions: result.next_actions,
      errors: result.errors,
      data: { changed_files: result.changed_files, applied: false },
    });
    return;
  }

  if (flags.apply === true) {
    const applied = applyPatchFile(cwd, absolutePatchPath);
    if (!applied.applied) {
      process.exitCode = 1;
      writeCompactJson({
        status: "error",
        summary: `patch apply rejected task=${taskId}`,
        artifacts: intakeArtifacts(patchPath, workerOutputPath),
        next_actions: ["rerun task serial", "review patch context"],
        errors: applied.errors,
        data: { changed_files: result.changed_files, applied: false },
      });
      return;
    }
  }

  writeCompactJson({
    status: "success",
    summary: flags.apply === true ? `patch applied task=${taskId}` : `patch accepted task=${taskId}`,
    artifacts: intakeArtifacts(patchPath, workerOutputPath),
    next_actions: flags.apply === true ? ["agent-harness verify"] : result.next_actions,
    errors: [],
    data: { changed_files: result.changed_files, applied: flags.apply === true },
  });
}

function intakeArtifacts(patchPath: string, workerOutputPath?: string): Array<{ type: string; path: string }> {
  const artifacts = [{ type: "patch", path: patchPath }];
  if (workerOutputPath) artifacts.push({ type: "worker_output", path: workerOutputPath });
  return artifacts;
}

function help(): void {
  process.stdout.write("agent-harness patch intake --plan plan.json --task-id task-id --patch worker.patch [--worker-output worker-output.json] [--apply]\n");
}
