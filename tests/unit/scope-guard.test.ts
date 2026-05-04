import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { collectGitTouchedFiles, evaluateScopeGuard } from "../../src/core/scope-guard.js";

describe("scope guard", () => {
  it("allows declared files", () => {
    expect(evaluateScopeGuard({
      declared_files: ["src/login.ts"],
      touched_files: ["src/login.ts"],
      generated_allowlist: [],
    })).toMatchObject({ allowed: true, unexpected_files: [] });
  });

  it("rejects files outside the plan", () => {
    expect(evaluateScopeGuard({
      declared_files: ["src/login.ts"],
      touched_files: ["src/login.ts", "src/auth/session.ts"],
      generated_allowlist: [],
    })).toMatchObject({ allowed: false, unexpected_files: ["src/auth/session.ts"] });
  });

  it("allows generated artifacts", () => {
    expect(evaluateScopeGuard({
      declared_files: ["src/login.ts"],
      touched_files: ["src/login.ts", "docs/build-report/agent-harness/runs/run.json"],
      generated_allowlist: ["docs/build-report/agent-harness/**"],
    })).toMatchObject({ allowed: true, unexpected_files: [] });
  });

  it("normalizes Windows paths", () => {
    expect(evaluateScopeGuard({
      declared_files: ["src/login.ts"],
      touched_files: ["src\\login.ts", "src\\other.ts"],
      generated_allowlist: [],
    })).toMatchObject({ allowed: false, unexpected_files: ["src/other.ts"] });
  });

  it("collects staged files as touched files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-scope-"));
    execFileSync("git", ["init"], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: tmp, stdio: "pipe" });
    fs.mkdirSync(path.join(tmp, "src"));
    fs.writeFileSync(path.join(tmp, "src", "planned.ts"), "old\n");
    execFileSync("git", ["add", "."], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", "init"], { cwd: tmp, stdio: "pipe" });
    fs.writeFileSync(path.join(tmp, "src", "planned.ts"), "new\n");
    execFileSync("git", ["add", "src/planned.ts"], { cwd: tmp, stdio: "pipe" });
    expect(collectGitTouchedFiles(tmp)).toContain("src/planned.ts");
  });
});
