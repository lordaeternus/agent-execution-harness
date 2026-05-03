import { benchmarkCommand } from "./benchmark.js";
import { doctorCommand } from "./doctor.js";
import { executeCommand } from "./execute.js";
import { initCommand } from "./init.js";
import { planLintCommand } from "./plan-lint.js";
import { reportCommand } from "./report.js";
import { runCommand } from "./run.js";
import { macroCommand } from "./macro.js";
import { mapCommand } from "./map.js";
import { sessionCommand } from "./session.js";
import { nextCommand } from "./next.js";
import { verifyCommand } from "./verify.js";
import { classifyRepair } from "../core/repair-playbooks.js";
import { learnCommand } from "./learn.js";

const [command, ...args] = process.argv.slice(2);

try {
  if (!command || command === "--help" || command === "help") {
    process.stdout.write("agent-harness commands: run, session, next, verify, map, learn, start, files, task, gate, claim, finish, plan-lint, execute, report, doctor, benchmark, init\n");
  } else if (command === "run") runCommand(args);
  else if (command === "session") sessionCommand(args);
  else if (command === "next") nextCommand(args);
  else if (command === "verify") verifyCommand(args);
  else if (command === "map") mapCommand(args);
  else if (command === "learn") learnCommand(args);
  else if (["start", "files", "task", "gate", "claim", "finish"].includes(command)) macroCommand([command, ...args]);
  else if (command === "plan-lint") planLintCommand(args);
  else if (command === "execute") executeCommand(args);
  else if (command === "report") reportCommand(args);
  else if (command === "doctor") doctorCommand(args);
  else if (command === "benchmark") benchmarkCommand(args);
  else if (command === "init") await initCommand(args);
  else throw new Error(`unknown command: ${command}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const repair = classifyRepair([command, ...args].join(" "), message);
  process.stderr.write(`${JSON.stringify({ status: "error", summary: message, errors: [message], data: { repair_hint: repair } })}\n`);
  process.exitCode = 1;
}
