import type { HarnessClaim } from "./action-types.js";
import type { AgentHarnessRunState } from "./run-types.js";

export function buildAutoClaims(state: AgentHarnessRunState): HarnessClaim[] {
  const claims: HarnessClaim[] = [];
  for (const task of state.tasks) {
    for (const evidenceId of task.evidence_ids) {
      const evidence = state.evidence.find((item) => item.evidence_id === evidenceId);
      if (!evidence) continue;
      const prefix = `${task.task_id}-${evidence.evidence_id}`;
      claims.push({
        claim_id: `${prefix}-gate-${evidence.result}`,
        kind: evidence.result === "pass" ? "gate_passed" : "gate_failed",
        value: evidence.check,
        evidence_id: evidence.evidence_id,
      });
      claims.push({
        claim_id: `${prefix}-task-reconciled`,
        kind: "task_reconciled",
        value: task.task_id,
        evidence_id: evidence.evidence_id,
      });
      if (evidence.result === "pass") {
        claims.push({
          claim_id: `${prefix}-acceptance`,
          kind: "acceptance_criteria_met",
          value: task.task_id,
          evidence_id: evidence.evidence_id,
        });
      }
      if (state.plan.rollback_expectation.trim()) {
        claims.push({
          claim_id: `${prefix}-rollback`,
          kind: "rollback_defined",
          value: state.plan.rollback_expectation,
          evidence_id: evidence.evidence_id,
        });
      }
    }
  }
  return dedupeClaims(claims);
}

function dedupeClaims(claims: HarnessClaim[]): HarnessClaim[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = `${claim.kind}:${claim.value}:${claim.evidence_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
