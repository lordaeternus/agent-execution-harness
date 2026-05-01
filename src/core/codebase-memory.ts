import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AgentHarnessConfig, CodebaseMemoryConfig } from "./config-types.js";
import type { TaskSurface } from "./plan-types.js";
import { assertSafeRelativePath } from "./utils.js";

export const MEMORY_SCHEMA_VERSION = "agent_harness_memory_v1";

export type MemoryStatus = "fresh" | "stale" | "unknown";
export type MemoryConfidence = "low" | "medium" | "high";

export interface SurfaceMemory {
  schema_version: typeof MEMORY_SCHEMA_VERSION;
  surface: TaskSurface | string;
  status: MemoryStatus;
  summary: string;
  files: string[];
  updated_at: string;
  confidence?: MemoryConfidence;
  source_files?: string[];
  checked_by_main_agent?: boolean;
}

interface MemoryIndex {
  schema_version: typeof MEMORY_SCHEMA_VERSION;
  updated_at: string;
  surfaces: Record<string, { status: MemoryStatus; summary: string; files: string[]; updated_at: string; confidence?: MemoryConfidence }>;
}

interface FileIndex {
  schema_version: typeof MEMORY_SCHEMA_VERSION;
  updated_at: string;
  files: Record<string, { sha256: string; surfaces: string[]; updated_at: string }>;
}

const DEFAULT_IGNORE_DIRS = new Set([
  ".git",
  ".agent-harness/runs",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "build",
  "node_modules",
]);

const GENERIC_SUMMARY_PATTERNS = [
  /^updated code\.?$/i,
  /^code updated\.?$/i,
  /^changes made\.?$/i,
  /^implementation done\.?$/i,
  /^melhorias feitas\.?$/i,
  /^codigo atualizado\.?$/i,
  /^código atualizado\.?$/i,
];

export function defaultCodebaseMemoryConfig(): CodebaseMemoryConfig {
  return {
    enabled: true,
    memory_dir: ".agent-harness/memory",
    default_strategy: "query",
    stale_after_days: 14,
    max_summary_chars: 1200,
    surface_budgets: {
      auth: 1800,
      db: 1800,
      api: 1400,
      ai: 1400,
      ui: 900,
      ui_layout: 900,
      docs: 500,
      generic: 700,
      backend: 900,
    },
    high_risk_surfaces: ["auth", "db", "api", "ai"],
  };
}

export function initMemory(cwd: string, config: AgentHarnessConfig): { files: number; surfaces: number; memory_dir: string } {
  const memory = memoryConfig(config);
  const files = collectProductFiles(cwd, config.product_paths);
  const fileIndex: FileIndex = {
    schema_version: MEMORY_SCHEMA_VERSION,
    updated_at: now(),
    files: {},
  };
  const surfaces = new Map<string, string[]>();
  for (const file of files) {
    const surface = inferMemorySurface(file);
    surfaces.set(surface, [...(surfaces.get(surface) ?? []), file]);
    fileIndex.files[file] = { sha256: hashFile(path.resolve(cwd, file)), surfaces: [surface], updated_at: fileIndex.updated_at };
  }
  const index: MemoryIndex = {
    schema_version: MEMORY_SCHEMA_VERSION,
    updated_at: fileIndex.updated_at,
    surfaces: {},
  };
  for (const [surface, surfaceFiles] of surfaces) {
    const summary = `Tracked ${surfaceFiles.length} ${surface} file(s). Query source code before editing; record durable contracts after structural changes.`;
    index.surfaces[surface] = { status: "unknown", summary, files: surfaceFiles.slice(0, 30), updated_at: index.updated_at };
    writeSurface(cwd, memory, {
      schema_version: MEMORY_SCHEMA_VERSION,
      surface,
      status: "unknown",
      summary,
      files: surfaceFiles.slice(0, 200),
      updated_at: index.updated_at,
      confidence: "low",
    });
  }
  writeJson(memoryPath(cwd, memory, "index.json"), index);
  writeJson(memoryPath(cwd, memory, "file-index.json"), fileIndex);
  appendEvent(cwd, memory, { type: "init", files: files.length, surfaces: surfaces.size });
  return { files: files.length, surfaces: surfaces.size, memory_dir: memory.memory_dir };
}

export function statusMemory(cwd: string, config: AgentHarnessConfig): { memory_dir: string; surfaces: Record<string, string>; files: number } {
  const memory = memoryConfig(config);
  const index = readIndex(cwd, memory);
  const fileIndex = readFileIndex(cwd, memory);
  return {
    memory_dir: memory.memory_dir,
    surfaces: Object.fromEntries(Object.entries(index.surfaces).map(([surface, item]) => [surface, item.status])),
    files: Object.keys(fileIndex.files).length,
  };
}

export function queryMemory(cwd: string, config: AgentHarnessConfig, surface: string): SurfaceMemory {
  const memory = memoryConfig(config);
  const record = readSurface(cwd, memory, surface);
  const ageMs = Date.now() - new Date(record.updated_at).getTime();
  const staleByTime = ageMs > memory.stale_after_days * 24 * 60 * 60 * 1000;
  if (staleByTime && record.status === "fresh") {
    record.status = "stale";
    writeSurface(cwd, memory, record);
    upsertIndexSurface(cwd, memory, record);
  }
  return limitSurface(record, memory);
}

export function updateMemory(cwd: string, config: AgentHarnessConfig, files: string[]): { touched_surfaces: string[]; missing_files: string[] } {
  const memory = memoryConfig(config);
  const index = readIndex(cwd, memory);
  const fileIndex = readFileIndex(cwd, memory);
  const touched = new Set<string>();
  const missing: string[] = [];
  for (const file of normalizeFiles(files)) {
    const resolved = path.resolve(cwd, file);
    const surface = inferMemorySurface(file);
    touched.add(surface);
    if (!fs.existsSync(resolved)) {
      missing.push(file);
      continue;
    }
    const previous = fileIndex.files[file];
    const nextHash = hashFile(resolved);
    const status: MemoryStatus = previous ? (previous.sha256 === nextHash ? "fresh" : "stale") : "unknown";
    fileIndex.files[file] = { sha256: nextHash, surfaces: unique([...(previous?.surfaces ?? []), surface]), updated_at: now() };
    const current = index.surfaces[surface];
    const surfaceFiles = unique([...(current?.files ?? []), file]);
    index.surfaces[surface] = {
      status,
      summary: current?.summary ?? `Surface ${surface} discovered from ${file}. Record durable contracts before relying on cache.`,
      files: surfaceFiles,
      updated_at: now(),
      confidence: current?.confidence,
    };
    writeSurface(cwd, memory, {
      schema_version: MEMORY_SCHEMA_VERSION,
      surface,
      status,
      summary: index.surfaces[surface].summary,
      files: surfaceFiles,
      updated_at: index.surfaces[surface].updated_at,
      confidence: current?.confidence ?? "low",
    });
  }
  index.updated_at = now();
  fileIndex.updated_at = index.updated_at;
  writeJson(memoryPath(cwd, memory, "index.json"), index);
  writeJson(memoryPath(cwd, memory, "file-index.json"), fileIndex);
  appendEvent(cwd, memory, { type: "update", files: normalizeFiles(files), touched_surfaces: [...touched], missing_files: missing });
  return { touched_surfaces: [...touched].sort(), missing_files: missing };
}

export function recordMemory(
  cwd: string,
  config: AgentHarnessConfig,
  input: {
    surface: string;
    files: string[];
    summary: string;
    confidence?: MemoryConfidence;
    source_files?: string[];
    checked_by_main_agent?: boolean;
    subagent?: boolean;
  },
): SurfaceMemory {
  const memory = memoryConfig(config);
  const summary = normalizeSummary(input.summary);
  validateSummary(summary, memory, input.surface);
  if (input.subagent && (!input.source_files?.length || !input.confidence || input.checked_by_main_agent !== true)) {
    throw new Error("subagent memory requires source_files, confidence and checked_by_main_agent=true");
  }
  const files = normalizeFiles(input.files);
  const record: SurfaceMemory = {
    schema_version: MEMORY_SCHEMA_VERSION,
    surface: input.surface,
    status: "fresh",
    summary,
    files,
    updated_at: now(),
    confidence: input.confidence ?? "medium",
    source_files: input.source_files ? normalizeFiles(input.source_files) : files,
    checked_by_main_agent: input.checked_by_main_agent ?? true,
  };
  writeSurface(cwd, memory, record);
  upsertIndexSurface(cwd, memory, record);
  const fileIndex = readFileIndex(cwd, memory);
  for (const file of files) {
    const resolved = path.resolve(cwd, file);
    if (!fs.existsSync(resolved)) continue;
    const previous = fileIndex.files[file];
    fileIndex.files[file] = {
      sha256: hashFile(resolved),
      surfaces: unique([...(previous?.surfaces ?? []), input.surface]),
      updated_at: record.updated_at,
    };
  }
  fileIndex.updated_at = record.updated_at;
  writeJson(memoryPath(cwd, memory, "file-index.json"), fileIndex);
  appendEvent(cwd, memory, { type: "record", surface: input.surface, files, confidence: record.confidence });
  return limitSurface(record, memory);
}

export function inferMemorySurface(file: string): TaskSurface {
  const normalized = file.replace(/\\/g, "/");
  if (/^supabase\/migrations\//.test(normalized)) return "db";
  if (/^supabase\/functions\//.test(normalized)) return "api";
  if (/(^|\/)(auth|permissions|session|rls)(\/|\.|-)/i.test(normalized)) return "auth";
  if (/(^|\/)(ai|llm|prompt|prompts)\//i.test(normalized)) return "ai";
  if (/\.(md|mdx)$/i.test(normalized)) return "docs";
  if (/(^|\/)(src\/components|src\/pages|src\/features)|\.(tsx|jsx|css)$/i.test(normalized)) return "ui_layout";
  if (/(^|\/)(src\/hooks|src\/lib|src\/services|src\/utils)\//i.test(normalized)) return "backend";
  return "generic";
}

function memoryConfig(config: AgentHarnessConfig): CodebaseMemoryConfig {
  const memory = config.codebase_memory ?? defaultCodebaseMemoryConfig();
  if (!memory.enabled) throw new Error("codebase_memory is disabled");
  assertSafeRelativePath(memory.memory_dir, "codebase_memory.memory_dir");
  return memory;
}

function collectProductFiles(cwd: string, productPaths: string[]): string[] {
  const results: string[] = [];
  for (const productPath of productPaths) {
    assertSafeRelativePath(productPath, "product_path");
    const root = path.resolve(cwd, productPath);
    if (!fs.existsSync(root)) continue;
    walk(cwd, root, results);
  }
  return unique(results).sort();
}

function walk(cwd: string, dir: string, results: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(cwd, fullPath).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (shouldIgnore(relative)) continue;
      walk(cwd, fullPath, results);
      continue;
    }
    if (entry.isFile() && !shouldIgnore(relative)) results.push(relative);
  }
}

function shouldIgnore(relative: string): boolean {
  const normalized = relative.replace(/\\/g, "/");
  if ([...DEFAULT_IGNORE_DIRS].some((dir) => normalized === dir || normalized.startsWith(`${dir}/`))) return true;
  return /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|tgz|log)$/i.test(normalized);
}

function readIndex(cwd: string, memory: CodebaseMemoryConfig): MemoryIndex {
  const file = memoryPath(cwd, memory, "index.json");
  if (!fs.existsSync(file)) return { schema_version: MEMORY_SCHEMA_VERSION, updated_at: now(), surfaces: {} };
  return JSON.parse(fs.readFileSync(file, "utf8")) as MemoryIndex;
}

function readFileIndex(cwd: string, memory: CodebaseMemoryConfig): FileIndex {
  const file = memoryPath(cwd, memory, "file-index.json");
  if (!fs.existsSync(file)) return { schema_version: MEMORY_SCHEMA_VERSION, updated_at: now(), files: {} };
  return JSON.parse(fs.readFileSync(file, "utf8")) as FileIndex;
}

function readSurface(cwd: string, memory: CodebaseMemoryConfig, surface: string): SurfaceMemory {
  const file = surfacePath(cwd, memory, surface);
  if (!fs.existsSync(file)) {
    return {
      schema_version: MEMORY_SCHEMA_VERSION,
      surface,
      status: "unknown",
      summary: `No durable memory recorded for ${surface}. Read source files before editing.`,
      files: [],
      updated_at: now(),
      confidence: "low",
    };
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as SurfaceMemory;
}

function writeSurface(cwd: string, memory: CodebaseMemoryConfig, record: SurfaceMemory): void {
  writeJson(surfacePath(cwd, memory, String(record.surface)), record);
}

function upsertIndexSurface(cwd: string, memory: CodebaseMemoryConfig, record: SurfaceMemory): void {
  const index = readIndex(cwd, memory);
  index.surfaces[String(record.surface)] = {
    status: record.status,
    summary: record.summary,
    files: record.files,
    updated_at: record.updated_at,
    confidence: record.confidence,
  };
  index.updated_at = record.updated_at;
  writeJson(memoryPath(cwd, memory, "index.json"), index);
}

function surfacePath(cwd: string, memory: CodebaseMemoryConfig, surface: string): string {
  return memoryPath(cwd, memory, path.join("surfaces", `${safeName(surface)}.json`));
}

function memoryPath(cwd: string, memory: CodebaseMemoryConfig, child: string): string {
  return path.resolve(cwd, memory.memory_dir, child);
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function appendEvent(cwd: string, memory: CodebaseMemoryConfig, event: Record<string, unknown>): void {
  const file = memoryPath(cwd, memory, "events.ndjson");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify({ schema_version: MEMORY_SCHEMA_VERSION, at: now(), ...event })}\n`);
}

function hashFile(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function normalizeFiles(files: string[]): string[] {
  return unique(files.map((file) => file.trim().replace(/\\/g, "/")).filter(Boolean));
}

function normalizeSummary(summary: string): string {
  return summary.trim().replace(/\s+/g, " ");
}

function validateSummary(summary: string, memory: CodebaseMemoryConfig, surface: string): void {
  if (summary.length < 40) throw new Error("memory summary must be at least 40 characters");
  if (GENERIC_SUMMARY_PATTERNS.some((pattern) => pattern.test(summary))) throw new Error("memory summary is too generic");
  const max = memory.surface_budgets[surface] ?? memory.max_summary_chars;
  if (summary.length > max) throw new Error(`memory summary exceeds ${max} characters for ${surface}`);
}

function limitSurface(record: SurfaceMemory, memory: CodebaseMemoryConfig): SurfaceMemory {
  const max = memory.surface_budgets[String(record.surface)] ?? memory.max_summary_chars;
  return {
    ...record,
    summary: record.summary.length > max ? record.summary.slice(0, max) : record.summary,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function safeName(value: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) throw new Error("surface contains unsafe characters");
  return value;
}

function now(): string {
  return new Date().toISOString();
}
