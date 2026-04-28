import fs from "node:fs";
import path from "node:path";
import type { HarnessClaim } from "./action-types.js";
import type { AgentHarnessConfig } from "./config-types.js";
import type { AgentHarnessRunState, VerifiedClaim } from "./run-types.js";

export function verifyClaim(state: AgentHarnessRunState, claim: HarnessClaim, config: AgentHarnessConfig): VerifiedClaim {
  const evidence = state.evidence.find((item) => item.evidence_id === claim.evidence_id);
  let verified = Boolean(evidence);
  if (!claim.claim_id || !claim.kind || !claim.value) verified = false;

  if (verified && claim.kind === "file_exists") verified = fs.existsSync(path.resolve(process.cwd(), claim.value));
  if (verified && claim.kind === "command_ran") verified = evidence?.check === claim.value;
  if (verified && claim.kind === "gate_passed") verified = evidence?.check === claim.value && evidence.result === "pass" && evidence.exit_code === 0;
  if (verified && claim.kind === "gate_failed") verified = evidence?.check === claim.value && evidence.result === "fail" && evidence.exit_code !== 0;
  if (verified && claim.kind === "dangerous_command_blocked") verified = state.status === "halt" || state.errors.some((error) => error.includes("dangerous command"));
  if (verified && claim.kind === "task_reconciled") verified = state.tasks.some((task) => task.task_id === claim.value && !["not_started", "in_progress"].includes(task.status));
  if (verified && claim.kind === "bug_reproduced_before_fix") verified = evidence?.result === "fail" && evidence.exit_code !== 0;
  if (verified && claim.kind === "bug_fixed_after_fix") verified = evidence?.result === "pass" && evidence.exit_code === 0;
  if (verified && claim.kind === "acceptance_criteria_met") verified = state.tasks.some((task) => task.task_id === claim.value && task.status === "completed" && task.evidence_ids.includes(claim.evidence_id));
  if (verified && claim.kind === "contract_preserved") verified = /contract|governance|typecheck|test/i.test(evidence?.scope_covered ?? "");
  if (verified && claim.kind === "rollback_defined") verified = state.plan.rollback_expectation.trim().length > 0;
  if (verified && claim.kind === "no_product_code_changed") {
    verified = !config.product_paths.some((productPath) => claim.value.includes(productPath));
  }
  return { ...claim, verified };
}
