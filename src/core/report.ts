import type { AgentHarnessRunState } from "./run-types.js";

export function buildReport(state: AgentHarnessRunState): string {
  if (state.status !== "completed") throw new Error("report requires completed run");
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
    "## Result",
    `- completed: ${state.final_report?.summary ?? "no summary"}`,
    "",
  ].join("\n");
}
