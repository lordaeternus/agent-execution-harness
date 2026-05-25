import { loadConfig } from "../core/config.js";
import { analyzeRepeatedFailures } from "../core/steering.js";
import { assessArchitecture, assessCoverage, assessHarnessability, assessQuality, assessRuntimeCompatibility, doctorControls, runDoctor } from "../core/doctor.js";
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
  const coverage = flags.coverage === true ? assessCoverage(target, config) : undefined;
  const architecture = flags.architecture === true ? assessArchitecture(target, config) : undefined;
  const quality = flags.quality === true ? assessQuality(target, config) : undefined;
  const runtime = flags.runtime === true ? assessRuntimeCompatibility(config) : undefined;
  const output = envelope({
    status: result.status,
    summary: result.status === "success" ? "doctor passed" : "doctor found issues",
    artifacts: [],
    next_actions: [
      ...result.findings.map((finding) => finding.remediation),
      ...(harnessability?.weak.map((id) => `improve_harnessability:${id}`) ?? []),
      ...(steering?.suggestions.map((item) => item.suggestion) ?? []),
      ...(coverage?.gaps.map((item) => item.action) ?? []),
      ...(architecture?.violations.map((item) => `Fix architecture rule ${item.rule_id} in ${item.file}`) ?? []),
      ...(quality?.next_actions ?? []),
      ...(runtime?.next_actions ?? []),
    ],
    errors: result.findings.filter((finding) => ["error", "fatal"].includes(finding.severity)).map((finding) => finding.message),
    data: { findings: result.findings, harnessability, controls, steering, coverage, architecture, quality, runtime },
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
    coverage?: { topology: string; covered_controls: string[]; gaps: Array<{ control: string; action: string }>; recommended_controls: string[] };
    architecture?: { checked_rules: number; scanned_files: number; violations: Array<{ rule_id: string; file: string; forbidden_import: string }> };
    quality?: { status: string; score: number; summary: string; signals: Record<string, number | string>; risks: string[] };
    runtime?: {
      mode: string;
      capabilities: {
        supports_subagents: boolean;
        supports_worktrees: boolean;
        supports_json_output: boolean;
        shell_permission_model: string;
        max_parallel: number;
      };
      warnings: string[];
    };
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
  if (data.coverage) {
    lines.push("", `Coverage: topology=${data.coverage.topology} covered=${data.coverage.covered_controls.length} gaps=${data.coverage.gaps.length}`);
    for (const gap of data.coverage.gaps.slice(0, 5)) lines.push(`- ${gap.control}: ${gap.action}`);
  }
  if (data.architecture) {
    lines.push("", `Architecture: rules=${data.architecture.checked_rules} files=${data.architecture.scanned_files} violations=${data.architecture.violations.length}`);
    for (const violation of data.architecture.violations.slice(0, 5)) lines.push(`- ${violation.rule_id}: ${violation.file} imports ${violation.forbidden_import}`);
  }
  if (data.quality) {
    lines.push("", `Quality: ${data.quality.status} score=${data.quality.score}/100`);
    lines.push(`Signals: doctor=${data.quality.signals.doctor_status} harnessability=${data.quality.signals.harnessability_score} coverage_gaps=${data.quality.signals.coverage_gaps} architecture_violations=${data.quality.signals.architecture_violations} recurring_risks=${data.quality.signals.recurring_risks}`);
    for (const risk of data.quality.risks.slice(0, 5)) lines.push(`- ${risk}`);
  }
  if (data.runtime) {
    const capabilities = data.runtime.capabilities;
    lines.push("", `Runtime: mode=${data.runtime.mode} subagents=${capabilities.supports_subagents} worktrees=${capabilities.supports_worktrees} json=${capabilities.supports_json_output} shell=${capabilities.shell_permission_model} max_parallel=${capabilities.max_parallel}`);
    for (const warning of data.runtime.warnings.slice(0, 5)) lines.push(`- ${warning}`);
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
