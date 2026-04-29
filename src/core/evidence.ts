import type { Evidence } from "./run-types.js";
import { assertNonEmptyString, assertSafeRelativePath } from "./utils.js";

export function normalizeEvidence(input: unknown): Evidence {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("evidence must be an object");
  const evidence = input as Partial<Evidence>;
  assertNonEmptyString(evidence.evidence_id, "evidence.evidence_id");
  assertNonEmptyString(evidence.check, "evidence.check");
  assertNonEmptyString(evidence.result, "evidence.result");
  assertNonEmptyString(evidence.output_excerpt, "evidence.output_excerpt");
  assertNonEmptyString(evidence.scope_covered, "evidence.scope_covered");
  if (!["pass", "fail", "halt"].includes(evidence.result)) throw new Error("evidence.result is invalid");
  if (typeof evidence.exit_code !== "number") throw new Error("evidence.exit_code must be a number");
  if (evidence.evidence_type !== undefined) assertNonEmptyString(evidence.evidence_type, "evidence.evidence_type");
  if (evidence.evidence_types !== undefined) {
    if (!Array.isArray(evidence.evidence_types) || evidence.evidence_types.some((item) => typeof item !== "string" || item.trim().length === 0)) {
      throw new Error("evidence.evidence_types must be a non-empty string array");
    }
  }
  if (evidence.output_ref !== undefined) {
    assertSafeRelativePath(evidence.output_ref, "evidence.output_ref");
    assertNonEmptyString(evidence.sha256, "evidence.sha256");
    if (!/^[a-f0-9]{64}$/i.test(evidence.sha256)) throw new Error("evidence.sha256 must be a sha256 hex digest");
  }
  return evidence as Evidence;
}
