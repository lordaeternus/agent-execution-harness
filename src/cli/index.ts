import { benchmarkCommand } from "./benchmark.js";
import { doctorCommand } from "./doctor.js";
import { executeCommand } from "./execute.js";
import { initCommand } from "./init.js";
import { planLintCommand } from "./plan-lint.js";
import { reportCommand } from "./report.js";
import { runCommand } from "./run.js";

const [command, ...args] = process.argv.slice(2);

try {
  if (!command || command === "--help" || command === "help") {
    process.stdout.write("agent-harness commands: run, plan-lint, execute, report, doctor, benchmark, init\n");
  } else if (command === "run") runCommand(args);
  else if (command === "plan-lint") planLintCommand(args);
  else if (command === "execute") executeCommand(args);
  else if (command === "report") reportCommand(args);
  else if (command === "doctor") doctorCommand(args);
  else if (command === "benchmark") benchmarkCommand(args);
  else if (command === "init") initCommand(args);
  else throw new Error(`unknown command: ${command}`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
