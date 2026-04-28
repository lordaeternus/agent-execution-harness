export interface BenchmarkRun {
  model_executor: string;
  status: "pass" | "fail" | "halt";
  attempt: number;
  retries: number;
  gate_passed: boolean;
  halted: boolean;
  cost_usd: number;
}

export function calculateBenchmark(runs: BenchmarkRun[]) {
  const total = runs.length || 1;
  const passed = runs.filter((run) => run.status === "pass").length;
  const passAt1 = runs.filter((run) => run.status === "pass" && run.attempt === 1).length / total;
  const haltRate = runs.filter((run) => run.halted).length / total;
  const retriesPerTask = runs.reduce((sum, run) => sum + run.retries, 0) / total;
  const costPerSuccess = passed ? runs.reduce((sum, run) => sum + run.cost_usd, 0) / passed : Infinity;
  return {
    completion_rate: passed / total,
    "pass@1": passAt1,
    "pass@3": runs.filter((run) => run.status === "pass" && run.attempt <= 3).length / total,
    halt_rate: haltRate,
    retries_per_task: retriesPerTask,
    cost_per_successful_task: costPerSuccess,
  };
}
