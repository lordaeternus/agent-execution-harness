import type { AgentHarnessPlan, RiskLevel } from "./plan-types.js";

export type SensorCost = "low" | "medium" | "high";

export interface SensorRecommendation {
  id: string;
  cost: SensorCost;
  required_for: RiskLevel[];
  reason: string;
}

export interface RiskSensorProfile {
  risk_level: RiskLevel;
  sensors: SensorRecommendation[];
}

const PROFILES: Record<RiskLevel, RiskSensorProfile> = {
  L1: {
    risk_level: "L1",
    sensors: [
      { id: "focused_validation", cost: "low", required_for: ["L1", "L2", "L3"], reason: "prove the touched behavior without broad suite cost" },
      { id: "scope_guard", cost: "low", required_for: ["L1", "L2", "L3"], reason: "block out-of-plan file changes before finish" },
    ],
  },
  L2: {
    risk_level: "L2",
    sensors: [
      { id: "focused_validation", cost: "low", required_for: ["L1", "L2", "L3"], reason: "prove the touched behavior without broad suite cost" },
      { id: "scoped_lint_or_typecheck", cost: "medium", required_for: ["L2", "L3"], reason: "catch local integration errors cheaply" },
      { id: "evidence_policy", cost: "low", required_for: ["L2", "L3"], reason: "prevent success claims without task evidence" },
    ],
  },
  L3: {
    risk_level: "L3",
    sensors: [
      { id: "focused_validation", cost: "low", required_for: ["L1", "L2", "L3"], reason: "prove the touched behavior without broad suite cost" },
      { id: "scoped_lint_or_typecheck", cost: "medium", required_for: ["L2", "L3"], reason: "catch local integration errors cheaply" },
      { id: "build_or_contract_gate", cost: "high", required_for: ["L3"], reason: "catch cross-boundary contract and build failures" },
      { id: "rollback_review", cost: "low", required_for: ["L3"], reason: "ensure sensitive changes remain reversible" },
      { id: "smoke_when_applicable", cost: "high", required_for: ["L3"], reason: "prove user-visible, auth, API, or DB flows in runtime" },
    ],
  },
};

export function sensorProfileForRisk(riskLevel: RiskLevel): RiskSensorProfile {
  return {
    risk_level: riskLevel,
    sensors: PROFILES[riskLevel].sensors.map((sensor) => ({ ...sensor, required_for: [...sensor.required_for] })),
  };
}

export function sensorWarningsForPlan(plan: AgentHarnessPlan): string[] {
  const warnings: string[] = [];
  const profile = sensorProfileForRisk(plan.risk_level);
  if (plan.risk_level === "L3") {
    const gateText = plan.gates.join(" ").toLowerCase();
    if (!/(build|contract|typecheck|tsc)/.test(gateText)) warnings.push("L3 plan should include a build, typecheck, or contract gate.");
    if (!/(smoke|browser|e2e|integration|api|db|auth)/.test(gateText)) warnings.push("L3 plan should include a runtime, integration, smoke, auth, API, or DB gate when applicable.");
    for (const task of plan.tasks) {
      if (!task.required_evidence?.length) warnings.push(`${task.task_id}: L3 task should declare required_evidence.`);
      const surface = task.surface;
      const critical = surface && ["auth", "db", "api", "ai"].includes(surface);
      const evidence = (task.required_evidence ?? []).join(" ").toLowerCase();
      const text = `${task.acceptance_criteria} ${(task.required_checks ?? []).join(" ")}`.toLowerCase();
      if (critical && !/(approved_fixture|fixture)/.test(evidence) && !/(fixture not applicable|fixture_not_applicable|approved fixture not applicable)/.test(text)) {
        warnings.push(`${task.task_id}: L3 critical surface should use approved_fixture evidence or explain why not applicable.`);
      }
    }
  }
  if (plan.execution_profile === "strict") {
    for (const task of plan.tasks) {
      if (!task.allowed_commands?.length) warnings.push(`${task.task_id}: strict execution works best with allowed_commands declared.`);
    }
  }
  if (!profile.sensors.some((sensor) => sensor.cost === "high") && plan.risk_level === "L1") return warnings;
  return warnings;
}
