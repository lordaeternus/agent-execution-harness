import type { AgentHarnessRunState } from "./run-types.js";

export type ReportFormat = "compact" | "full" | "json";

export function buildReport(state: AgentHarnessRunState, format: ReportFormat = "full", maxChars = 1600): string {
  if (!["completed", "partial_validated"].includes(state.status)) throw new Error("report requires completed or partial_validated run");
  if (!state.verified_claims.length) throw new Error("report requires verified claims");
  if (format === "json") return `${JSON.stringify(buildReportObject(state), null, 2)}\n`;
  if (format === "compact") return trimReport(buildCompactReport(state), maxChars);
  return [
    "# Agent Harness Final Report",
    "",
    `- run_id: ${state.run_id}`,
    `- status: ${state.status}`,
    `- phase: ${state.phase}`,
    `- mode: ${state.mode}`,
    "",
    "## Tasks",
    ...state.tasks.map((task) => `- ${task.task_id}: ${task.status} (${task.evidence_ids.join(", ") || "no evidence"})`),
    "",
    "## Evidence",
    ...state.evidence.map((evidence) => `- ${evidence.evidence_id}: ${evidence.result} exit=${evidence.exit_code} check=${evidence.check}`),
    "",
    "## Verified Claims",
    ...state.verified_claims.map((claim) => `- ${claim.claim_id}: ${claim.kind} -> ${claim.value}`),
    "",
    "## Evidence Policy",
    `- status: ${state.evidence_policy?.status ?? "not_evaluated"}`,
    `- score: ${state.evidence_policy?.score ?? "n/a"}`,
    `- required: ${state.evidence_policy?.required.join(", ") || "none"}`,
    `- satisfied: ${state.evidence_policy?.satisfied.join(", ") || "none"}`,
    `- missing: ${state.evidence_policy?.missing.join(", ") || "none"}`,
    "",
    "## Result",
    `- ${state.status}: ${state.final_report?.summary ?? "no summary"}`,
    "",
  ].join("\n");
}

export function buildReportObject(state: AgentHarnessRunState): Record<string, unknown> {
  return {
    run_id: state.run_id,
    status: state.status,
    artifact_status: state.phase,
    evidence_policy: state.evidence_policy,
    tasks: state.tasks.map((task) => ({ task_id: task.task_id, status: task.status, evidence_ids: task.evidence_ids })),
    evidence: state.evidence.map((evidence) => ({
      evidence_id: evidence.evidence_id,
      evidence_type: evidence.evidence_type,
      evidence_types: evidence.evidence_types,
      result: evidence.result,
      exit_code: evidence.exit_code,
      check: evidence.check,
      output_ref: evidence.output_ref,
      sha256: evidence.sha256,
    })),
    verified_claims: state.verified_claims.map((claim) => ({
      claim_id: claim.claim_id,
      kind: claim.kind,
      value: claim.value,
      verified: claim.verified,
    })),
    rollback: state.plan.rollback_expectation,
    summary: state.final_report?.summary ?? "",
  };
}

function buildCompactReport(state: AgentHarnessRunState): string {
  const missing = state.evidence_policy?.missing.join(", ") || "none";
  const claims = state.verified_claims.map((claim) => `${claim.claim_id}:${claim.verified ? "ok" : "fail"}`).join(", ");
  const evidence = state.evidence.map((item) => `${item.evidence_id}:${item.result}/${item.exit_code}`).join(", ");
  return [
    "# Agent Harness Compact Report",
    `run_id: ${state.run_id}`,
    `status: ${state.status}`,
    `evidence_policy: score=${state.evidence_policy?.score ?? "n/a"} missing=${missing}`,
    `evidence: ${evidence || "none"}`,
    `claims: ${claims || "none"}`,
    `rollback: ${state.plan.rollback_expectation}`,
    `summary: ${state.final_report?.summary ?? "no summary"}`,
    "",
  ].join("\n");
}

function trimReport(report: string, maxChars: number): string {
  if (report.length <= maxChars) return report;
  return `${report.slice(0, Math.max(0, maxChars - 80)).trimEnd()}\n... truncated; use report --format full for audit details.\n`;
}
