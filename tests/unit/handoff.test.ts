import { describe, expect, it } from "vitest";
import { buildHandoffPacket, buildHandoffPrompt, validateWeakWorkerOutput } from "../../src/core/handoff.js";
import type { AgentHarnessPlan } from "../../src/core/plan-types.js";
import { PLAN_SCHEMA_VERSION } from "../../src/core/constants.js";

const plan: AgentHarnessPlan = {
  schema_version: PLAN_SCHEMA_VERSION,
  plan_id: "handoff-plan",
  risk_level: "L2",
  rollback_expectation: "Rollback: revert created.txt.",
  gates: ["node --version"],
  tasks: [
    {
      task_id: "handoff-task",
      depends_on: ["setup-task"],
      files: ["created.txt"],
      allowed_commands: ["node --version"],
      required_evidence: ["focused_tests"],
      acceptance_criteria: "Run `node --version` and return focused evidence.",
    },
    {
      task_id: "followup-task",
      depends_on: ["handoff-task"],
      files: ["followup.txt"],
      allowed_commands: ["node --version"],
      required_evidence: ["focused_tests"],
      acceptance_criteria: "Run `node --version` and return followup evidence.",
    },
    {
      task_id: "setup-task",
      files: ["setup.txt"],
      allowed_commands: ["node --version"],
      required_evidence: ["focused_tests"],
      acceptance_criteria: "Run `node --version` and return setup evidence.",
    },
  ],
};

describe("weak worker handoff", () => {
  it("builds a compact JSON-only handoff packet", () => {
    const packet = buildHandoffPacket(plan, "handoff-task");
    const prompt = buildHandoffPrompt(packet);
    expect(packet).toMatchObject({
      role: "implementation_worker_only",
      task_id: "handoff-task",
      depends_on: ["setup-task"],
      blocks_tasks: ["followup-task"],
      allowed_files: ["created.txt"],
      allowed_commands: ["node --version"],
    });
    expect(packet.blocked_if.length).toBeGreaterThan(0);
    expect(packet.output_schema.status).toBe("done|blocked|failed");
    expect(prompt).toContain("Return JSON only");
    expect(prompt.length).toBeLessThan(2500);
  });

  it("can project a prompt-only packet for compact CLI handoff", () => {
    const packet = buildHandoffPacket(plan, "handoff-task");
    const prompt = buildHandoffPrompt(packet);
    const compact = { task_id: packet.task_id, prompt, prompt_chars: prompt.length };
    expect(compact.task_id).toBe("handoff-task");
    expect(compact.prompt).toContain("Return JSON only");
    expect(compact).not.toHaveProperty("packet");
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify({ packet, prompt, prompt_chars: prompt.length }).length);
  });

  it("accepts valid worker output", () => {
    expect(validateWeakWorkerOutput(plan, "handoff-task", {
      status: "done",
      files_changed: ["created.txt"],
      evidence: [{ command: "node --version", result: "pass", output_excerpt: "v22.0.0" }],
      residual_risk: "none",
    })).toEqual({ valid: true, errors: [] });
  });

  it("rejects done without evidence", () => {
    const result = validateWeakWorkerOutput(plan, "handoff-task", {
      status: "done",
      files_changed: ["created.txt"],
      evidence: [],
      residual_risk: "none",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("done requires evidence");
  });

  it("rejects files outside the plan", () => {
    const result = validateWeakWorkerOutput(plan, "handoff-task", {
      status: "done",
      files_changed: ["other.txt"],
      evidence: [{ command: "node --version" }],
      residual_risk: "none",
    });
    expect(result.errors).toContain("file outside allowed_files: other.txt");
  });

  it("rejects commands outside allowed_commands", () => {
    const result = validateWeakWorkerOutput(plan, "handoff-task", {
      status: "done",
      files_changed: ["created.txt"],
      evidence: [{ command: "pnpm test" }],
      residual_risk: "none",
    });
    expect(result.errors).toContain("command outside allowed_commands: pnpm test");
  });

  it("rejects done evidence without pass result and output", () => {
    const result = validateWeakWorkerOutput(plan, "handoff-task", {
      status: "done",
      files_changed: ["created.txt"],
      evidence: [{}],
      residual_risk: "none",
    });
    expect(result.errors).toContain("done evidence requires command or check");
    expect(result.errors).toContain("done evidence requires result=pass");
    expect(result.errors).toContain("done evidence requires output_excerpt");
  });

  it("rejects done when no allowed command exists", () => {
    const planWithoutCommand: AgentHarnessPlan = {
      ...plan,
      gates: ["node --version", "pnpm test"],
      tasks: [{ ...plan.tasks[0], allowed_commands: undefined }],
    };
    const result = validateWeakWorkerOutput(planWithoutCommand, "handoff-task", {
      status: "done",
      files_changed: ["created.txt"],
      evidence: [{ command: "node --version", result: "pass", output_excerpt: "v22.0.0" }],
      residual_risk: "none",
    });
    expect(result.errors).toContain("done requires allowed_commands");
  });

  it("rejects placeholder text", () => {
    const result = validateWeakWorkerOutput(plan, "handoff-task", {
      status: "blocked",
      files_changed: [],
      evidence: [],
      residual_risk: "TODO",
    });
    expect(result.errors).toContain("worker output contains placeholder text");
  });

  it("rejects non-object worker output", () => {
    expect(validateWeakWorkerOutput(plan, "handoff-task", "bad")).toEqual({
      valid: false,
      errors: ["worker output must be a JSON object"],
    });
  });
});
