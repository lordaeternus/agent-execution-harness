export interface BenchmarkRun {
  model_executor: string;
  status: "pass" | "fail" | "halt";
  attempt: number;
  retries: number;
  gate_passed: boolean;
  halted: boolean;
  cost_usd: number;
  false_success?: boolean;
  repair_succeeded?: boolean;
  unexpected_diff_blocked?: boolean;
}

export interface BenchmarkReport {
  completion_rate: number;
  "pass@1": number;
  "pass@3": number;
  halt_rate: number;
  false_success_rate: number;
  repair_success_rate: number;
  unexpected_diff_block_rate: number;
  retries_per_task: number;
  cost_per_successful_task: number;
}

export function calculateBenchmark(runs: BenchmarkRun[]): BenchmarkReport {
  const total = runs.length || 1;
  const passed = runs.filter((run) => run.status === "pass").length;
  const passAt1 = runs.filter((run) => run.status === "pass" && run.attempt === 1).length / total;
  const haltRate = runs.filter((run) => run.halted).length / total;
  const falseSuccessRate = runs.filter((run) => run.false_success).length / total;
  const repairAttempts = runs.filter((run) => run.retries > 0 || run.repair_succeeded !== undefined);
  const diffAttempts = runs.filter((run) => run.unexpected_diff_blocked !== undefined);
  const retriesPerTask = runs.reduce((sum, run) => sum + run.retries, 0) / total;
  const costPerSuccess = passed ? runs.reduce((sum, run) => sum + run.cost_usd, 0) / passed : Infinity;
  return {
    completion_rate: passed / total,
    "pass@1": passAt1,
    "pass@3": runs.filter((run) => run.status === "pass" && run.attempt <= 3).length / total,
    halt_rate: haltRate,
    false_success_rate: falseSuccessRate,
    repair_success_rate: repairAttempts.length ? repairAttempts.filter((run) => run.repair_succeeded).length / repairAttempts.length : 0,
    unexpected_diff_block_rate: diffAttempts.length ? diffAttempts.filter((run) => run.unexpected_diff_blocked).length / diffAttempts.length : 0,
    retries_per_task: retriesPerTask,
    cost_per_successful_task: costPerSuccess,
  };
}

export function benchmarkFailures(report: BenchmarkReport): string[] {
  const failures: string[] = [];
  if (report.false_success_rate !== 0) failures.push(`false_success_rate=${report.false_success_rate} must be 0`);
  if (report.unexpected_diff_block_rate !== 1) failures.push(`unexpected_diff_block_rate=${report.unexpected_diff_block_rate} must be 1`);
  return failures;
}
