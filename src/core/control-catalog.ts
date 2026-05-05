export type HarnessControlType = "feedforward" | "feedback";
export type HarnessControlExecution = "computational" | "inferential";
export type HarnessControlCost = "low" | "medium" | "high";
export type HarnessControlPhase = "before_run" | "during_run" | "before_finish" | "post_run";

export interface HarnessControl {
  id: string;
  type: HarnessControlType;
  execution: HarnessControlExecution;
  cost: HarnessControlCost;
  phase: HarnessControlPhase;
  risk_covered: string;
  when_to_use: string;
}

export const CONTROL_CATALOG: HarnessControl[] = [
  {
    id: "plan_lint",
    type: "feedforward",
    execution: "computational",
    cost: "low",
    phase: "before_run",
    risk_covered: "invalid or underspecified plan enters execution",
    when_to_use: "before approved plan execution",
  },
  {
    id: "strict_command_policy",
    type: "feedforward",
    execution: "computational",
    cost: "low",
    phase: "during_run",
    risk_covered: "weak or untrusted executor runs undeclared shell commands",
    when_to_use: "strict mode, sensitive work, or less trusted executor",
  },
  {
    id: "scope_guard",
    type: "feedback",
    execution: "computational",
    cost: "low",
    phase: "before_finish",
    risk_covered: "agent changed files outside the declared plan",
    when_to_use: "plans with file scope or weak executor mode",
  },
  {
    id: "evidence_policy",
    type: "feedback",
    execution: "computational",
    cost: "low",
    phase: "before_finish",
    risk_covered: "agent claims completion without required proof",
    when_to_use: "all planned work, especially L2 and L3 tasks",
  },
  {
    id: "handoff_validate",
    type: "feedback",
    execution: "computational",
    cost: "low",
    phase: "during_run",
    risk_covered: "external weak worker returns invented files, commands, or weak evidence",
    when_to_use: "handoff flow with local, cheaper, or external models",
  },
  {
    id: "approved_fixtures",
    type: "feedback",
    execution: "computational",
    cost: "medium",
    phase: "before_finish",
    risk_covered: "critical behavior is validated by tests generated only by the agent",
    when_to_use: "critical business rules such as auth, billing, clinical AI, or data transforms",
  },
];

export function listControls(): HarnessControl[] {
  return CONTROL_CATALOG.map((control) => ({ ...control }));
}
