import fs from "node:fs";
import path from "node:path";
import type { AgentHarnessConfig } from "./config-types.js";

export interface DoctorFinding {
  severity: "info" | "warning" | "error" | "fatal";
  code: string;
  message: string;
  remediation: string;
  doc_url: string;
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

function finding(severity: DoctorFinding["severity"], code: string, message: string, remediation: string): DoctorFinding {
  return {
    severity,
    code,
    message,
    remediation,
    doc_url: `https://github.com/lordaeternus/agent-execution-harness/blob/main/docs/installation.md#${code}`,
  };
}
