import { loadConfig } from "../core/config.js";
import { runDoctor } from "../core/doctor.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeJson } from "./output.js";

export function doctorCommand(args: string[], cwd = process.cwd()): void {
  const flags = parseFlags(args);
  const target = stringFlag(flags, "cwd") ?? cwd;
  const config = loadConfig(target, stringFlag(flags, "config") ?? "agent-harness.config.json");
  const result = runDoctor(target, config);
  writeJson({
    status: result.status,
    summary: result.status === "success" ? "doctor passed" : "doctor found issues",
    artifacts: [],
    next_actions: result.findings.map((finding) => finding.remediation),
    errors: result.findings.filter((finding) => ["error", "fatal"].includes(finding.severity)).map((finding) => finding.message),
    data: result.findings,
  });
  if (result.status === "error") process.exitCode = 1;
}
