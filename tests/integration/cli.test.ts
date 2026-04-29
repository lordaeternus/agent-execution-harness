import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const bin = path.resolve("dist/cli/index.js");

describe("cli integration", () => {
  it("runs plan-lint and execute", () => {
    execFileSync("node", [bin, "plan-lint", "--plan", "tests/fixtures/plans/basic-plan.json"], { stdio: "pipe" });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-cli-"));
    fs.copyFileSync("tests/fixtures/plans/basic-plan.json", path.join(tmp, "plan.json"));
    const output = execFileSync("node", [bin, "execute", "--plan", "plan.json", "--run-id", "cli-smoke"], { cwd: tmp, encoding: "utf8" });
    expect(output).toContain("declare_files");
    expect(fs.existsSync(path.join(tmp, ".agent-harness/runs/cli-smoke.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, ".agent-harness/runs/cli-smoke.full.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, ".agent-harness/runs/cli-smoke.current.json"))).toBe(true);
  });

  it("runs token-light macro flow and compact report", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-macro-"));
    fs.copyFileSync("tests/fixtures/plans/basic-plan.json", path.join(tmp, "plan.json"));
    fs.writeFileSync(path.join(tmp, "created.txt"), "ok");
    const common = ["--plan", "plan.json", "--run-id", "macro-smoke"];
    execFileSync("node", [bin, "start", ...common, "--summary", "ctx"], { cwd: tmp });
    execFileSync("node", [bin, "files", "declare", ...common, "--files", "created.txt"], { cwd: tmp });
    execFileSync("node", [bin, "task", "start", ...common, "--task-id", "basic-task", "--files", "created.txt"], { cwd: tmp });
    execFileSync("node", [bin, "gate", "pass", ...common, "--type", "focused_tests", "--check", "node --version"], { cwd: tmp });
    execFileSync("node", [bin, "claim", "auto", ...common], { cwd: tmp });
    execFileSync("node", [bin, "finish", ...common, "--summary", "validated"], { cwd: tmp });
    const report = execFileSync("node", [bin, "report", "--run-id", "macro-smoke", "--format", "compact"], { cwd: tmp, encoding: "utf8" });
    expect(report).toContain("Agent Harness Compact Report");
    expect(report).toContain("status: completed");
  });
});
