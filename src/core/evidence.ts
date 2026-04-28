import type { Evidence } from "./run-types.js";
import { assertNonEmptyString } from "./utils.js";

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
  return evidence as Evidence;
}
