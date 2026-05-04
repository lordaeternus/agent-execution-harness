import { spawnSync } from "node:child_process";

export interface CommandExecutionRequest {
  command?: string;
  exec?: string;
  args?: string[];
  cwd: string;
  allowShell: boolean;
}

export interface CommandExecutionResult {
  check: string;
  stdout: string;
  stderr: string;
  output: string;
  exitCode: number;
}

export function executeGateCommand(request: CommandExecutionRequest): CommandExecutionResult {
  const args = request.args ?? [];
  const check = request.exec ? [request.exec, ...args].join(" ") : request.command ?? "";
  if (request.exec) {
    const result = spawnSync(request.exec, args, { cwd: request.cwd, shell: false, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    return resultFromSpawn(check, result);
  }
  if (!request.command) throw new Error("--cmd or --exec is required");
  if (!request.allowShell) throw new Error("shell command is blocked in strict mode; use --exec and --args-json");
  const result = spawnSync(request.command, { cwd: request.cwd, shell: true, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  return resultFromSpawn(check, result);
}

function resultFromSpawn(check: string, result: ReturnType<typeof spawnSync>): CommandExecutionResult {
  const stdout = String(result.stdout ?? "");
  const stderr = String(result.stderr ?? "");
  const output = `${stdout}${stderr}`;
  return { check, stdout, stderr, output, exitCode: typeof result.status === "number" ? result.status : 1 };
}
