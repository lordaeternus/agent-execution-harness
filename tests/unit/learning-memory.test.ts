import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/core/config.js";
import { captureLesson, promoteLesson, pruneLessons, queryLessons, rejectLesson } from "../../src/core/learning-memory.js";

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
    });
    expect(lesson.status).toBe("candidate");
    promoteLesson(cwd, config, "auth-session-contract");
    const query = queryLessons(cwd, config, "auth", 3);
    expect(query.lessons).toHaveLength(1);
    expect(query.lessons[0].lesson_id).toBe("auth-session-contract");
    expect(query.lessons[0].status).toBe("promoted");
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
});
