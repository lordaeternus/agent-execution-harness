export const LEARNING_SCHEMA_VERSION = "agent_harness_lesson_v1";

export type LessonStatus = "candidate" | "validated" | "promoted" | "stale" | "rejected" | "retired";
export type LessonKind = "failure_pattern" | "fix_pattern" | "architecture_fact" | "verification_rule" | "rollback_note";
export type LessonConfidence = "low" | "medium" | "high";

export interface LearningMemoryConfig {
  enabled: boolean;
  memory_dir: string;
  top_k: number;
  ttl_days: number;
  max_summary_chars: number;
  max_lessons_per_surface: number;
}

export interface AgentHarnessLesson {
  schema_version: typeof LEARNING_SCHEMA_VERSION;
  lesson_id: string;
  surface: string;
  kind: LessonKind;
  summary: string;
  files: string[];
  evidence_refs: string[];
  status: LessonStatus;
  confidence: LessonConfidence;
  created_at: string;
  updated_at: string;
  expires_at: string;
  failure_signature?: string;
  fix_pattern?: string;
  file_hashes?: Record<string, string>;
  reason?: string;
}

export interface LessonCaptureInput {
  lesson_id?: string;
  surface: string;
  kind: LessonKind;
  summary: string;
  files: string[];
  evidence_refs: string[];
  confidence?: LessonConfidence;
  failure_signature?: string;
  fix_pattern?: string;
}

export interface LessonQueryResult {
  surface: string;
  lessons: AgentHarnessLesson[];
  memory_dir: string;
}
