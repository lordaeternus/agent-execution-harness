import { describe, expect, it } from "vitest";
import { executeGateCommand } from "../../src/core/command-execution.js";

describe("command execution", () => {
  it("runs structured exec without shell", () => {
    const result = executeGateCommand({
      cwd: process.cwd(),
      exec: process.execPath,
      args: ["--version"],
      allowShell: false,
    });

    expect(result.exitCode).toBe(0);
    expect(result.shellUsed).toBe(false);
    expect(result.safetyWarning).toBeUndefined();
  });

  it("blocks shell command when shell is disallowed", () => {
    expect(() =>
      executeGateCommand({
        cwd: process.cwd(),
        command: "node --version",
        allowShell: false,
      }),
    ).toThrow("shell command is blocked in strict mode");
  });

  it("marks shell command with a weak-agent safety warning", () => {
    const result = executeGateCommand({
      cwd: process.cwd(),
      command: "node --version",
      allowShell: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.shellUsed).toBe(true);
    expect(result.safetyWarning).toContain("--exec");
  });
});
