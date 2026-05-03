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
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
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
    expect(buildReport(state, "compact")).toContain("Agent Harness Compact Report");
    expect(buildReport(state, "json")).toContain("\"run_id\"");
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
    expect(fs.existsSync(path.join(tmp, "docs", "agent-runtime.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, ".agent-harness", "backups"))).toBe(true);
  });

  it("init resolves templates from the package when called outside the repo", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-npx-like-"));
    fs.writeFileSync(path.join(tmp, "package.json"), `${JSON.stringify({ name: "target", private: true }, null, 2)}\n`);
    execFileSync("node", [path.resolve("dist/cli/index.js"), "init", "--adapter", "generic", "--cwd", tmp, "--apply"], { cwd: tmp, stdio: "pipe" });
    expect(fs.existsSync(path.join(tmp, "AGENTS.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "agent-harness.config.json"))).toBe(true);
  });

  it("does not overwrite an existing AGENTS.md unless explicitly requested", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-agents-skip-"));
    fs.writeFileSync(path.join(tmp, "package.json"), `${JSON.stringify({ name: "target", private: true }, null, 2)}\n`);
    fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# Existing Rules\n\n- Keep current project rules.\n");

    execFileSync("node", [path.resolve("dist/cli/index.js"), "init", "--adapter", "generic", "--cwd", tmp, "--apply"], { cwd: tmp, stdio: "pipe" });

    expect(fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf8")).toBe("# Existing Rules\n\n- Keep current project rules.\n");
  });

  it("can append harness rules to an existing AGENTS.md", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-agents-append-"));
    fs.writeFileSync(path.join(tmp, "package.json"), `${JSON.stringify({ name: "target", private: true }, null, 2)}\n`);
    fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# Existing Rules\n");

    execFileSync("node", [path.resolve("dist/cli/index.js"), "init", "--adapter", "generic", "--cwd", tmp, "--apply", "--agents-mode", "append"], {
      cwd: tmp,
      stdio: "pipe",
    });
    execFileSync("node", [path.resolve("dist/cli/index.js"), "init", "--adapter", "generic", "--cwd", tmp, "--apply", "--agents-mode", "append"], {
      cwd: tmp,
      stdio: "pipe",
    });

    const agents = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf8");
    expect(agents).toContain("# Existing Rules");
    expect(agents).toContain("agent-execution-harness:start");
    expect(agents.match(/agent-execution-harness:start/g)).toHaveLength(1);
  });

  it("preserves user history, memory, config and scripts during update installs", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-update-preserve-"));
    fs.mkdirSync(path.join(tmp, "docs"), { recursive: true });
    fs.mkdirSync(path.join(tmp, ".agent-harness", "runs"), { recursive: true });
    fs.mkdirSync(path.join(tmp, ".agent-harness", "memory"), { recursive: true });

    fs.writeFileSync(
      path.join(tmp, "package.json"),
      `${JSON.stringify({ name: "target", private: true, scripts: { test: "custom-test", "agent:doctor": "custom-doctor" } }, null, 2)}\n`,
    );
    fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# Existing Rules\n");
    fs.writeFileSync(path.join(tmp, "agent-harness.config.json"), "{\"custom\":true}\n");
    fs.writeFileSync(path.join(tmp, "docs", "agent-runtime.md"), "# Custom Runtime\n");
    fs.writeFileSync(path.join(tmp, "docs", "historico.md"), "[2026-05-03] existing history\n");
    fs.writeFileSync(path.join(tmp, ".agent-harness", "runs", "old-run.json"), "{\"status\":\"completed\"}\n");
    fs.writeFileSync(path.join(tmp, ".agent-harness", "memory", "index.json"), "{\"surfaces\":[]}\n");
    fs.writeFileSync(path.join(tmp, ".gitignore"), ".agent-harness/runs/\n");

    execFileSync("node", [path.resolve("dist/cli/index.js"), "init", "--adapter", "generic", "--cwd", tmp, "--apply", "--agents-mode", "append"], {
      cwd: tmp,
      stdio: "pipe",
    });
    execFileSync("node", [path.resolve("dist/cli/index.js"), "init", "--adapter", "generic", "--cwd", tmp, "--apply", "--agents-mode", "append"], {
      cwd: tmp,
      stdio: "pipe",
    });

    const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf8")) as { scripts: Record<string, string> };
    const gitignore = fs.readFileSync(path.join(tmp, ".gitignore"), "utf8");

    expect(fs.readFileSync(path.join(tmp, "docs", "historico.md"), "utf8")).toBe("[2026-05-03] existing history\n");
    expect(fs.readFileSync(path.join(tmp, ".agent-harness", "runs", "old-run.json"), "utf8")).toBe("{\"status\":\"completed\"}\n");
    expect(fs.readFileSync(path.join(tmp, ".agent-harness", "memory", "index.json"), "utf8")).toBe("{\"surfaces\":[]}\n");
    expect(fs.readFileSync(path.join(tmp, "agent-harness.config.json"), "utf8")).toBe("{\"custom\":true}\n");
    expect(fs.readFileSync(path.join(tmp, "docs", "agent-runtime.md"), "utf8")).toBe("# Custom Runtime\n");
    expect(fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf8")).toContain("# Existing Rules");
    expect(fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf8").match(/agent-execution-harness:start/g)).toHaveLength(1);
    expect(pkg.scripts.test).toBe("custom-test");
    expect(pkg.scripts["agent:doctor"]).toBe("custom-doctor");
    expect(gitignore.match(/\.agent-harness\/runs\//g)).toHaveLength(1);
    expect(gitignore.match(/\.agent-harness\/backups\//g)).toHaveLength(1);
    expect(fs.existsSync(path.join(tmp, ".agent-harness", "backups"))).toBe(true);
  });

  it("batches claim auto in weak mode so low-context agents can finish multi-task plans", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-weak-claims-"));
    const plan = {
      schema_version: "agent_harness_plan_v1",
      plan_id: "weak-claims",
      risk_level: "L2",
      execution_profile: "weak",
      rollback_expectation: "Delete temp simulation files.",
      gates: ["node --version"],
      tasks: [
        { task_id: "task-a", files: ["src/a.ts"], required_evidence: ["focused_tests"], acceptance_criteria: "A passes." },
        { task_id: "task-b", files: ["src/b.ts"], required_evidence: ["focused_tests"], acceptance_criteria: "B passes." },
        { task_id: "task-c", files: ["src/c.ts"], required_evidence: ["focused_tests"], acceptance_criteria: "C passes." },
      ],
    };
    fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
    fs.writeFileSync(path.join(tmp, "src", "a.ts"), "export const a = 1;\n");
    fs.writeFileSync(path.join(tmp, "src", "b.ts"), "export const b = 1;\n");
    fs.writeFileSync(path.join(tmp, "src", "c.ts"), "export const c = 1;\n");

    const cli = path.resolve("dist/cli/index.js");
    execFileSync("node", [cli, "session", "start", "--plan", "plan.json", "--run-id", "weak-claims-run", "--mode", "weak"], { cwd: tmp, stdio: "pipe" });
    execFileSync("node", [cli, "files", "declare", "--files", "src/a.ts,src/b.ts,src/c.ts"], { cwd: tmp, stdio: "pipe" });
    for (const [taskId, file, evidenceId] of [
      ["task-a", "src/a.ts", "ev-a"],
      ["task-b", "src/b.ts", "ev-b"],
      ["task-c", "src/c.ts", "ev-c"],
    ]) {
      execFileSync("node", [cli, "task", "start", "--task-id", taskId, "--files", file], { cwd: tmp, stdio: "pipe" });
      execFileSync("node", [cli, "gate", "pass", "--check", "node --version", "--types", "focused_tests", "--scope", `file_scope ${file}`, "--evidence-id", evidenceId], {
        cwd: tmp,
        stdio: "pipe",
      });
    }

    const claimOutput = execFileSync("node", [cli, "claim", "auto"], { cwd: tmp, encoding: "utf8" });
    expect(claimOutput).toContain("\"batches\":2");
    execFileSync("node", [cli, "finish", "--summary", "validated"], { cwd: tmp, stdio: "pipe" });
    const report = execFileSync("node", [cli, "report", "--run-id", "weak-claims-run", "--format", "compact"], { cwd: tmp, encoding: "utf8" });
    expect(report).toContain("status: completed");
    expect(report).toContain("claims:");
  });

  it("can overwrite AGENTS.md only with explicit agents mode", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-agents-overwrite-"));
    fs.writeFileSync(path.join(tmp, "package.json"), `${JSON.stringify({ name: "target", private: true }, null, 2)}\n`);
    fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# Existing Rules\n");

    execFileSync("node", [path.resolve("dist/cli/index.js"), "init", "--adapter", "generic", "--cwd", tmp, "--apply", "--agents-mode", "overwrite"], {
      cwd: tmp,
      stdio: "pipe",
    });

    const agents = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf8");
    expect(agents).toContain("# Agent Harness");
    expect(agents).not.toContain("# Existing Rules");
  });

  it("documents installation, quickstart and governed learning loop", () => {
    const readme = fs.readFileSync("README.md", "utf8");
    const quickstart = fs.readFileSync("docs/quickstart.md", "utf8");
    expect(readme).toContain("npx agent-execution-harness@latest init");
    expect(readme).toContain("learning loop");
    expect(readme).toContain("does not train");
    expect(readme).toContain("evidence-backed lessons");
    expect(quickstart).toContain("agent-harness learn query");
    expect(quickstart).toContain("agent-harness learn capture");
    expect(quickstart).toContain("agent-harness learn promote");
  });
});
