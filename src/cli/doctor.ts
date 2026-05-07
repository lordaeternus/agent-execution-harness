import { loadConfig } from "../core/config.js";
import { analyzeRepeatedFailures } from "../core/steering.js";
import { assessHarnessability, doctorControls, runDoctor } from "../core/doctor.js";
import { parseFlags, stringFlag } from "./args.js";
import { envelope, type CliEnvelope, writeHuman, writeJson } from "./output.js";

export function doctorCommand(args: string[], cwd = process.cwd()): void {
  const flags = parseFlags(args);
  const json = flags.json === true;
  const target = stringFlag(flags, "cwd") ?? cwd;
  const config = loadConfig(target, stringFlag(flags, "config") ?? "agent-harness.config.json");
  const result = runDoctor(target, config);
  const harnessability = flags.harnessability === true ? assessHarnessability(target, config) : undefined;
  const controls = flags.controls === true ? doctorControls() : undefined;
  const steering = flags.steering === true ? analyzeRepeatedFailures(target, config) : undefined;
  const output = envelope({
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
  if (json) writeJson(output);
  else writeHuman(renderDoctorResult(output));
  if (result.status === "error") process.exitCode = 1;
}

function renderDoctorResult(output: CliEnvelope): string[] {
  const data = output.data as {
    findings?: Array<{ severity: string; code: string; message: string; remediation: string }>;
    harnessability?: { score: number; strong: string[]; weak: string[] };
    controls?: Array<{ id: string; risk_covered: string }>;
    steering?: { suggestions: Array<{ key: string; suggestion: string }> };
  };
  const lines: string[] = [
    output.status === "success" ? "Agent Execution Harness doctor passed." : "Agent Execution Harness doctor found issues.",
  ];
  if (data.harnessability) {
    lines.push(`Harnessability score: ${data.harnessability.score}/100`);
    if (data.harnessability.weak.length > 0) lines.push(`Can improve: ${data.harnessability.weak.join(", ")}`);
  }
  if (data.findings && data.findings.length > 0) {
    lines.push("", "Findings:");
    for (const finding of data.findings) lines.push(`- [${finding.severity}] ${finding.message} -> ${finding.remediation}`);
  }
  if (data.controls && data.controls.length > 0) {
    lines.push("", "Available low-token controls:");
    for (const control of data.controls) lines.push(`- ${control.id}: ${control.risk_covered}`);
  }
  if (data.steering?.suggestions && data.steering.suggestions.length > 0) {
    lines.push("", "Suggested steering:");
    for (const item of data.steering.suggestions) lines.push(`- ${item.suggestion}`);
  }
  if (output.next_actions.length > 0) {
    lines.push("", "Next actions:");
    for (const action of output.next_actions) lines.push(`- ${action}`);
  } else {
    lines.push("", "Next action: start using the harness in your AI-agent workflow.");
  }
  lines.push("", "For JSON output:", "npx agent-execution-harness@latest doctor --json --harnessability --cwd .");
  return lines;
}
