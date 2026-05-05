import fs from "node:fs";
import path from "node:path";
import type { AgentHarnessConfig } from "./config-types.js";
import { listControls, type HarnessControl } from "./control-catalog.js";

export interface DoctorFinding {
  severity: "info" | "warning" | "error" | "fatal";
  code: string;
  message: string;
  remediation: string;
  doc_url: string;
}

export interface HarnessabilityCheck {
  id: string;
  passed: boolean;
  weight: number;
  message: string;
}

export interface HarnessabilityReport {
  score: number;
  checks: HarnessabilityCheck[];
  strong: string[];
  weak: string[];
}

export function runDoctor(cwd: string, config: AgentHarnessConfig): { status: "success" | "error"; findings: DoctorFinding[] } {
  const findings: DoctorFinding[] = [];
  const exists = (file: string) => fs.existsSync(path.join(cwd, file));
  if (!exists("package.json")) findings.push(finding("fatal", "missing_package_json", "package.json missing", "Create package.json or run init."));
  if (!exists("AGENTS.md")) findings.push(finding("error", "missing_agents", "AGENTS.md missing", "Install generic AGENTS template."));
  if (!exists("agent-harness.config.json")) findings.push(finding("warning", "missing_config", "config missing", "Create agent-harness.config.json."));
  const gitignore = exists(".gitignore") ? fs.readFileSync(path.join(cwd, ".gitignore"), "utf8") : "";
  if (!gitignore.includes(config.artifact_dir)) findings.push(finding("warning", "artifact_dir_not_ignored", "artifact_dir not ignored", `Add ${config.artifact_dir} to .gitignore.`));
  if (exists("package.json")) {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")) as { scripts?: Record<string, string>; engines?: { node?: string } };
    for (const script of config.required_scripts) {
      if (!pkg.scripts?.[script]) findings.push(finding(config.doctor_profile === "ci" ? "error" : "warning", "missing_script", `missing script: ${script}`, `Add package.json script ${script}.`));
    }
  }
  if (!Array.isArray(config.command_policy.deny) || config.command_policy.deny.length === 0) {
    findings.push(finding("error", "weak_command_policy", "command policy has no deny rules", "Add destructive command deny rules."));
  }
  return { status: findings.some((item) => ["error", "fatal"].includes(item.severity)) ? "error" : "success", findings };
}

export function assessHarnessability(cwd: string, config: AgentHarnessConfig): HarnessabilityReport {
  const exists = (file: string) => fs.existsSync(path.join(cwd, file));
  const pkg = readPackage(cwd);
  const scripts = pkg.scripts ?? {};
  const checks: HarnessabilityCheck[] = [
    check("package_json", exists("package.json"), 15, "package.json exists"),
    check("agents_rules", exists("AGENTS.md"), 15, "AGENTS.md exists"),
    check("harness_config", exists("agent-harness.config.json"), 10, "agent-harness.config.json exists"),
    check("tests_present", exists("tests") || exists("src"), 10, "tests or source directory exists"),
    check("runtime_doc", exists("docs/agent-runtime.md") || exists("docs/process/agent-runtime.md"), 10, "short agent runtime doc exists"),
    check("lint_script", hasScript(scripts, ["lint"]), 10, "lint script exists"),
    check("test_script", hasScript(scripts, ["test", "test:run"]), 10, "test script exists"),
    check("typecheck_script", hasScript(scripts, ["typecheck"]) || scriptIncludes(scripts, "tsc --noEmit"), 10, "typecheck script exists"),
    check("artifact_policy", config.artifact_dir.length > 0 && exists(".gitignore"), 5, "artifact directory and .gitignore are configured"),
    check("command_policy", Array.isArray(config.command_policy.deny) && config.command_policy.deny.length > 0, 5, "deny rules protect dangerous commands"),
  ];
  const total = checks.reduce((sum, item) => sum + item.weight, 0);
  const earned = checks.filter((item) => item.passed).reduce((sum, item) => sum + item.weight, 0);
  return {
    score: total > 0 ? Math.round((earned / total) * 100) : 0,
    checks,
    strong: checks.filter((item) => item.passed).map((item) => item.id),
    weak: checks.filter((item) => !item.passed).map((item) => item.id),
  };
}

export function doctorControls(): HarnessControl[] {
  return listControls();
}

function finding(severity: DoctorFinding["severity"], code: string, message: string, remediation: string): DoctorFinding {
  return {
    severity,
    code,
    message,
    remediation,
    doc_url: `https://github.com/lordaeternus/agent-execution-harness/blob/main/docs/installation.md#${code}`,
  };
}

function check(id: string, passed: boolean, weight: number, message: string): HarnessabilityCheck {
  return { id, passed, weight, message };
}

function readPackage(cwd: string): { scripts?: Record<string, string> } {
  const file = path.join(cwd, "package.json");
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as { scripts?: Record<string, string> };
  } catch {
    return {};
  }
}

function hasScript(scripts: Record<string, string>, names: string[]): boolean {
  return names.some((name) => typeof scripts[name] === "string" && scripts[name].trim().length > 0);
}

function scriptIncludes(scripts: Record<string, string>, pattern: string): boolean {
  return Object.values(scripts).some((script) => script.includes(pattern));
}
