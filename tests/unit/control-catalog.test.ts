import { describe, expect, it } from "vitest";
import { listControls } from "../../src/core/control-catalog.js";

describe("control catalog", () => {
  it("keeps control ids unique and fields complete", () => {
    const controls = listControls();
    expect(new Set(controls.map((control) => control.id)).size).toBe(controls.length);
    for (const control of controls) {
      expect(control.id).toMatch(/^[a-z0-9_]+$/);
      expect(control.type).toMatch(/^(feedforward|feedback)$/);
      expect(control.execution).toMatch(/^(computational|inferential)$/);
      expect(control.cost).toMatch(/^(low|medium|high)$/);
      expect(control.phase).toMatch(/^(before_run|during_run|before_finish|post_run)$/);
      expect(control.risk_covered.length).toBeGreaterThan(10);
      expect(control.when_to_use.length).toBeGreaterThan(10);
    }
  });

  it("documents the core low-token safety controls", () => {
    const ids = listControls().map((control) => control.id);
    expect(ids).toEqual(expect.arrayContaining(["plan_lint", "scope_guard", "evidence_policy", "strict_command_policy", "handoff_validate", "coding_discipline"]));
    expect(listControls().find((control) => control.id === "coding_discipline")).toMatchObject({
      type: "feedforward",
      execution: "computational",
      cost: "low",
    });
  });
});
