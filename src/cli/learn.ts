import { loadConfig } from "../core/config.js";
import {
  captureLesson,
  promoteLesson,
  pruneLessons,
  queryLessons,
  rejectLesson,
  retireLesson,
  reviewLessons,
} from "../core/learning-memory.js";
import type { LessonConfidence, LessonKind } from "../core/learning-types.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeCompactJson } from "./output.js";

export function learnCommand(args: string[], cwd = process.cwd()): void {
  const [verb, ...rest] = args;
  const flags = parseFlags(rest);
  const config = loadConfig(cwd, stringFlag(flags, "config") ?? "agent-harness.config.json");

  if (verb === "capture") {
    const lesson = captureLesson(cwd, config, {
      lesson_id: stringFlag(flags, "lesson-id"),
      surface: stringFlag(flags, "surface", true)!,
      kind: stringFlag(flags, "kind", true)! as LessonKind,
      summary: stringFlag(flags, "summary", true)!,
      files: splitCsv(stringFlag(flags, "files", true)!),
      evidence_refs: splitCsv(stringFlag(flags, "evidence-ref") ?? stringFlag(flags, "evidence-refs", true)!),
      confidence: stringFlag(flags, "confidence") as LessonConfidence | undefined,
      failure_signature: stringFlag(flags, "failure-signature"),
      fix_pattern: stringFlag(flags, "fix-pattern"),
    });
    writeCompactJson({
      status: "success",
      summary: `lesson captured ${lesson.lesson_id}`,
      artifacts: [{ type: "learning_lesson", path: `${config.learning_memory?.memory_dir ?? ".agent-harness/learning"}/lessons/${lesson.lesson_id}.json` }],
      next_actions: ["learn promote --lesson-id <lesson_id>", "learn query --surface <surface>"],
      errors: [],
      data: lesson,
    });
    return;
  }

  if (verb === "review") {
    const surface = stringFlag(flags, "surface");
    const lessons = reviewLessons(cwd, config, surface);
    writeCompactJson({
      status: "success",
      summary: `learning review lessons=${lessons.length}${surface ? ` surface=${surface}` : ""}`,
      artifacts: [{ type: "learning_memory", path: config.learning_memory?.memory_dir ?? ".agent-harness/learning" }],
      next_actions: ["learn promote --lesson-id <lesson_id>", "learn reject --lesson-id <lesson_id> --reason <reason>"],
      errors: [],
      data: { lessons },
    });
    return;
  }

  if (verb === "promote") {
    const lesson = promoteLesson(cwd, config, stringFlag(flags, "lesson-id", true)!);
    writeCompactJson({
      status: "success",
      summary: `lesson promoted ${lesson.lesson_id}`,
      artifacts: [{ type: "learning_lesson", path: `${config.learning_memory?.memory_dir ?? ".agent-harness/learning"}/lessons/${lesson.lesson_id}.json` }],
      next_actions: ["learn query --surface <surface>"],
      errors: [],
      data: lesson,
    });
    return;
  }

  if (verb === "reject") {
    const lesson = rejectLesson(cwd, config, stringFlag(flags, "lesson-id", true)!, stringFlag(flags, "reason", true)!);
    writeCompactJson({
      status: "success",
      summary: `lesson rejected ${lesson.lesson_id}`,
      artifacts: [{ type: "learning_lesson", path: `${config.learning_memory?.memory_dir ?? ".agent-harness/learning"}/lessons/${lesson.lesson_id}.json` }],
      next_actions: ["learn review"],
      errors: [],
      data: lesson,
    });
    return;
  }

  if (verb === "retire") {
    const lesson = retireLesson(cwd, config, stringFlag(flags, "lesson-id", true)!, stringFlag(flags, "reason", true)!);
    writeCompactJson({
      status: "success",
      summary: `lesson retired ${lesson.lesson_id}`,
      artifacts: [{ type: "learning_lesson", path: `${config.learning_memory?.memory_dir ?? ".agent-harness/learning"}/lessons/${lesson.lesson_id}.json` }],
      next_actions: ["learn review"],
      errors: [],
      data: lesson,
    });
    return;
  }

  if (verb === "query") {
    const surface = stringFlag(flags, "surface", true)!;
    const topK = stringFlag(flags, "top-k") ? Number(stringFlag(flags, "top-k")) : undefined;
    const result = queryLessons(cwd, config, surface, topK);
    writeCompactJson({
      status: "success",
      summary: `learning query surface=${surface} lessons=${result.lessons.length}`,
      artifacts: [{ type: "learning_memory", path: result.memory_dir }],
      next_actions: result.lessons.length ? ["read source files before editing"] : ["read source files", "learn capture after durable discovery"],
      errors: [],
      data: result,
    });
    return;
  }

  if (verb === "prune") {
    const result = pruneLessons(cwd, config);
    writeCompactJson({
      status: "success",
      summary: `learning prune retired=${result.retired.length} removed=${result.removed.length}`,
      artifacts: [{ type: "learning_memory", path: config.learning_memory?.memory_dir ?? ".agent-harness/learning" }],
      next_actions: ["learn review"],
      errors: [],
      data: result,
    });
    return;
  }

  throw new Error("unknown learn command");
}

function splitCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
