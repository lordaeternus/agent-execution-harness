import { loadConfig } from "../core/config.js";
import { initMemory, queryMemory, recordMemory, statusMemory, updateMemory } from "../core/codebase-memory.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeCompactJson } from "./output.js";

export function mapCommand(args: string[], cwd = process.cwd()): void {
  const [verb, ...rest] = args;
  const flags = parseFlags(rest);
  const config = loadConfig(cwd, stringFlag(flags, "config") ?? "agent-harness.config.json");

  if (verb === "init") {
    const result = initMemory(cwd, config);
    writeCompactJson({
      status: "success",
      summary: `memory init files=${result.files} surfaces=${result.surfaces}`,
      artifacts: [{ type: "codebase_memory", path: result.memory_dir }],
      next_actions: ["map query --surface <surface>"],
      errors: [],
      data: result,
    });
    return;
  }

  if (verb === "status") {
    const result = statusMemory(cwd, config);
    writeCompactJson({
      status: "success",
      summary: `memory status surfaces=${Object.keys(result.surfaces).length} files=${result.files}`,
      artifacts: [{ type: "codebase_memory", path: result.memory_dir }],
      next_actions: ["map query --surface <surface>", "map update --files <files>"],
      errors: [],
      data: result,
    });
    return;
  }

  if (verb === "query") {
    const surface = stringFlag(flags, "surface", true)!;
    const result = queryMemory(cwd, config, surface);
    writeCompactJson({
      status: result.status === "fresh" ? "success" : "warning",
      summary: `${surface} memory ${result.status}`,
      artifacts: [{ type: "codebase_memory_surface", path: `${config.codebase_memory?.memory_dir ?? ".agent-harness/memory"}/surfaces/${surface}.json` }],
      next_actions: result.status === "fresh" ? ["read changed files before editing"] : ["read source files", "map record --surface <surface>"],
      errors: [],
      data: result,
    });
    return;
  }

  if (verb === "update") {
    const files = splitCsv(stringFlag(flags, "files", true)!);
    const result = updateMemory(cwd, config, files);
    writeCompactJson({
      status: result.missing_files.length ? "warning" : "success",
      summary: `memory update surfaces=${result.touched_surfaces.join(",") || "none"}`,
      artifacts: [{ type: "codebase_memory", path: config.codebase_memory?.memory_dir ?? ".agent-harness/memory" }],
      next_actions: ["map record --surface <surface> --files <files> --summary <summary>"],
      errors: result.missing_files.map((file) => `missing file: ${file}`),
      data: result,
    });
    return;
  }

  if (verb === "record") {
    const surface = stringFlag(flags, "surface", true)!;
    const files = splitCsv(stringFlag(flags, "files", true)!);
    const summary = stringFlag(flags, "summary", true)!;
    const sourceFiles = stringFlag(flags, "source-files") ? splitCsv(stringFlag(flags, "source-files")!) : undefined;
    const confidence = stringFlag(flags, "confidence") as "low" | "medium" | "high" | undefined;
    const checked = stringFlag(flags, "checked-by-main-agent") === "true" || flags["checked-by-main-agent"] === true;
    const subagent = stringFlag(flags, "subagent") === "true" || flags.subagent === true;
    const result = recordMemory(cwd, config, {
      surface,
      files,
      summary,
      source_files: sourceFiles,
      confidence,
      checked_by_main_agent: checked || !subagent,
      subagent,
    });
    writeCompactJson({
      status: "success",
      summary: `${surface} memory recorded`,
      artifacts: [{ type: "codebase_memory_surface", path: `${config.codebase_memory?.memory_dir ?? ".agent-harness/memory"}/surfaces/${surface}.json` }],
      next_actions: ["map query --surface <surface>"],
      errors: [],
      data: result,
    });
    return;
  }

  throw new Error("unknown map command");
}

function splitCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
