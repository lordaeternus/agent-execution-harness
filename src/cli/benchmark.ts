import fs from "node:fs";
import path from "node:path";
import { calculateBenchmark, type BenchmarkRun } from "../core/benchmark.js";
import { parseFlags, stringFlag } from "./args.js";

export function benchmarkCommand(args: string[], cwd = process.cwd()): void {
  const flags = parseFlags(args);
  const indexPath = stringFlag(flags, "index") ?? "tests/fixtures/benchmark/scenario-index.json";
  const index = JSON.parse(fs.readFileSync(path.resolve(cwd, indexPath), "utf8")) as { scenarios: Array<{ fixture_path: string }> };
  const runs = index.scenarios.flatMap((scenario) => {
    const fixture = JSON.parse(fs.readFileSync(path.resolve(cwd, scenario.fixture_path), "utf8")) as { runs: BenchmarkRun[] };
    return fixture.runs;
  });
  const report = calculateBenchmark(runs);
  process.stdout.write(`agent-harness-benchmark mode=${String(flags.mode ?? "smoke")} scenarios=${index.scenarios.length}\n`);
  process.stdout.write(`completion_rate=${report.completion_rate} pass@1=${report["pass@1"]} halt_rate=${report.halt_rate}\n`);
}
