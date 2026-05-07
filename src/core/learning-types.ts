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
  audit_cooldown_days: number;
  audit_max_lessons: number;
  audit_max_stale_ratio: number;
  audit_max_low_confidence_ratio: number;
  audit_max_duplicate_candidates: number;
  audit_compact_max_chars: number;
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

export interface LearningHealthResult {
  learning_health: "ok" | "needs_audit";
  summary: string;
  memory_dir: string;
  counts: {
    total: number;
    active: number;
    stale: number;
    low_confidence: number;
    duplicate_candidates: number;
  };
  ratios: {
    stale: number;
    low_confidence: number;
  };
  reasons: string[];
  next_action?: string;
}

export interface LearningAuditResult {
  learning_audit: "ok" | "needs_attention";
  summary: string;
  memory_dir: string;
  counts: LearningHealthResult["counts"];
  candidates: {
    stale: string[];
    low_confidence: string[];
    duplicate_groups: Array<{ lesson_ids: string[] }>;
  };
  next_actions: string[];
}
