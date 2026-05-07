import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/core/config.js";
import {
  auditLearningMemory,
  captureLesson,
  checkLearningHealth,
  compactLessonForExecutor,
  promoteLesson,
  pruneLessons,
  queryLessons,
  rejectLesson,
  validateLessonForPromotion,
} from "../../src/core/learning-memory.js";

function tempProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-learning-"));
  fs.mkdirSync(path.join(tmp, "src/auth"), { recursive: true });
  fs.mkdirSync(path.join(tmp, ".agent-harness/runs"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src/auth/session.ts"), "export const session = true;\n");
  fs.writeFileSync(path.join(tmp, ".agent-harness/runs/auth.full.json"), "{}\n");
  return tmp;
}

describe("learning memory", () => {
  it("captures, promotes and queries compact lessons by surface", () => {
    const cwd = tempProject();
    const config = defaultConfig();
    const lesson = captureLesson(cwd, config, {
      lesson_id: "auth-session-contract",
      surface: "auth",
      kind: "failure_pattern",
      summary: "Auth session edits must verify authorization guards because session state can pass while resource access fails.",
      files: ["src/auth/session.ts"],
      evidence_refs: [".agent-harness/runs/auth.full.json"],
      confidence: "high",
      failure_signature: "authorization guard failed after session edit",
    });
    expect(lesson.status).toBe("candidate");
    validateLessonForPromotion(cwd, config, "auth-session-contract");
    promoteLesson(cwd, config, "auth-session-contract");
    const query = queryLessons(cwd, config, "auth", 3);
    expect(query.lessons).toHaveLength(1);
    expect(query.lessons[0].lesson_id).toBe("auth-session-contract");
    expect(query.lessons[0].status).toBe("promoted");
    const compact = compactLessonForExecutor(query.lessons[0]);
    expect(compact).toEqual({
      kind: "failure_pattern",
      summary: "Auth session edits must verify authorization guards because session state can pass while resource access fails.",
      files: ["src/auth/session.ts"],
      confidence: "high",
    });
    expect(compact).not.toHaveProperty("file_hashes");
    expect(compact).not.toHaveProperty("schema_version");
    expect(compact).not.toHaveProperty("evidence_refs");
    expect(compact).not.toHaveProperty("created_at");
  });

  it("validates lessons before promotion and blocks unsafe candidates", () => {
    const cwd = tempProject();
    const config = defaultConfig();
    captureLesson(cwd, config, {
      lesson_id: "auth-validation-required",
      surface: "auth",
      kind: "failure_pattern",
      summary: "Auth validation requires evidence, existing files, and a failure signature before promotion.",
      files: ["src/auth/session.ts"],
      evidence_refs: [".agent-harness/runs/auth.full.json"],
      failure_signature: "TS2322 in auth session guard",
    });
    expect(() => promoteLesson(cwd, config, "auth-validation-required")).toThrow("validated");
    const validated = validateLessonForPromotion(cwd, config, "auth-validation-required");
    expect(validated.status).toBe("validated");
    expect(promoteLesson(cwd, config, "auth-validation-required").status).toBe("promoted");

    captureLesson(cwd, config, {
      lesson_id: "auth-missing-signature",
      surface: "auth",
      kind: "failure_pattern",
      summary: "Auth failure pattern without a signature must not become reusable memory for future agents.",
      files: ["src/auth/session.ts"],
      evidence_refs: [".agent-harness/runs/auth.full.json"],
    });
    expect(() => validateLessonForPromotion(cwd, config, "auth-missing-signature")).toThrow("failure_signature");

    captureLesson(cwd, config, {
      lesson_id: "auth-missing-file",
      surface: "auth",
      kind: "verification_rule",
      summary: "Auth verification rule must not validate when a referenced implementation file is missing.",
      files: ["src/auth/missing.ts"],
      evidence_refs: [".agent-harness/runs/auth.full.json"],
    });
    expect(() => validateLessonForPromotion(cwd, config, "auth-missing-file")).toThrow("missing");
  });

  it("ranks queried lessons by file overlap, failure signature, confidence and recency", () => {
    const cwd = tempProject();
    const config = defaultConfig();
    fs.writeFileSync(path.join(cwd, "src/auth/guard.ts"), "export const guard = true;\n");
    fs.writeFileSync(path.join(cwd, "src/auth/other.ts"), "export const other = true;\n");
    for (const input of [
      {
        lesson_id: "auth-generic-older",
        files: ["src/auth/other.ts"],
        confidence: "low" as const,
        failure_signature: "generic failure",
        summary: "Auth generic lesson should rank lower because files and signature do not match the query.",
      },
      {
        lesson_id: "auth-targeted-newer",
        files: ["src/auth/session.ts", "src/auth/guard.ts"],
        confidence: "high" as const,
        failure_signature: "TS2322 authorization guard failed",
        summary: "Auth targeted lesson should rank first because file overlap and failure signature match.",
      },
    ]) {
      captureLesson(cwd, config, {
        surface: "auth",
        kind: "failure_pattern",
        evidence_refs: [".agent-harness/runs/auth.full.json"],
        ...input,
      });
      validateLessonForPromotion(cwd, config, input.lesson_id);
      promoteLesson(cwd, config, input.lesson_id);
    }
    const query = queryLessons(cwd, config, "auth", 3, { files: ["src/auth/session.ts"], failure_signature: "TS2322 guard" });
    expect(query.lessons[0].lesson_id).toBe("auth-targeted-newer");
  });

  it("marks promoted lessons stale when tracked files change", () => {
    const cwd = tempProject();
    const config = defaultConfig();
    captureLesson(cwd, config, {
      lesson_id: "auth-stale-check",
      surface: "auth",
      kind: "verification_rule",
      summary: "Auth verification lessons must become stale when their source file changes after promotion.",
      files: ["src/auth/session.ts"],
      evidence_refs: [".agent-harness/runs/auth.full.json"],
    });
    validateLessonForPromotion(cwd, config, "auth-stale-check");
    promoteLesson(cwd, config, "auth-stale-check");
    fs.writeFileSync(path.join(cwd, "src/auth/session.ts"), "export const session = 'changed';\n");
    expect(queryLessons(cwd, config, "auth", 3).lessons).toHaveLength(0);
    const stored = JSON.parse(fs.readFileSync(path.join(cwd, ".agent-harness/learning/lessons/auth-stale-check.json"), "utf8"));
    expect(stored.status).toBe("stale");
  });

  it("rejects generic summaries and redacts secrets before writing", () => {
    const cwd = tempProject();
    const config = defaultConfig();
    const npmToken = `npm_${"Zsvz2FvQuIC73Z5IrILM3I4h76e3DE40BA9Q"}`;
    const openAiToken = `sk-${"abcdefghijklmnopqrstuvwxyz123456"}`;
    expect(() =>
      captureLesson(cwd, config, {
        surface: "auth",
        kind: "failure_pattern",
        summary: "fixed bug",
        files: ["src/auth/session.ts"],
        evidence_refs: [".agent-harness/runs/auth.full.json"],
      }),
    ).toThrow("too generic");
    captureLesson(cwd, config, {
      lesson_id: "auth-secret-redaction",
      surface: "auth",
      kind: "failure_pattern",
      summary: `Auth failure included token ${npmToken} and must store only a redacted lesson.`,
      files: ["src/auth/session.ts"],
      evidence_refs: [".agent-harness/runs/auth.full.json"],
      failure_signature: `token ${openAiToken} leaked in log`,
    });
    const stored = fs.readFileSync(path.join(cwd, ".agent-harness/learning/lessons/auth-secret-redaction.json"), "utf8");
    expect(stored).not.toContain(npmToken);
    expect(stored).not.toContain(openAiToken);
    expect(stored).toContain("[REDACTED]");
  });

  it("prunes expired and overflow lessons", () => {
    const cwd = tempProject();
    const config = {
      ...defaultConfig(),
      learning_memory: { ...defaultConfig().learning_memory!, ttl_days: 1, max_lessons_per_surface: 1 },
    };
    captureLesson(cwd, config, {
      lesson_id: "auth-first",
      surface: "auth",
      kind: "fix_pattern",
      summary: "First auth lesson explains that fixes must preserve session guard contracts during edits.",
      files: ["src/auth/session.ts"],
      evidence_refs: [".agent-harness/runs/auth.full.json"],
    });
    captureLesson(cwd, config, {
      lesson_id: "auth-second",
      surface: "auth",
      kind: "fix_pattern",
      summary: "Second auth lesson explains that newer lessons should win when surface capacity is exceeded.",
      files: ["src/auth/session.ts"],
      evidence_refs: [".agent-harness/runs/auth.full.json"],
    });
    const result = pruneLessons(cwd, config);
    expect(result.removed).toHaveLength(1);
  });

  it("can reject a candidate lesson with a reason", () => {
    const cwd = tempProject();
    const config = defaultConfig();
    captureLesson(cwd, config, {
      lesson_id: "auth-reject",
      surface: "auth",
      kind: "architecture_fact",
      summary: "Auth architecture candidate can be rejected when evidence does not support the future decision.",
      files: ["src/auth/session.ts"],
      evidence_refs: [".agent-harness/runs/auth.full.json"],
    });
    const rejected = rejectLesson(cwd, config, "auth-reject", "evidence did not support the lesson");
    expect(rejected.status).toBe("rejected");
    expect(rejected.reason).toContain("evidence");
  });

  it("reports healthy learning memory without mutating lessons", () => {
    const cwd = tempProject();
    const config = defaultConfig();
    captureLesson(cwd, config, {
      lesson_id: "auth-healthy",
      surface: "auth",
      kind: "verification_rule",
      summary: "Auth healthy lesson keeps compact reusable verification context without requiring memory cleanup.",
      files: ["src/auth/session.ts"],
      evidence_refs: [".agent-harness/runs/auth.full.json"],
      confidence: "high",
    });
    const before = fs.readFileSync(path.join(cwd, ".agent-harness/learning/lessons/auth-healthy.json"), "utf8");
    const health = checkLearningHealth(cwd, config);
    const audit = auditLearningMemory(cwd, config);
    const after = fs.readFileSync(path.join(cwd, ".agent-harness/learning/lessons/auth-healthy.json"), "utf8");
    expect(health.learning_health).toBe("ok");
    expect(audit.learning_audit).toBe("ok");
    expect(before).toBe(after);
  });

  it("flags stale, duplicate and low-confidence lessons for compact audit without mutating files", () => {
    const cwd = tempProject();
    const config = {
      ...defaultConfig(),
      learning_memory: {
        ...defaultConfig().learning_memory!,
        audit_max_lessons: 2,
        audit_max_stale_ratio: 0.1,
        audit_max_low_confidence_ratio: 0.1,
        audit_max_duplicate_candidates: 0,
        audit_compact_max_chars: 600,
      },
    };
    fs.writeFileSync(path.join(cwd, "src/auth/guard.ts"), "export const guard = true;\n");
    const shared = {
      surface: "auth",
      kind: "failure_pattern" as const,
      files: ["src/auth/session.ts"],
      evidence_refs: [".agent-harness/runs/auth.full.json"],
      failure_signature: "authorization guard failed after session edit",
    };
    for (const lesson of [
      {
        lesson_id: "auth-duplicate-a",
        summary: "Auth duplicate lesson A says guard verification must run after session state edits.",
        confidence: "high" as const,
      },
      {
        lesson_id: "auth-duplicate-b",
        summary: "Auth duplicate lesson B says guard verification must run after session state edits.",
        confidence: "high" as const,
      },
      {
        lesson_id: "auth-low-confidence",
        summary: "Auth low confidence lesson should be audited when weak signals accumulate.",
        confidence: "low" as const,
      },
    ]) {
      captureLesson(cwd, config, { ...shared, ...lesson });
    }
    const stalePath = path.join(cwd, ".agent-harness/learning/lessons/auth-duplicate-a.json");
    const before = fs.readFileSync(stalePath, "utf8");
    fs.writeFileSync(path.join(cwd, "src/auth/session.ts"), "export const session = 'changed';\n");

    const health = checkLearningHealth(cwd, config);
    const audit = auditLearningMemory(cwd, config);
    const after = fs.readFileSync(stalePath, "utf8");

    expect(health.learning_health).toBe("needs_audit");
    expect(health.reasons).toEqual(expect.arrayContaining(["too_many_lessons", "too_many_stale_lessons"]));
    expect(health.next_action).toBe("learn audit --compact");
    expect(audit.learning_audit).toBe("needs_attention");
    expect(audit.candidates.stale).toContain("auth-duplicate-a");
    expect(JSON.stringify(audit).length).toBeLessThanOrEqual(600);
    expect(before).toBe(after);
  });
});
