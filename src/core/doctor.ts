import fs from "node:fs";
import path from "node:path";
import type { AgentHarnessConfig } from "./config-types.js";
import { listControls, type HarnessControl } from "./control-catalog.js";
import { normalizeRuntimeCapabilities, type RuntimeCapabilities } from "./runtime-capabilities.js";
import { analyzeRepeatedFailures } from "./steering.js";

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

export type ProjectTopology = "cli-package" | "web-app" | "supabase-app" | "api-service" | "generic";

export interface CoverageGap {
  id: string;
  severity: "info" | "warning";
  control: string;
  action: string;
}

export interface CoverageReport {
  topology: ProjectTopology;
  covered_controls: string[];
  gaps: CoverageGap[];
  recommended_controls: string[];
}

export interface ArchitectureViolation {
  rule_id: string;
  file: string;
  forbidden_import: string;
  reason?: string;
}

export interface ArchitectureReport {
  checked_rules: number;
  scanned_files: number;
  violations: ArchitectureViolation[];
}

export interface QualitySnapshot {
  status: "healthy" | "needs_attention" | "blocked";
  score: number;
  summary: string;
  signals: {
    doctor_status: "success" | "error";
    harnessability_score: number;
    coverage_gaps: number;
    architecture_violations: number;
    recurring_risks: number;
  };
  risks: string[];
  next_actions: string[];
}

export interface RuntimeCompatibilityReport {
  capabilities: RuntimeCapabilities;
  mode: "serial" | "parallel_candidate";
  warnings: string[];
  next_actions: string[];
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

export function assessRuntimeCompatibility(config: AgentHarnessConfig): RuntimeCompatibilityReport {
  const capabilities = normalizeRuntimeCapabilities(config.runtime_capabilities);
  const warnings: string[] = [];
  if (capabilities.supports_subagents && capabilities.max_parallel < 2) {
    warnings.push("supports_subagents is true but max_parallel is below 2");
  }
  if (capabilities.supports_worktrees) {
    warnings.push("worktree support is a runtime capability; the harness does not create automatic sandboxes or branches");
  }
  return {
    capabilities,
    mode: capabilities.supports_subagents ? "parallel_candidate" : "serial",
    warnings,
    next_actions: capabilities.supports_subagents ? ["use dispatch next --batch"] : ["use next --exact"],
  };
}

export function detectProjectTopology(cwd: string): ProjectTopology {
  const pkg = readPackage(cwd) as { bin?: unknown; scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  if (pkg.bin && (typeof pkg.bin === "string" || Object.keys(pkg.bin as object).length > 0)) return "cli-package";
  if (existsAny(cwd, ["supabase/functions", "supabase/migrations"])) return "supabase-app";
  if (existsAny(cwd, ["vite.config.ts", "vite.config.js", "next.config.js", "next.config.mjs"])) return "web-app";
  if (existsAny(cwd, ["src/routes", "src/controllers", "src/server.ts", "src/server.js"])) return "api-service";
  return "generic";
}

export function assessCoverage(cwd: string, config: AgentHarnessConfig): CoverageReport {
  const covered = new Set<string>(["plan_lint", "evidence_policy", "handoff_validate"]);
  const gaps: CoverageGap[] = [];
  const topology = detectProjectTopology(cwd);
  const recommended = recommendedControls(topology);
  const agentsText = readOptional(cwd, "AGENTS.md").toLowerCase();

  if (config.scope_guard?.enabled !== false) covered.add("scope_guard");
  else gaps.push(gap("scope_guard", "warning", "Enable scope_guard to block out-of-plan file changes."));

  if (config.command_policy.strict_requires_allowed_command && config.command_policy.strict_disallow_shell) covered.add("strict_command_policy");
  else gaps.push(gap("strict_command_policy", "warning", "Enable strict allowed commands for weak or sensitive runs."));

  if (existsAny(cwd, ["tests/fixtures/approved", "fixtures/approved"])) covered.add("approved_fixtures");
  else if (["supabase-app", "api-service"].includes(topology)) gaps.push(gap("approved_fixtures", "info", "Add approved fixtures for auth, billing, clinical, payment, or critical transforms."));

  if (/(surgical|smallest|menor|assumption|assumptions|success criteria|criterio|critério|evidence|evidencia|evidência)/i.test(agentsText)) {
    covered.add("coding_discipline");
  } else {
    gaps.push(gap("coding_discipline", "info", "Add compact coding discipline rules to AGENTS.md for weak agents."));
  }

  if ((config.architecture_rules ?? []).length > 0) covered.add("architecture_rules");
  else if (["supabase-app", "api-service", "web-app"].includes(topology)) gaps.push(gap("architecture_rules", "info", "Add lightweight architecture_rules for known client/server or sensitive boundaries."));

  return {
    topology,
    covered_controls: [...covered].sort(),
    gaps,
    recommended_controls: recommended.filter((control) => !covered.has(control)),
  };
}

export function assessArchitecture(cwd: string, config: AgentHarnessConfig): ArchitectureReport {
  const rules = config.architecture_rules ?? [];
  const files = collectProjectFiles(cwd, config);
  const violations: ArchitectureViolation[] = [];
  for (const rule of rules) {
    const from = globToRegExp(rule.from);
    const forbidden = globToRegExp(rule.forbid_import);
    for (const file of files) {
      if (!from.test(file)) continue;
      const content = readOptional(cwd, file);
      const imports = importSpecifiers(content);
      if (imports.some((specifier) => forbidden.test(specifier))) {
        violations.push({ rule_id: rule.id, file, forbidden_import: rule.forbid_import, reason: rule.reason });
      }
    }
  }
  return { checked_rules: rules.length, scanned_files: files.length, violations };
}

export function assessQuality(cwd: string, config: AgentHarnessConfig): QualitySnapshot {
  const doctor = runDoctor(cwd, config);
  const harnessability = assessHarnessability(cwd, config);
  const coverage = assessCoverage(cwd, config);
  const architecture = assessArchitecture(cwd, config);
  const steering = analyzeRepeatedFailures(cwd, config);
  const risks = [
    ...doctor.findings.filter((item) => item.severity !== "info").map((item) => `${item.severity}:${item.code}`),
    ...coverage.gaps.filter((gap) => gap.severity === "warning").map((gap) => `coverage:${gap.control}`),
    ...architecture.violations.slice(0, 5).map((violation) => `architecture:${violation.rule_id}:${violation.file}`),
    ...steering.suggestions.slice(0, 5).map((item) => `recurring:${item.key}`),
  ];
  const penalty = Math.min(
    100,
    doctor.findings.reduce((sum, item) => sum + severityPenalty(item.severity), 0)
      + Math.max(0, 80 - harnessability.score)
      + coverage.gaps.reduce((sum, gap) => sum + (gap.severity === "warning" ? 10 : 3), 0)
      + Math.min(30, architecture.violations.length * 10)
      + Math.min(20, steering.suggestions.length * 5),
  );
  const score = Math.max(0, 100 - penalty);
  const status = doctor.status === "error" ? "blocked" : score >= 80 ? "healthy" : "needs_attention";
  const nextActions = [
    ...doctor.findings.map((finding) => finding.remediation),
    ...harnessability.weak.slice(0, 5).map((id) => `improve_harnessability:${id}`),
    ...coverage.gaps.slice(0, 5).map((gap) => gap.action),
    ...architecture.violations.slice(0, 5).map((violation) => `Fix architecture rule ${violation.rule_id} in ${violation.file}`),
    ...steering.suggestions.slice(0, 5).map((item) => item.suggestion),
  ];
  return {
    status,
    score,
    summary: `quality ${status} score=${score}/100`,
    signals: {
      doctor_status: doctor.status,
      harnessability_score: harnessability.score,
      coverage_gaps: coverage.gaps.length,
      architecture_violations: architecture.violations.length,
      recurring_risks: steering.suggestions.length,
    },
    risks: risks.slice(0, 10),
    next_actions: unique(nextActions).slice(0, 10),
  };
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

function severityPenalty(severity: DoctorFinding["severity"]): number {
  if (severity === "fatal") return 45;
  if (severity === "error") return 30;
  if (severity === "warning") return 10;
  return 2;
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

function existsAny(cwd: string, entries: string[]): boolean {
  return entries.some((entry) => fs.existsSync(path.join(cwd, entry)));
}

function readOptional(cwd: string, file: string): string {
  try {
    return fs.readFileSync(path.join(cwd, file), "utf8");
  } catch {
    return "";
  }
}

function gap(control: string, severity: CoverageGap["severity"], action: string): CoverageGap {
  return { id: `missing_${control}`, severity, control, action };
}

function recommendedControls(topology: ProjectTopology): string[] {
  const common = ["coding_discipline", "scope_guard", "evidence_policy"];
  if (topology === "cli-package") return [...common, "strict_command_policy"];
  if (topology === "web-app") return [...common, "architecture_rules"];
  if (topology === "supabase-app") return [...common, "strict_command_policy", "approved_fixtures", "architecture_rules"];
  if (topology === "api-service") return [...common, "strict_command_policy", "approved_fixtures", "architecture_rules"];
  return common;
}

function collectProjectFiles(cwd: string, config: AgentHarnessConfig): string[] {
  const roots = config.product_paths.length ? config.product_paths : ["src/"];
  const files: string[] = [];
  for (const root of roots) walk(path.join(cwd, root), cwd, files);
  return files.filter((file) => /\.(tsx?|jsx?|mjs|cjs)$/.test(file)).sort();
}

function walk(dir: string, cwd: string, files: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", "coverage"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cwd, files);
    else files.push(path.relative(cwd, full).replace(/\\/g, "/"));
  }
}

function importSpecifiers(content: string): string[] {
  const specs: string[] = [];
  for (const match of content.matchAll(/\bimport\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']|\brequire\(["']([^"']+)["']\)/g)) {
    specs.push(match[1] ?? match[2]);
  }
  return specs;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/\*\*/g, "__DOUBLE_STAR__")
    .replace(/\*/g, "__STAR__")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/__DOUBLE_STAR__/g, ".*")
    .replace(/__STAR__/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

function hasScript(scripts: Record<string, string>, names: string[]): boolean {
  return names.some((name) => typeof scripts[name] === "string" && scripts[name].trim().length > 0);
}

function scriptIncludes(scripts: Record<string, string>, pattern: string): boolean {
  return Object.values(scripts).some((script) => script.includes(pattern));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
