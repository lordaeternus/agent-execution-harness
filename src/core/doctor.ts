import fs from "node:fs";
import path from "node:path";
import type { AgentHarnessConfig } from "./config-types.js";

export interface DoctorFinding {
  severity: "info" | "warning" | "error" | "fatal";
  message: string;
  remediation: string;
}

export function runDoctor(cwd: string, config: AgentHarnessConfig): { status: "success" | "error"; findings: DoctorFinding[] } {
  const findings: DoctorFinding[] = [];
  const exists = (file: string) => fs.existsSync(path.join(cwd, file));
  if (!exists("package.json")) findings.push({ severity: "fatal", message: "package.json missing", remediation: "Create package.json or run init." });
  if (!exists("AGENTS.md")) findings.push({ severity: "error", message: "AGENTS.md missing", remediation: "Install generic AGENTS template." });
  if (!exists("agent-harness.config.json")) findings.push({ severity: "warning", message: "config missing", remediation: "Create agent-harness.config.json." });
  const gitignore = exists(".gitignore") ? fs.readFileSync(path.join(cwd, ".gitignore"), "utf8") : "";
  if (!gitignore.includes(config.artifact_dir)) findings.push({ severity: "warning", message: "artifact_dir not ignored", remediation: `Add ${config.artifact_dir} to .gitignore.` });
  return { status: findings.some((item) => ["error", "fatal"].includes(item.severity)) ? "error" : "success", findings };
}
