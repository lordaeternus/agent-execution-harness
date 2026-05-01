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

  it("runs session, next and verify without repeating plan and run id", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-session-"));
    fs.copyFileSync("tests/fixtures/plans/basic-plan.json", path.join(tmp, "plan.json"));
    fs.writeFileSync(path.join(tmp, "created.txt"), "ok");
    execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "session-smoke"], { cwd: tmp });
    execFileSync("node", [bin, "files", "declare", "--files", "created.txt"], { cwd: tmp });
    const next = execFileSync("node", [bin, "next"], { cwd: tmp, encoding: "utf8" });
    expect(next).toContain("basic-task");
    execFileSync("node", [bin, "task", "start", "--task-id", "basic-task", "--files", "created.txt"], { cwd: tmp });
    const verified = execFileSync("node", [bin, "verify", "--task-id", "basic-task", "--types", "focused_tests,scoped_typecheck", "--cmd", "node --version"], {
      cwd: tmp,
      encoding: "utf8",
    });
    const verifiedJson = JSON.parse(verified) as { data: { output_ref: string; sha256: string } };
    expect(verifiedJson.data.output_ref).toContain(".agent-harness/runs/logs/session-smoke/");
    expect(verifiedJson.data.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(fs.existsSync(path.join(tmp, verifiedJson.data.output_ref))).toBe(true);
    execFileSync("node", [bin, "claim", "auto"], { cwd: tmp });
    execFileSync("node", [bin, "finish", "--summary", "validated"], { cwd: tmp });
    const report = execFileSync("node", [bin, "report", "--run-id", "session-smoke", "--format", "compact"], { cwd: tmp, encoding: "utf8" });
    expect(report).toContain("status: completed");
  });

  it("blocks dangerous verify commands before execution", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-verify-block-"));
    fs.copyFileSync("tests/fixtures/plans/basic-plan.json", path.join(tmp, "plan.json"));
    fs.writeFileSync(path.join(tmp, "created.txt"), "ok");
    execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "blocked-smoke"], { cwd: tmp });
    execFileSync("node", [bin, "files", "declare", "--files", "created.txt"], { cwd: tmp });
    execFileSync("node", [bin, "task", "start", "--task-id", "basic-task", "--files", "created.txt"], { cwd: tmp });
    expect(() =>
      execFileSync("node", [bin, "verify", "--task-id", "basic-task", "--type", "focused_tests", "--cmd", "git reset --hard HEAD"], {
        cwd: tmp,
        stdio: "pipe",
      }),
    ).toThrow();
  });

  it("runs codebase memory map commands", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-map-"));
    fs.mkdirSync(path.join(tmp, "src/auth"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src/auth/session.ts"), "export const session = true;\n");
    const init = execFileSync("node", [bin, "map", "init"], { cwd: tmp, encoding: "utf8" });
    expect(init).toContain("memory init");
    const query = execFileSync("node", [bin, "map", "query", "--surface", "auth"], { cwd: tmp, encoding: "utf8" });
    expect(query).toContain("auth memory");
    fs.writeFileSync(path.join(tmp, "src/auth/session.ts"), "export const session = 'changed';\n");
    const update = execFileSync("node", [bin, "map", "update", "--files", "src/auth/session.ts"], { cwd: tmp, encoding: "utf8" });
    expect(update).toContain("auth");
    const record = execFileSync(
      "node",
      [
        bin,
        "map",
        "record",
        "--surface",
        "auth",
        "--files",
        "src/auth/session.ts",
        "--summary",
        "Auth session surface owns login state contracts and must be checked before authorization-related edits.",
        "--confidence",
        "high",
      ],
      { cwd: tmp, encoding: "utf8" },
    );
    expect(record).toContain("memory recorded");
    expect(fs.existsSync(path.join(tmp, ".agent-harness/memory/surfaces/auth.json"))).toBe(true);
  });
});
