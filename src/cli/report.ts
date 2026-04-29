import { loadConfig } from "../core/config.js";
import { loadRun } from "../core/artifact-store.js";
import { buildReport, type ReportFormat } from "../core/report.js";
import { parseFlags, stringFlag } from "./args.js";

export function reportCommand(args: string[], cwd = process.cwd()): void {
  const flags = parseFlags(args);
  const runId = stringFlag(flags, "run-id", true)!;
  const config = loadConfig(cwd, stringFlag(flags, "config") ?? "agent-harness.config.json");
  const artifactDir = stringFlag(flags, "artifact-dir") ?? config.artifact_dir;
  const format = (stringFlag(flags, "format") ?? "full") as ReportFormat;
  const state = loadRun(cwd, artifactDir, runId);
  if (!state) throw new Error(`run not found: ${runId}`);
  process.stdout.write(buildReport(state, format, config.token_budget.report_compact_max_chars));
}
