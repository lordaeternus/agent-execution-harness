import { describe, expect, it } from "vitest";
import { calculateBenchmark } from "../../src/core/benchmark.js";

describe("benchmark metrics", () => {
  it("reports adversarial safety metrics", () => {
    const report = calculateBenchmark([
      { model_executor: "weak", status: "pass", attempt: 1, retries: 1, gate_passed: true, halted: false, cost_usd: 0.01, repair_succeeded: true },
      { model_executor: "weak", status: "halt", attempt: 1, retries: 0, gate_passed: false, halted: true, cost_usd: 0.01, unexpected_diff_blocked: true },
      { model_executor: "weak", status: "fail", attempt: 2, retries: 1, gate_passed: false, halted: false, cost_usd: 0.01, false_success: true, repair_succeeded: false },
    ]);
    expect(report.false_success_rate).toBeCloseTo(1 / 3);
    expect(report.repair_success_rate).toBe(0.5);
    expect(report.unexpected_diff_block_rate).toBe(1);
  });
});
