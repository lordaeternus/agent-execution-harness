import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { createInstallManifest, type InstallAction } from "./install-manifest.js";
import { createBackup, restoreBackup } from "./install-rollback.js";
import { parseFlags, stringFlag } from "./args.js";
import { envelope, type CliEnvelope, writeHuman, writeJson } from "./output.js";

const TEMPLATE_FILES = ["agent-harness.config.json", "AGENTS.md", "docs/agent-runtime.md", "docs/process/agent-runtime.md", ".gitignore", "package.json"];
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AGENTS_SENTINEL_START = "<!-- agent-execution-harness:start -->";
const AGENTS_SENTINEL_END = "<!-- agent-execution-harness:end -->";
type AgentsMode = "skip" | "append" | "overwrite";

export async function initCommand(args: string[], cwd = process.cwd()): Promise<void> {
  const flags = parseFlags(args);
  const json = flags.json === true;
  const adapter = stringFlag(flags, "adapter") ?? "generic";
  const target = stringFlag(flags, "cwd") ?? cwd;
  const apply = flags.apply === true;
  const rollback = stringFlag(flags, "rollback");
  const agentsMode = parseAgentsMode(stringFlag(flags, "agents-mode"));
  if (rollback) {
    const restored = restoreBackup(target, path.resolve(target, rollback));
    const result = envelope({
      status: "success",
      summary: `rollback restored ${restored} entries`,
      artifacts: [{ type: "rollback", path: rollback }],
      next_actions: ["run doctor"],
      errors: [],
    });
    if (json) writeJson(result);
    else writeHuman(["Agent Execution Harness rollback restored successfully.", `Restored entries: ${restored}`, "", "Next step:", "npx agent-execution-harness@latest doctor --harnessability --cwd ."]);
    return;
  }
  const templateRoot = path.resolve(PACKAGE_ROOT, "templates", adapter);
  if (!fs.existsSync(templateRoot)) throw new Error(`unknown adapter: ${adapter}`);
  const files = TEMPLATE_FILES.filter((file) => fs.existsSync(path.join(templateRoot, file)) || file === ".gitignore" || file === "package.json");
  const existing = new Set(files.filter((file) => fs.existsSync(path.join(target, file))));
  const manifest = createInstallManifest(files, existing);
  const backupDir = path.join(".agent-harness", "backups", new Date().toISOString().replace(/[:.]/g, "-"));
  const resolvedAgentsMode = apply ? await resolveAgentsMode(target, agentsMode) : (agentsMode ?? "skip");
  if (apply) {
    createBackup(target, path.join(target, backupDir), files);
    for (const item of manifest) {
      applyTemplate({ templateRoot, target, itemPath: item.path, agentsMode: resolvedAgentsMode });
    }
  }
  const result = envelope({
    status: manifest.some((item) => item.action === "conflict") ? "warning" : "success",
    summary: apply ? "Agent Execution Harness installed successfully" : "Agent Execution Harness dry-run complete; no files changed",
    artifacts: [
      ...manifest.map((item) => ({ type: item.action, path: item.path })),
      ...(apply ? [{ type: "backup", path: backupDir }] : []),
    ],
    next_actions: apply
      ? ["Run doctor: npx agent-execution-harness@latest doctor --harnessability --cwd .", `Rollback if needed: npx agent-execution-harness@latest init --rollback ${backupDir}`]
      : ["Review planned file changes", "Install: npx agent-execution-harness@latest init --apply", "If AGENTS.md already exists, choose append to add harness rules without overwriting current rules"],
    errors: [],
    data: { files: manifest, agents_mode: resolvedAgentsMode, user_message: buildUserMessage(apply, resolvedAgentsMode, backupDir, manifest) },
  });
  if (json) writeJson(result);
  else writeHuman(renderInitResult(result, apply, resolvedAgentsMode, backupDir, manifest));
}

function buildUserMessage(apply: boolean, agentsMode: AgentsMode, backupDir: string, manifest: InstallAction[]): string {
  if (!apply) {
    return "Dry-run complete. No files were changed. Run init --apply to install the harness.";
  }
  const agentsAction = manifest.find((item) => item.path === "AGENTS.md")?.action;
  let agentsText = "AGENTS.md was created or left unchanged.";
  if (agentsAction === "create") agentsText = "AGENTS.md was created.";
  else if (agentsMode === "append") agentsText = "AGENTS.md was appended; existing rules were kept.";
  else if (agentsMode === "overwrite") agentsText = "AGENTS.md was overwritten by explicit request.";
  return `Agent Execution Harness installed successfully. ${agentsText} Backup saved at ${backupDir}. Run doctor next to verify project readiness.`;
}

function renderInitResult(result: CliEnvelope, apply: boolean, agentsMode: AgentsMode, backupDir: string, manifest: InstallAction[]): string[] {
  if (!apply) {
    const planned = manifest.map((item) => `- ${describeInstallAction(item.action)} ${item.path}`);
    return [
      "Agent Execution Harness preview complete.",
      "No files were changed.",
      "",
      "Planned changes:",
      ...planned,
      "",
      "To install or update:",
      "npx agent-execution-harness@latest init --apply --agents-mode append",
      "",
      "Advanced: add --json for automation.",
    ];
  }
  const agentsAction = manifest.find((item) => item.path === "AGENTS.md")?.action;
  let agentsText = "AGENTS.md created or kept unchanged.";
  if (agentsAction === "create") agentsText = "AGENTS.md created.";
  else if (agentsMode === "append") agentsText = "AGENTS.md appended; existing rules kept.";
  else if (agentsMode === "overwrite") agentsText = "AGENTS.md overwritten by explicit request.";
  else if (agentsMode === "skip") agentsText = "AGENTS.md skipped; existing rules kept unchanged.";
  const changed = result.artifacts.filter((artifact) => artifact.type !== "backup").map((artifact) => `- ${artifact.path ?? ""}`);
  return [
    "Agent Execution Harness installed successfully.",
    agentsText,
    `Backup saved at: ${backupDir}`,
    "",
    "Files updated safely:",
    ...changed,
    "",
    "Next step:",
    "npx agent-execution-harness@latest doctor --harnessability --cwd .",
    "",
    "Rollback if needed:",
    `npx agent-execution-harness@latest init --rollback ${backupDir}`,
    "",
    "Advanced: add --json for automation.",
  ];
}

function describeInstallAction(action: string): string {
  if (action === "create") return "create";
  if (action === "merge") return "update safely";
  if (action === "skip") return "keep";
  if (action === "overwrite") return "replace";
  if (action === "conflict") return "needs review";
  return action;
}

function applyTemplate(input: { templateRoot: string; target: string; itemPath: string; agentsMode: AgentsMode }): void {
  const targetPath = path.join(input.target, input.itemPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (input.itemPath === "AGENTS.md") {
    applyAgentsTemplate(input.templateRoot, targetPath, input.agentsMode);
    return;
  }
  if (input.itemPath === ".gitignore") {
    appendUniqueLine(targetPath, ".agent-harness/runs/");
    appendUniqueLine(targetPath, ".agent-harness/backups/");
    return;
  }
  if (input.itemPath === "package.json") {
    mergePackageScripts(input.templateRoot, targetPath);
    return;
  }
  const sourcePath = path.join(input.templateRoot, input.itemPath);
  if (fs.existsSync(targetPath)) return;
  fs.copyFileSync(sourcePath, targetPath);
}

function applyAgentsTemplate(templateRoot: string, targetPath: string, agentsMode: AgentsMode): void {
  const sourcePath = path.join(templateRoot, "AGENTS.md");
  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
    return;
  }
  if (agentsMode === "skip") return;
  const template = fs.readFileSync(sourcePath, "utf8").trim();
  if (agentsMode === "overwrite") {
    fs.writeFileSync(targetPath, `${template}\n`);
    return;
  }
  const current = fs.readFileSync(targetPath, "utf8");
  if (current.includes(AGENTS_SENTINEL_START)) return;
  const block = `${AGENTS_SENTINEL_START}\n${template}\n${AGENTS_SENTINEL_END}`;
  fs.writeFileSync(targetPath, `${current}${current.endsWith("\n") || current.length === 0 ? "" : "\n"}\n${block}\n`);
}

function appendUniqueLine(filePath: string, line: string): void {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (current.split(/\r?\n/).includes(line)) return;
  fs.writeFileSync(filePath, `${current}${current.endsWith("\n") || current.length === 0 ? "" : "\n"}${line}\n`);
}

function mergePackageScripts(templateRoot: string, packagePath: string): void {
  const scriptsPath = path.join(templateRoot, "package-scripts.json");
  if (!fs.existsSync(packagePath) || !fs.existsSync(scriptsPath)) return;
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
  const scripts = JSON.parse(fs.readFileSync(scriptsPath, "utf8")) as Record<string, string>;
  pkg.scripts = { ...(pkg.scripts ?? {}), ...Object.fromEntries(Object.entries(scripts).filter(([key]) => !pkg.scripts?.[key])) };
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function parseAgentsMode(value: string | undefined): AgentsMode | undefined {
  if (!value) return undefined;
  if (value === "skip" || value === "append" || value === "overwrite") return value;
  throw new Error("--agents-mode must be one of: skip, append, overwrite");
}

async function resolveAgentsMode(target: string, requested: AgentsMode | undefined): Promise<AgentsMode> {
  const agentsPath = path.join(target, "AGENTS.md");
  if (requested) return requested;
  if (!fs.existsSync(agentsPath)) return "skip";
  if (!process.stdin.isTTY || !process.stdout.isTTY) return "skip";
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question("AGENTS.md already exists. Choose harness install mode [skip/append/overwrite] (skip): ");
    return parseAgentsMode(answer.trim() || "skip") ?? "skip";
  } finally {
    rl.close();
  }
}
