import { loadConfig } from "../core/config.js";
import { analyzeRepeatedFailures } from "../core/steering.js";
import { assessHarnessability, doctorControls, runDoctor } from "../core/doctor.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeJson } from "./output.js";

export function doctorCommand(args: string[], cwd = process.cwd()): void {
  const flags = parseFlags(args);
  const target = stringFlag(flags, "cwd") ?? cwd;
  const config = loadConfig(target, stringFlag(flags, "config") ?? "agent-harness.config.json");
  const result = runDoctor(target, config);
  const harnessability = flags.harnessability === true ? assessHarnessability(target, config) : undefined;
  const controls = flags.controls === true ? doctorControls() : undefined;
  const steering = flags.steering === true ? analyzeRepeatedFailures(target, config) : undefined;
  writeJson({
    status: result.status,
    summary: result.status === "success" ? "doctor passed" : "doctor found issues",
    artifacts: [],
    next_actions: [
      ...result.findings.map((finding) => finding.remediation),
      ...(harnessability?.weak.map((id) => `improve_harnessability:${id}`) ?? []),
      ...(steering?.suggestions.map((item) => item.suggestion) ?? []),
    ],
    errors: result.findings.filter((finding) => ["error", "fatal"].includes(finding.severity)).map((finding) => finding.message),
    data: { findings: result.findings, harnessability, controls, steering },
  });
  if (result.status === "error") process.exitCode = 1;
}
