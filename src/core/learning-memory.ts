import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AgentHarnessConfig } from "./config-types.js";
import {
  LEARNING_SCHEMA_VERSION,
  type AgentHarnessLesson,
  type LearningAuditResult,
  type LearningHealthResult,
  type LessonCaptureInput,
  type LessonKind,
  type LessonQueryResult,
  type LessonStatus,
  type LearningMemoryConfig,
} from "./learning-types.js";
import type { AgentHarnessRunState } from "./run-types.js";
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
    audit_cooldown_days: 7,
    audit_max_lessons: 50,
    audit_max_stale_ratio: 0.25,
    audit_max_low_confidence_ratio: 0.2,
    audit_max_duplicate_candidates: 5,
    audit_compact_max_chars: 600,
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

export function validateLessonForPromotion(cwd: string, config: AgentHarnessConfig, lessonId: string): AgentHarnessLesson {
  const memory = learningConfig(config);
  assertSafeId(lessonId, "lesson_id");
  const lesson = readLesson(cwd, memory, lessonId);
  if (!lesson) throw new Error(`lesson not found: ${lessonId}`);
  const refreshed = refreshLessonStatus(cwd, memory, lesson);
  ensureLessonPromotable(cwd, refreshed);
  refreshed.status = "validated";
  refreshed.updated_at = now();
  writeLesson(cwd, memory, refreshed);
  upsertIndex(cwd, memory, refreshed);
  appendEvent(cwd, memory, { type: "validate", lesson_id: lessonId });
  return compactLesson(refreshed, memory);
}

export function rejectLesson(cwd: string, config: AgentHarnessConfig, lessonId: string, reason: string): AgentHarnessLesson {
  return transitionLesson(cwd, config, lessonId, "rejected", reason);
}

export function retireLesson(cwd: string, config: AgentHarnessConfig, lessonId: string, reason: string): AgentHarnessLesson {
  return transitionLesson(cwd, config, lessonId, "retired", reason);
}

export function queryLessons(
  cwd: string,
  config: AgentHarnessConfig,
  surface: string,
  topK?: number,
  options: { files?: string[]; failure_signature?: string } = {},
): LessonQueryResult {
  const memory = learningConfig(config);
  const limit = Math.max(1, Math.min(topK ?? memory.top_k, memory.top_k));
  const lessons = reviewLessons(cwd, config, surface)
    .filter((lesson) => lesson.status === "promoted" || lesson.status === "validated")
    .sort((a, b) => rankLesson(b, options) - rankLesson(a, options) || byUpdatedDesc(a, b))
    .slice(0, limit)
    .map((lesson) => compactLesson(lesson, memory));
  return { surface, lessons, memory_dir: memory.memory_dir };
}

export function compactLessonForExecutor(lesson: AgentHarnessLesson): Pick<AgentHarnessLesson, "kind" | "summary" | "files" | "confidence"> {
  return {
    kind: lesson.kind,
    summary: lesson.summary,
    files: lesson.files,
    confidence: lesson.confidence,
  };
}

export function checkLearningHealth(cwd: string, config: AgentHarnessConfig): LearningHealthResult {
  const memory = learningConfig(config);
  const snapshot = buildAuditSnapshot(cwd, memory);
  const reasons: string[] = [];
  if (snapshot.counts.total > memory.audit_max_lessons) reasons.push("too_many_lessons");
  if (snapshot.ratios.stale > memory.audit_max_stale_ratio) reasons.push("too_many_stale_lessons");
  if (snapshot.ratios.low_confidence > memory.audit_max_low_confidence_ratio) reasons.push("too_many_low_confidence_lessons");
  if (snapshot.counts.duplicate_candidates > memory.audit_max_duplicate_candidates) reasons.push("too_many_duplicate_candidates");
  const learning_health = reasons.length ? "needs_audit" : "ok";
  return {
    learning_health,
    summary: learning_health === "ok" ? `learning memory ok lessons=${snapshot.counts.total}` : `learning memory needs audit reasons=${reasons.join(",")}`,
    memory_dir: memory.memory_dir,
    counts: snapshot.counts,
    ratios: snapshot.ratios,
    reasons,
    ...(learning_health === "needs_audit" ? { next_action: "learn audit --compact" } : {}),
  };
}

export function auditLearningMemory(cwd: string, config: AgentHarnessConfig): LearningAuditResult {
  const memory = learningConfig(config);
  const snapshot = buildAuditSnapshot(cwd, memory);
  const candidates = {
    stale: snapshot.stale.slice(0, 8).map((lesson) => lesson.lesson_id),
    low_confidence: snapshot.lowConfidence.slice(0, 8).map((lesson) => lesson.lesson_id),
    duplicate_groups: snapshot.duplicateGroups.slice(0, 5).map((group) => ({ lesson_ids: group.map((lesson) => lesson.lesson_id).slice(0, 5) })),
  };
  const hasCandidates = candidates.stale.length > 0 || candidates.low_confidence.length > 0 || candidates.duplicate_groups.length > 0;
  const result: LearningAuditResult = {
    learning_audit: hasCandidates ? "needs_attention" : "ok",
    summary: hasCandidates
      ? `audit found stale=${snapshot.counts.stale} low=${snapshot.counts.low_confidence} dup=${snapshot.counts.duplicate_candidates}`
      : `audit ok lessons=${snapshot.counts.total}`,
    memory_dir: memory.memory_dir,
    counts: snapshot.counts,
    candidates,
    next_actions: hasCandidates ? ["review candidates", "retire only lessons with clear evidence"] : ["continue"],
  };
  return trimAuditResult(result, memory.audit_compact_max_chars);
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

export function buildRepeatedFailureLearningHint(
  state: AgentHarnessRunState,
  input: { task_id: string; check: string; repair_kind: string; max_chars?: number },
): string | undefined {
  const task = state.tasks.find((item) => item.task_id === input.task_id);
  if (!task) return undefined;
  const failures = state.evidence.filter((evidence) => task.evidence_ids.includes(evidence.evidence_id) && evidence.result === "fail" && evidence.check === input.check);
  if (failures.length < 2) return undefined;
  const surface = task.surface ?? "generic";
  return truncate(`repeated_failure:${input.repair_kind}; learn query --surface ${surface} --top-k 3 --compact; capture only after proven fix.`, input.max_chars ?? 180);
}

function transitionLesson(cwd: string, config: AgentHarnessConfig, lessonId: string, status: LessonStatus, reason?: string): AgentHarnessLesson {
  const memory = learningConfig(config);
  assertSafeId(lessonId, "lesson_id");
  const lesson = readLesson(cwd, memory, lessonId);
  if (!lesson) throw new Error(`lesson not found: ${lessonId}`);
  const refreshed = refreshLessonStatus(cwd, memory, lesson);
  if (status === "promoted") {
    if (refreshed.status !== "validated") throw new Error("lesson must be validated before promotion");
    ensureLessonPromotable(cwd, refreshed);
  }
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

function ensureLessonPromotable(cwd: string, lesson: AgentHarnessLesson): void {
  if (["stale", "rejected", "retired"].includes(lesson.status)) throw new Error(`lesson status ${lesson.status} cannot be promoted`);
  if (!lesson.evidence_refs.length) throw new Error("lesson requires evidence_refs before validation");
  if (lesson.kind === "failure_pattern" && !lesson.failure_signature) throw new Error("failure_pattern lesson requires failure_signature before validation");
  for (const file of [...lesson.files, ...lesson.evidence_refs]) {
    assertSafeRelativePath(file, "lesson file");
    if (!fs.existsSync(path.resolve(cwd, file))) throw new Error(`lesson file missing: ${file}`);
  }
  if (containsSecret(JSON.stringify(lesson))) throw new Error("lesson contains unredacted secret");
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

function previewLessonStatus(cwd: string, lesson: AgentHarnessLesson): LessonStatus {
  if (["rejected", "retired"].includes(lesson.status)) return lesson.status;
  if (new Date(lesson.expires_at).getTime() < Date.now()) return "stale";
  if (hasChangedFile(cwd, lesson)) return "stale";
  return lesson.status;
}

function buildAuditSnapshot(cwd: string, memory: LearningMemoryConfig): {
  counts: LearningHealthResult["counts"];
  ratios: LearningHealthResult["ratios"];
  stale: AgentHarnessLesson[];
  lowConfidence: AgentHarnessLesson[];
  duplicateGroups: AgentHarnessLesson[][];
} {
  const lessons = readAllLessons(cwd, memory).filter((lesson) => !["rejected", "retired"].includes(lesson.status));
  const active = lessons.filter((lesson) => previewLessonStatus(cwd, lesson) !== "stale");
  const stale = lessons.filter((lesson) => previewLessonStatus(cwd, lesson) === "stale");
  const lowConfidence = active.filter((lesson) => lesson.confidence === "low");
  const duplicateGroups = findDuplicateGroups(active);
  const duplicateCandidates = duplicateGroups.reduce((sum, group) => sum + Math.max(0, group.length - 1), 0);
  const activeCount = active.length || 1;
  return {
    counts: {
      total: lessons.length,
      active: active.length,
      stale: stale.length,
      low_confidence: lowConfidence.length,
      duplicate_candidates: duplicateCandidates,
    },
    ratios: {
      stale: ratio(stale.length, lessons.length),
      low_confidence: ratio(lowConfidence.length, activeCount),
    },
    stale,
    lowConfidence,
    duplicateGroups,
  };
}

function findDuplicateGroups(lessons: AgentHarnessLesson[]): AgentHarnessLesson[][] {
  const groups = new Map<string, AgentHarnessLesson[]>();
  for (const lesson of lessons) {
    const key = [lesson.surface, lesson.kind, lesson.files.join(","), tokens(lesson.failure_signature ?? lesson.fix_pattern ?? lesson.summary).slice(0, 8).join("-")].join("|");
    groups.set(key, [...(groups.get(key) ?? []), lesson]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

function ratio(part: number, total: number): number {
  if (total <= 0) return 0;
  return Number((part / total).toFixed(2));
}

function trimAuditResult(result: LearningAuditResult, maxChars: number): LearningAuditResult {
  let next = result;
  while (JSON.stringify(next).length > maxChars && next.candidates.duplicate_groups.length > 0) {
    next = { ...next, candidates: { ...next.candidates, duplicate_groups: next.candidates.duplicate_groups.slice(0, -1) } };
  }
  while (JSON.stringify(next).length > maxChars && next.candidates.stale.length > 0) {
    next = { ...next, candidates: { ...next.candidates, stale: next.candidates.stale.slice(0, -1) } };
  }
  while (JSON.stringify(next).length > maxChars && next.candidates.low_confidence.length > 0) {
    next = { ...next, candidates: { ...next.candidates, low_confidence: next.candidates.low_confidence.slice(0, -1) } };
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

function rankLesson(lesson: AgentHarnessLesson, options: { files?: string[]; failure_signature?: string }): number {
  let score = 0;
  const files = normalizeFiles(options.files ?? []);
  const overlap = files.filter((file) => lesson.files.includes(file)).length;
  score += overlap * 20;
  score += signatureOverlap(options.failure_signature, `${lesson.failure_signature ?? ""} ${lesson.summary}`) * 10;
  score += lesson.confidence === "high" ? 6 : lesson.confidence === "medium" ? 3 : 1;
  score += lesson.status === "promoted" ? 4 : 2;
  score += Math.max(0, 2 - Math.floor((Date.now() - new Date(lesson.updated_at).getTime()) / (7 * 24 * 60 * 60 * 1000)));
  return score;
}

function signatureOverlap(input: string | undefined, lessonText: string): number {
  if (!input) return 0;
  const wanted = new Set(tokens(input));
  if (!wanted.size) return 0;
  return tokens(lessonText).filter((token) => wanted.has(token)).length;
}

function tokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
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

function containsSecret(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, Math.max(0, maxChars - 1));
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
