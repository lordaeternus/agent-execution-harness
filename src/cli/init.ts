import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { createInstallManifest } from "./install-manifest.js";
import { createBackup, restoreBackup } from "./install-rollback.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeJson } from "./output.js";

const TEMPLATE_FILES = ["agent-harness.config.json", "AGENTS.md", ".gitignore", "package.json"];
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AGENTS_SENTINEL_START = "<!-- agent-execution-harness:start -->";
const AGENTS_SENTINEL_END = "<!-- agent-execution-harness:end -->";
type AgentsMode = "skip" | "append" | "overwrite";

export async function initCommand(args: string[], cwd = process.cwd()): Promise<void> {
  const flags = parseFlags(args);
  const adapter = stringFlag(flags, "adapter") ?? "generic";
  const target = stringFlag(flags, "cwd") ?? cwd;
  const apply = flags.apply === true;
  const rollback = stringFlag(flags, "rollback");
  const agentsMode = parseAgentsMode(stringFlag(flags, "agents-mode"));
  if (rollback) {
    const restored = restoreBackup(target, path.resolve(target, rollback));
    writeJson({
      status: "success",
      summary: `rollback restored ${restored} entries`,
      artifacts: [{ type: "rollback", path: rollback }],
      next_actions: ["run doctor"],
      errors: [],
    });
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
  writeJson({
    status: manifest.some((item) => item.action === "conflict") ? "warning" : "success",
    summary: apply ? "init applied" : "init dry-run complete",
    artifacts: [
      ...manifest.map((item) => ({ type: item.action, path: item.path })),
      ...(apply ? [{ type: "backup", path: backupDir }] : []),
    ],
    next_actions: apply
      ? ["run doctor", `rollback with --rollback ${backupDir} if needed`]
      : ["review manifest", "rerun with --apply", "use --agents-mode append if AGENTS.md already exists"],
    errors: [],
    data: { files: manifest, agents_mode: resolvedAgentsMode },
  });
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
