import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AgentHarnessConfig } from "./config-types.js";
import {
  LEARNING_SCHEMA_VERSION,
  type AgentHarnessLesson,
  type LessonCaptureInput,
  type LessonKind,
  type LessonQueryResult,
  type LessonStatus,
  type LearningMemoryConfig,
} from "./learning-types.js";
import { assertSafeId, assertSafeRelativePath } from "./utils.js";

interface LessonIndex {
  schema_version: typeof LEARNING_SCHEMA_VERSION;
  updated_at: string;
  lessons: Record<string, { surface: string; status: LessonStatus; updated_at: string; expires_at: string }>;
}

const GENERIC_SUMMARY_PATTERNS = [
  /^fixed bug\.?$/i,
  /^bug fixed\.?$/i,
  /^updated code\.?$/i,
  /^changes made\.?$/i,
  /^tests passed\.?$/i,
  /^corrigido\.?$/i,
  /^ajustes feitos\.?$/i,
];

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{20,}/g,
  /ghp_[A-Za-z0-9_]{20,}/g,
  /npm_[A-Za-z0-9_-]{20,}/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /service_role[A-Za-z0-9._-]{10,}/gi,
];

export function defaultLearningMemoryConfig(): LearningMemoryConfig {
  return {
    enabled: true,
    memory_dir: ".agent-harness/learning",
    top_k: 3,
    ttl_days: 60,
    max_summary_chars: 500,
    max_lessons_per_surface: 20,
  };
}

export function captureLesson(cwd: string, config: AgentHarnessConfig, input: LessonCaptureInput): AgentHarnessLesson {
  const memory = learningConfig(config);
  const summary = normalizeAndRedact(input.summary);
  validateSummary(summary, memory);
  const lesson: AgentHarnessLesson = {
    schema_version: LEARNING_SCHEMA_VERSION,
    lesson_id: input.lesson_id ?? buildLessonId(input.surface, input.kind),
    surface: input.surface,
    kind: input.kind,
    summary,
    files: normalizeFiles(input.files),
    evidence_refs: normalizeFiles(input.evidence_refs),
    status: "candidate",
    confidence: input.confidence ?? "medium",
    created_at: now(),
    updated_at: now(),
    expires_at: expiresAt(memory.ttl_days),
    failure_signature: input.failure_signature ? normalizeAndRedact(input.failure_signature) : undefined,
    fix_pattern: input.fix_pattern ? normalizeAndRedact(input.fix_pattern) : undefined,
  };
  assertSafeId(lesson.lesson_id, "lesson_id");
  validateLesson(lesson);
  lesson.file_hashes = hashExistingFiles(cwd, lesson.files);
  writeLesson(cwd, memory, lesson);
  upsertIndex(cwd, memory, lesson);
  appendEvent(cwd, memory, { type: "capture", lesson_id: lesson.lesson_id, surface: lesson.surface });
  return lesson;
}

export function reviewLessons(cwd: string, config: AgentHarnessConfig, surface?: string): AgentHarnessLesson[] {
  const memory = learningConfig(config);
  return readAllLessons(cwd, memory)
    .filter((lesson) => !surface || lesson.surface === surface)
    .map((lesson) => refreshLessonStatus(cwd, memory, lesson))
    .sort(byUpdatedDesc);
}

export function promoteLesson(cwd: string, config: AgentHarnessConfig, lessonId: string): AgentHarnessLesson {
  return transitionLesson(cwd, config, lessonId, "promoted");
}

export function rejectLesson(cwd: string, config: AgentHarnessConfig, lessonId: string, reason: string): AgentHarnessLesson {
  return transitionLesson(cwd, config, lessonId, "rejected", reason);
}

export function retireLesson(cwd: string, config: AgentHarnessConfig, lessonId: string, reason: string): AgentHarnessLesson {
  return transitionLesson(cwd, config, lessonId, "retired", reason);
}

export function queryLessons(cwd: string, config: AgentHarnessConfig, surface: string, topK?: number): LessonQueryResult {
  const memory = learningConfig(config);
  const limit = Math.max(1, Math.min(topK ?? memory.top_k, memory.top_k));
  const lessons = reviewLessons(cwd, config, surface)
    .filter((lesson) => lesson.status === "promoted" || lesson.status === "validated")
    .slice(0, limit)
    .map((lesson) => compactLesson(lesson, memory));
  return { surface, lessons, memory_dir: memory.memory_dir };
}

export function pruneLessons(cwd: string, config: AgentHarnessConfig): { retired: string[]; removed: string[] } {
  const memory = learningConfig(config);
  const lessons = readAllLessons(cwd, memory).map((lesson) => refreshLessonStatus(cwd, memory, lesson));
  const retired: string[] = [];
  const removed: string[] = [];
  const bySurface = new Map<string, AgentHarnessLesson[]>();
  for (const lesson of lessons) {
    if (new Date(lesson.expires_at).getTime() < Date.now() && ["candidate", "validated", "promoted"].includes(lesson.status)) {
      lesson.status = "retired";
      lesson.reason = "expired";
      lesson.updated_at = now();
      retired.push(lesson.lesson_id);
      writeLesson(cwd, memory, lesson);
      upsertIndex(cwd, memory, lesson);
    }
    bySurface.set(lesson.surface, [...(bySurface.get(lesson.surface) ?? []), lesson]);
  }
  for (const surfaceLessons of bySurface.values()) {
    const sorted = surfaceLessons.sort(byUpdatedDesc);
    for (const lesson of sorted.slice(memory.max_lessons_per_surface)) {
      fs.rmSync(lessonPath(cwd, memory, lesson.lesson_id), { force: true });
      removed.push(lesson.lesson_id);
    }
  }
  rebuildIndex(cwd, memory);
  appendEvent(cwd, memory, { type: "prune", retired, removed });
  return { retired, removed };
}

function transitionLesson(cwd: string, config: AgentHarnessConfig, lessonId: string, status: LessonStatus, reason?: string): AgentHarnessLesson {
  const memory = learningConfig(config);
  assertSafeId(lessonId, "lesson_id");
  const lesson = readLesson(cwd, memory, lessonId);
  if (!lesson) throw new Error(`lesson not found: ${lessonId}`);
  const refreshed = refreshLessonStatus(cwd, memory, lesson);
  if (status === "promoted" && refreshed.status === "stale") throw new Error("stale lesson cannot be promoted");
  if (status === "promoted" && refreshed.evidence_refs.length === 0) throw new Error("lesson requires evidence_refs before promotion");
  refreshed.status = status === "promoted" ? "promoted" : status;
  refreshed.reason = reason ? normalizeAndRedact(reason) : refreshed.reason;
  refreshed.updated_at = now();
  writeLesson(cwd, memory, refreshed);
  upsertIndex(cwd, memory, refreshed);
  appendEvent(cwd, memory, { type: status, lesson_id: lessonId, reason: refreshed.reason });
  return compactLesson(refreshed, memory);
}

function validateLesson(lesson: AgentHarnessLesson): void {
  if (!lesson.files.length) throw new Error("lesson files are required");
  if (!lesson.evidence_refs.length) throw new Error("lesson evidence_refs are required");
  for (const file of [...lesson.files, ...lesson.evidence_refs]) assertSafeRelativePath(file, "lesson file");
}

function learningConfig(config: AgentHarnessConfig): LearningMemoryConfig {
  const memory = config.learning_memory ?? defaultLearningMemoryConfig();
  if (!memory.enabled) throw new Error("learning_memory is disabled");
  assertSafeRelativePath(memory.memory_dir, "learning_memory.memory_dir");
  return memory;
}

function validateSummary(summary: string, memory: LearningMemoryConfig): void {
  if (GENERIC_SUMMARY_PATTERNS.some((pattern) => pattern.test(summary))) throw new Error("lesson summary is too generic");
  if (summary.length < 40) throw new Error("lesson summary must be at least 40 characters");
  if (summary.length > memory.max_summary_chars) throw new Error(`lesson summary exceeds ${memory.max_summary_chars} characters`);
}

function refreshLessonStatus(cwd: string, memory: LearningMemoryConfig, lesson: AgentHarnessLesson): AgentHarnessLesson {
  const next = { ...lesson };
  if (["rejected", "retired"].includes(next.status)) return next;
  if (new Date(next.expires_at).getTime() < Date.now()) next.status = "stale";
  if (hasChangedFile(cwd, next)) next.status = "stale";
  if (next.status !== lesson.status) {
    next.updated_at = now();
    writeLesson(cwd, memory, next);
    upsertIndex(cwd, memory, next);
  }
  return next;
}

function hasChangedFile(cwd: string, lesson: AgentHarnessLesson): boolean {
  for (const file of lesson.files) {
    const resolved = path.resolve(cwd, file);
    if (!fs.existsSync(resolved)) continue;
    const previous = lesson.file_hashes?.[file];
    if (previous && previous !== hashFile(resolved)) return true;
  }
  return false;
}

function compactLesson(lesson: AgentHarnessLesson, memory: LearningMemoryConfig): AgentHarnessLesson {
  return {
    ...lesson,
    summary: lesson.summary.length > memory.max_summary_chars ? lesson.summary.slice(0, memory.max_summary_chars) : lesson.summary,
  };
}

function readAllLessons(cwd: string, memory: LearningMemoryConfig): AgentHarnessLesson[] {
  const dir = lessonsDir(cwd, memory);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as AgentHarnessLesson);
}

function readLesson(cwd: string, memory: LearningMemoryConfig, lessonId: string): AgentHarnessLesson | null {
  const file = lessonPath(cwd, memory, lessonId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as AgentHarnessLesson;
}

function writeLesson(cwd: string, memory: LearningMemoryConfig, lesson: AgentHarnessLesson): void {
  fs.mkdirSync(lessonsDir(cwd, memory), { recursive: true });
  fs.writeFileSync(lessonPath(cwd, memory, lesson.lesson_id), `${JSON.stringify(lesson, null, 2)}\n`);
}

function upsertIndex(cwd: string, memory: LearningMemoryConfig, lesson: AgentHarnessLesson): void {
  const index = readIndex(cwd, memory);
  index.lessons[lesson.lesson_id] = { surface: lesson.surface, status: lesson.status, updated_at: lesson.updated_at, expires_at: lesson.expires_at };
  index.updated_at = now();
  writeJson(path.resolve(cwd, memory.memory_dir, "index.json"), index);
}

function rebuildIndex(cwd: string, memory: LearningMemoryConfig): void {
  const index: LessonIndex = { schema_version: LEARNING_SCHEMA_VERSION, updated_at: now(), lessons: {} };
  for (const lesson of readAllLessons(cwd, memory)) {
    index.lessons[lesson.lesson_id] = { surface: lesson.surface, status: lesson.status, updated_at: lesson.updated_at, expires_at: lesson.expires_at };
  }
  writeJson(path.resolve(cwd, memory.memory_dir, "index.json"), index);
}

function readIndex(cwd: string, memory: LearningMemoryConfig): LessonIndex {
  const file = path.resolve(cwd, memory.memory_dir, "index.json");
  if (!fs.existsSync(file)) return { schema_version: LEARNING_SCHEMA_VERSION, updated_at: now(), lessons: {} };
  return JSON.parse(fs.readFileSync(file, "utf8")) as LessonIndex;
}

function appendEvent(cwd: string, memory: LearningMemoryConfig, event: Record<string, unknown>): void {
  const file = path.resolve(cwd, memory.memory_dir, "events.ndjson");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify({ schema_version: LEARNING_SCHEMA_VERSION, at: now(), ...event })}\n`);
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function lessonsDir(cwd: string, memory: LearningMemoryConfig): string {
  return path.resolve(cwd, memory.memory_dir, "lessons");
}

function lessonPath(cwd: string, memory: LearningMemoryConfig, lessonId: string): string {
  assertSafeId(lessonId, "lesson_id");
  return path.resolve(lessonsDir(cwd, memory), `${lessonId}.json`);
}

function buildLessonId(surface: string, kind: LessonKind): string {
  return `${safeSlug(surface)}-${safeSlug(kind)}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now()}`;
}

function safeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "lesson";
}

function hashExistingFiles(cwd: string, files: string[]): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const file of files) {
    const resolved = path.resolve(cwd, file);
    if (fs.existsSync(resolved)) hashes[file] = hashFile(resolved);
  }
  return hashes;
}

function hashFile(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function normalizeFiles(files: string[]): string[] {
  return [...new Set(files.map((file) => file.trim().replace(/\\/g, "/")).filter(Boolean))].sort();
}

function normalizeAndRedact(value: string): string {
  let output = value.trim().replace(/\s+/g, " ");
  for (const pattern of SECRET_PATTERNS) output = output.replace(pattern, "[REDACTED]");
  return output;
}

function expiresAt(ttlDays: number): string {
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
}

function byUpdatedDesc(a: AgentHarnessLesson, b: AgentHarnessLesson): number {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

function now(): string {
  return new Date().toISOString();
}
