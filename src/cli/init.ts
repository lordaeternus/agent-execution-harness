import fs from "node:fs";
import path from "node:path";
import { createInstallManifest } from "./install-manifest.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeJson } from "./output.js";

const TEMPLATE_FILES = ["agent-harness.config.json", "AGENTS.md"];

export function initCommand(args: string[], cwd = process.cwd()): void {
  const flags = parseFlags(args);
  const adapter = stringFlag(flags, "adapter") ?? "generic";
  const target = stringFlag(flags, "cwd") ?? cwd;
  const apply = flags.apply === true;
  const templateRoot = path.resolve(cwd, "templates", adapter);
  const existing = new Set(TEMPLATE_FILES.filter((file) => fs.existsSync(path.join(target, file))));
  const manifest = createInstallManifest(TEMPLATE_FILES, existing);
  if (apply) {
    for (const item of manifest.filter((entry) => entry.action === "create")) {
      fs.copyFileSync(path.join(templateRoot, item.path), path.join(target, item.path));
    }
  }
  writeJson({
    status: manifest.some((item) => item.action === "conflict") ? "warning" : "success",
    summary: apply ? "init applied" : "init dry-run complete",
    artifacts: manifest.map((item) => ({ type: item.action, path: item.path })),
    next_actions: apply ? ["run doctor"] : ["review manifest", "rerun with --apply"],
    errors: [],
    data: manifest,
  });
}
