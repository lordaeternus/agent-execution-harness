import path from "node:path";
import { lintPlan } from "../core/schema-validation.js";
import { readJson } from "../core/utils.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeJson } from "./output.js";

export function planLintCommand(args: string[], cwd = process.cwd()): void {
  const flags = parseFlags(args);
  const planPath = stringFlag(flags, "plan", true)!;
  const result = lintPlan(readJson(path.resolve(cwd, planPath)));
  writeJson({
    status: result.status,
    summary: result.status === "success" ? "plan valid" : "plan invalid",
    artifacts: [],
    next_actions: result.status === "success" ? ["execute"] : ["fix_plan"],
    errors: result.errors,
  });
  if (result.status === "error") process.exitCode = 1;
}
