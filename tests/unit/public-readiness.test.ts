import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { classifyDangerousCommand } from "../../src/core/dangerous-command.js";
import { evaluateCommandPolicy } from "../../src/core/command-policy.js";
import { runDoctor } from "../../src/core/doctor.js";
import { defaultConfig } from "../../src/core/config.js";
import { validateRunState, lintPlan } from "../../src/core/schema-validation.js";
import { buildReport } from "../../src/core/report.js";

describe("public readiness hardening", () => {
  it("uses public package metadata and MIT license", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as Record<string, unknown>;
    expect(pkg.private).toBeUndefined();
    expect(pkg.version).toBe("0.1.0");
    expect(pkg.license).toBe("MIT");
    expect(fs.readFileSync("LICENSE", "utf8")).toContain("MIT License");
  });

  it("rejects invalid plans and duplicate tasks", () => {
    expect(lintPlan({ schema_version: "agent_harness_plan_v1" }).status).toBe("error");
    expect(
      lintPlan({
        schema_version: "agent_harness_plan_v1",
        plan_id: "bad plan",
        risk_level: "L4",
        rollback_expectation: "x",
        gates: [],
        tasks: [],
      }).status,
    ).toBe("error");
  });

  it("detects dangerous command variants", () => {
    expect(classifyDangerousCommand("git clean -fdx")).toContain("git clean");
    expect(classifyDangerousCommand("Remove-Item . -Recurse -Force")).toContain("recursive");
    expect(classifyDangerousCommand("echo secret > .env")).toContain("sensitive");
    expect(evaluateCommandPolicy("pnpm test", { allow: ["pnpm"], deny: ["publish"] }).allowed).toBe(true);
    expect(evaluateCommandPolicy("pnpm publish", { allow: ["pnpm"], deny: ["publish"] }).allowed).toBe(false);
  });

  it("builds report from golden v1 artifact", () => {
    const state = JSON.parse(fs.readFileSync("tests/fixtures/golden/agent_harness_run_v1.json", "utf8"));
    expect(() => validateRunState(state)).not.toThrow();
    expect(buildReport(state)).toContain("golden-v1");
  });

  it("doctor returns coded findings", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-doctor-"));
    const result = runDoctor(tmp, defaultConfig());
    expect(result.status).toBe("error");
    expect(result.findings[0]).toMatchObject({ code: "missing_package_json" });
  });

  it("init dry-run does not alter target and apply creates backup", () => {
    execFileSync("node", ["dist/cli/index.js", "init", "--adapter", "generic", "--cwd", "examples/minimal-js-project"], { stdio: "pipe" });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-init-"));
    fs.writeFileSync(path.join(tmp, "package.json"), `${JSON.stringify({ name: "target", scripts: {} }, null, 2)}\n`);
    execFileSync("node", ["dist/cli/index.js", "init", "--adapter", "generic", "--cwd", tmp, "--apply"], { stdio: "pipe" });
    expect(fs.existsSync(path.join(tmp, "agent-harness.config.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "AGENTS.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, ".agent-harness", "backups"))).toBe(true);
  });
});
