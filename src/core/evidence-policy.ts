import type { AgentHarnessRunState, Evidence, EvidencePolicySummary } from "./run-types.js";
import { requiredEvidenceForTask as taskRequiredEvidence } from "./task-contract.js";

export function evaluateEvidencePolicy(state: AgentHarnessRunState): EvidencePolicySummary {
  const planTaskById = new Map(state.plan.tasks.map((task) => [task.task_id, task]));
  const tasks = state.tasks.map((task) => {
    const planTask = planTaskById.get(task.task_id);
    const required = taskRequiredEvidence({ runTask: task, planTask });
    const taskEvidence = state.evidence.filter((evidence) => task.evidence_ids.includes(evidence.evidence_id));
    const satisfied = required.filter((requirement) => isRequirementSatisfied(requirement, taskEvidence));
    return {
      task_id: task.task_id,
      required,
      satisfied,
      missing: required.filter((requirement) => !satisfied.includes(requirement)),
    };
  });
  const required = unique(tasks.flatMap((task) => task.required));
  const satisfied = unique(tasks.flatMap((task) => task.satisfied));
  const missing = unique(tasks.flatMap((task) => task.missing));
  const score = required.length === 0 ? 100 : Math.round(((required.length - missing.length) / required.length) * 100);
  return {
    status: missing.length === 0 ? "satisfied" : "missing_required_evidence",
    score,
    required,
    satisfied,
    missing,
    tasks,
  };
}

export function isTaskEvidenceComplete(state: AgentHarnessRunState, taskId: string): boolean {
  return evaluateEvidencePolicy(state).tasks.find((task) => task.task_id === taskId)?.missing.length === 0;
}

function isRequirementSatisfied(requirement: string, evidence: Evidence[]): boolean {
  if (requirement === "file_scope") return evidence.some((item) => item.result === "pass" && /(^|[,;\s])file_scope($|[,;\s])/.test(item.scope_covered));
  const alternatives = requirement.split("|").map((item) => item.trim()).filter(Boolean);
  return alternatives.some((alternative) =>
    evidence.some((item) => item.result === "pass" && evidenceTypes(item).includes(alternative)),
  );
}

function evidenceTypes(evidence: Evidence): string[] {
  return unique([evidence.evidence_type, ...(evidence.evidence_types ?? [])].filter((item): item is string => Boolean(item)));
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
