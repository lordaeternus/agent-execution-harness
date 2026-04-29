import type { AgentHarnessRunState } from "./run-types.js";

export function buildReport(state: AgentHarnessRunState): string {
  if (!["completed", "partial_validated"].includes(state.status)) throw new Error("report requires completed or partial_validated run");
  if (!state.verified_claims.length) throw new Error("report requires verified claims");
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
