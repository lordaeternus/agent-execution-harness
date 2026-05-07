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
    const weakNext = JSON.parse(execFileSync("node", [bin, "next", "--mode", "weak"], { cwd: tmp, encoding: "utf8" }));
    expect(weakNext.data.action).toBe("task start");
    expect(weakNext.data.required_evidence).toBeUndefined();
    const exactNext = JSON.parse(execFileSync("node", [bin, "next", "--mode", "weak", "--exact"], { cwd: tmp, encoding: "utf8" }));
    expect(exactNext.data.exact).toMatchObject({ do_now: "run_exact_command", stop_if: "exit_code_not_zero" });
    expect(exactNext.data.exact.command).toContain("agent-harness task start --task-id basic-task");
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

  it("guides a weak agent with exact next commands", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-exact-"));
    fs.copyFileSync("tests/fixtures/plans/basic-plan.json", path.join(tmp, "plan.json"));
    fs.writeFileSync(path.join(tmp, "created.txt"), "ok");
    execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "exact-smoke", "--mode", "weak"], { cwd: tmp });
    let next = JSON.parse(execFileSync("node", [bin, "next", "--exact"], { cwd: tmp, encoding: "utf8" }));
    expect(next.data.exact.command).toBe('agent-harness files declare --files "created.txt"');
    execFileSync("node", [bin, "files", "declare", "--files", "created.txt"], { cwd: tmp });
    next = JSON.parse(execFileSync("node", [bin, "next", "--exact"], { cwd: tmp, encoding: "utf8" }));
    expect(next.data.exact.command).toContain("agent-harness task start --task-id basic-task");
    execFileSync("node", [bin, "task", "start", "--task-id", "basic-task", "--files", "created.txt"], { cwd: tmp });
    next = JSON.parse(execFileSync("node", [bin, "next", "--exact"], { cwd: tmp, encoding: "utf8" }));
    expect(next.data.exact.command).toContain("agent-harness verify --task-id basic-task");
    execFileSync("node", [bin, "verify", "--task-id", "basic-task", "--type", "focused_tests", "--cmd", "node --version"], { cwd: tmp });
    next = JSON.parse(execFileSync("node", [bin, "next", "--exact"], { cwd: tmp, encoding: "utf8" }));
    expect(next.data.exact.command).toBe("agent-harness claim auto");
    execFileSync("node", [bin, "claim", "auto"], { cwd: tmp });
    next = JSON.parse(execFileSync("node", [bin, "next", "--exact"], { cwd: tmp, encoding: "utf8" }));
    expect(next.data.exact.command).toBe('agent-harness finish --summary "validated"');
    execFileSync("node", [bin, "finish", "--summary", "validated"], { cwd: tmp });
    const report = execFileSync("node", [bin, "report", "--run-id", "exact-smoke", "--format", "compact"], { cwd: tmp, encoding: "utf8" });
    expect(report).toContain("status: completed");
  });

  it("reports dependency waves and guides only unblocked tasks", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-dependency-"));
    fs.copyFileSync("tests/fixtures/plans/dependency-plan.json", path.join(tmp, "plan.json"));
    fs.writeFileSync(path.join(tmp, "foundation.txt"), "ok");
    fs.writeFileSync(path.join(tmp, "dependent.txt"), "ok");

    const waves = JSON.parse(execFileSync("node", [bin, "plan", "waves", "--plan", "plan.json"], { cwd: tmp, encoding: "utf8" }));
    expect(waves.status).toBe("success");
    expect(waves.data.waves).toEqual([{ wave: 1, task_ids: ["foundation"] }, { wave: 2, task_ids: ["dependent"] }]);

    execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "dependency-smoke", "--mode", "weak"], { cwd: tmp });
    execFileSync("node", [bin, "files", "declare", "--files", "foundation.txt,dependent.txt"], { cwd: tmp });
    let next = JSON.parse(execFileSync("node", [bin, "next", "--exact"], { cwd: tmp, encoding: "utf8" }));
    expect(next.data.task_id).toBe("foundation");
    expect(next.data.exact.command).toContain("task start --task-id foundation");
    expect(next.data.blocked_tasks).toEqual([{ task_id: "dependent", blocked_by: ["foundation"] }]);
    expect(() => execFileSync("node", [bin, "task", "start", "--task-id", "dependent", "--files", "dependent.txt"], { cwd: tmp, stdio: "pipe" })).toThrow();

    const micro = JSON.parse(execFileSync("node", [bin, "next", "--exact", "--micro"], { cwd: tmp, encoding: "utf8" }));
    expect(Object.keys(micro).sort()).toEqual(["blocked_tasks", "command", "state", "status", "stop_if", "task_id"]);
    expect(micro).toMatchObject({
      status: "success",
      state: "task_start",
      task_id: "foundation",
      stop_if: "exit_code_not_zero",
      blocked_tasks: [{ task_id: "dependent", blocked_by: ["foundation"] }],
    });
    expect(micro.command).toContain("task start --task-id foundation");
    expect(JSON.stringify(micro).length).toBeLessThan(JSON.stringify(next).length);

    execFileSync("node", [bin, "task", "start", "--task-id", "foundation", "--files", "foundation.txt"], { cwd: tmp });
    execFileSync("node", [bin, "verify", "--task-id", "foundation", "--type", "focused_tests", "--cmd", "node --version"], { cwd: tmp });
    next = JSON.parse(execFileSync("node", [bin, "next", "--exact"], { cwd: tmp, encoding: "utf8" }));
    expect(next.data.task_id).toBe("dependent");
    expect(next.data.exact.command).toContain("task start --task-id dependent");
  });

  it("guides a strict session with structured exact verify commands", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-strict-exact-"));
    fs.copyFileSync("tests/fixtures/plans/weak-exact-plan.json", path.join(tmp, "plan.json"));
    fs.writeFileSync(path.join(tmp, "created.txt"), "ok");
    execFileSync("git", ["init"], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "add", "plan.json", "created.txt"], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "baseline"], { cwd: tmp, stdio: "pipe" });
    execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "strict-exact", "--mode", "strict"], { cwd: tmp });
    execFileSync("node", [bin, "files", "declare", "--files", "created.txt"], { cwd: tmp });
    execFileSync("node", [bin, "task", "start", "--task-id", "weak-exact-task", "--files", "created.txt"], { cwd: tmp });
    const next = JSON.parse(execFileSync("node", [bin, "next", "--exact"], { cwd: tmp, encoding: "utf8" }));
    expect(next.data.exact.command).toContain("--exec \"node\"");
    expect(next.data.exact.command).toContain("--args-json \"[\\\"--version\\\"]\"");
    expect(next.data.exact.command).not.toContain("--cmd");
    const verified = JSON.parse(execFileSync("node", [bin, "verify", "--task-id", "weak-exact-task", "--type", "focused_tests", "--exec", "node", "--args-json", "[\"--version\"]"], { cwd: tmp, encoding: "utf8" }));
    expect(verified.status).toBe("success");
  });

  it("returns compact repair hints for failing verify commands", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-verify-repair-"));
    fs.copyFileSync("tests/fixtures/plans/basic-plan.json", path.join(tmp, "plan.json"));
    fs.writeFileSync(path.join(tmp, "created.txt"), "ok");
    execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "repair-smoke", "--mode", "weak"], { cwd: tmp });
    execFileSync("node", [bin, "files", "declare", "--files", "created.txt"], { cwd: tmp });
    execFileSync("node", [bin, "task", "start", "--task-id", "basic-task", "--files", "created.txt"], { cwd: tmp });
    const failingCommand = `${JSON.stringify(process.execPath)} -e ${JSON.stringify("process.exit(1)")}`;
    const output = execFileSync("node", [bin, "verify", "--task-id", "basic-task", "--type", "focused_tests", "--cmd", failingCommand], { cwd: tmp, encoding: "utf8" });
    const parsed = JSON.parse(output);
    expect(parsed.status).toBe("warning");
    expect(parsed.data.repair_hint.stop_after_attempts).toBe(3);
    expect(parsed.data.learning_hint).toBeUndefined();
    const runFile = path.join(tmp, ".agent-harness/runs/repair-smoke.full.json");
    const state = JSON.parse(fs.readFileSync(runFile, "utf8"));
    state.status = "in_progress";
    state.phase = "gate";
    state.current_task_id = "basic-task";
    state.pending_gate = null;
    state.tasks[0].status = "in_progress";
    fs.writeFileSync(runFile, `${JSON.stringify(state, null, 2)}\n`);
    fs.writeFileSync(path.join(tmp, ".agent-harness/runs/repair-smoke.json"), `${JSON.stringify(state, null, 2)}\n`);
    const repeated = JSON.parse(execFileSync("node", [bin, "verify", "--task-id", "basic-task", "--type", "focused_tests", "--cmd", failingCommand], { cwd: tmp, encoding: "utf8" }));
    expect(repeated.data.learning_hint).toContain("repeated_failure");
    expect(repeated.data.learning_hint.length).toBeLessThanOrEqual(180);
    expect(repeated.next_actions.join(" ")).toContain("learn query");
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

  it("returns structured repair hints for operational ordering errors", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-order-repair-"));
    fs.copyFileSync("tests/fixtures/plans/basic-plan.json", path.join(tmp, "plan.json"));
    execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "order-repair", "--mode", "weak"], { cwd: tmp });
    const output = tryCli(["claim", "auto"], tmp);
    expect(output.status).toBe("error");
    expect(output.data.repair_hint.kind).toBe("premature_claim");
  });

  it("blocks finish when diff contains files outside the plan", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-scope-"));
    fs.copyFileSync("tests/fixtures/plans/basic-plan.json", path.join(tmp, "plan.json"));
    fs.writeFileSync(path.join(tmp, "created.txt"), "ok");
    execFileSync("git", ["init"], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "add", "plan.json", "created.txt"], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "baseline"], { cwd: tmp, stdio: "pipe" });
    execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "scope-smoke", "--mode", "weak"], { cwd: tmp });
    execFileSync("node", [bin, "files", "declare", "--files", "created.txt"], { cwd: tmp });
    execFileSync("node", [bin, "task", "start", "--task-id", "basic-task", "--files", "created.txt"], { cwd: tmp });
    execFileSync("node", [bin, "verify", "--task-id", "basic-task", "--type", "focused_tests", "--cmd", "node --version"], { cwd: tmp });
    execFileSync("node", [bin, "claim", "auto"], { cwd: tmp });
    fs.writeFileSync(path.join(tmp, "unexpected.txt"), "bad");
    const output = tryCli(["finish", "--summary", "validated"], tmp);
    expect(output.status).toBe("error");
    expect(output.data.repair_hint.kind).toBe("unexpected_file_changed");
  });

  it("runs codebase memory map commands", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-map-"));
    fs.mkdirSync(path.join(tmp, "src/auth"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src/auth/session.ts"), "export const session = true;\n");
    const init = execFileSync("node", [bin, "map", "init"], { cwd: tmp, encoding: "utf8" });
    expect(init).toContain("memory init");
    const query = execFileSync("node", [bin, "map", "query", "--surface", "auth"], { cwd: tmp, encoding: "utf8" });
    expect(query).toContain("auth memory");
    const compactQuery = JSON.parse(execFileSync("node", [bin, "map", "query", "--surface", "auth", "--compact", "--max-files", "1"], { cwd: tmp, encoding: "utf8" }));
    expect(compactQuery.files).toHaveLength(1);
    expect(compactQuery).not.toHaveProperty("source_files");
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

  it("runs governed learning memory commands", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-learn-"));
    fs.mkdirSync(path.join(tmp, "src/auth"), { recursive: true });
    fs.mkdirSync(path.join(tmp, ".agent-harness/runs"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src/auth/session.ts"), "export const session = true;\n");
    fs.writeFileSync(path.join(tmp, ".agent-harness/runs/auth.full.json"), "{}\n");
    const capture = execFileSync(
      "node",
      [
        bin,
        "learn",
        "capture",
        "--lesson-id",
        "auth-cli-lesson",
        "--surface",
        "auth",
        "--kind",
        "failure_pattern",
        "--summary",
        "Auth CLI lesson proves that future session edits should verify authorization guards before final report.",
        "--files",
        "src/auth/session.ts",
        "--evidence-ref",
        ".agent-harness/runs/auth.full.json",
        "--failure-signature",
        "auth guard verification failed in CLI smoke",
      ],
      { cwd: tmp, encoding: "utf8" },
    );
    expect(capture).toContain("lesson captured");
    expect(execFileSync("node", [bin, "learn", "validate", "--lesson-id", "auth-cli-lesson"], { cwd: tmp, encoding: "utf8" })).toContain("lesson validated");
    expect(execFileSync("node", [bin, "learn", "promote", "--lesson-id", "auth-cli-lesson"], { cwd: tmp, encoding: "utf8" })).toContain("lesson promoted");
    const query = execFileSync("node", [bin, "learn", "query", "--surface", "auth", "--top-k", "3"], { cwd: tmp, encoding: "utf8" });
    expect(query).toContain("learning query");
    expect(query).toContain("auth-cli-lesson");
    const compactQuery = JSON.parse(execFileSync("node", [bin, "learn", "query", "--surface", "auth", "--top-k", "3", "--files", "src/auth/session.ts", "--failure-signature", "auth guard", "--compact"], { cwd: tmp, encoding: "utf8" }));
    expect(compactQuery.lessons[0]).toMatchObject({ kind: "failure_pattern", files: ["src/auth/session.ts"], confidence: "medium" });
    expect(compactQuery.lessons[0]).not.toHaveProperty("evidence_refs");
    expect(compactQuery.lessons[0]).not.toHaveProperty("file_hashes");
    execFileSync(
      "node",
      [
        bin,
        "learn",
        "capture",
        "--lesson-id",
        "auth-low-confidence",
        "--surface",
        "auth",
        "--kind",
        "verification_rule",
        "--summary",
        "Auth low confidence lesson should trigger compact audit guidance without deleting memory.",
        "--files",
        "src/auth/session.ts",
        "--evidence-ref",
        ".agent-harness/runs/auth.full.json",
        "--confidence",
        "low",
      ],
      { cwd: tmp, encoding: "utf8" },
    );
    const health = JSON.parse(execFileSync("node", [bin, "learn", "health", "--compact"], { cwd: tmp, encoding: "utf8" }));
    expect(health.learning_health).toBe("needs_audit");
    expect(health.next_action).toBe("learn audit --compact");
    const beforeAudit = fs.readFileSync(path.join(tmp, ".agent-harness/learning/lessons/auth-low-confidence.json"), "utf8");
    const audit = JSON.parse(execFileSync("node", [bin, "learn", "audit", "--compact"], { cwd: tmp, encoding: "utf8" }));
    const afterAudit = fs.readFileSync(path.join(tmp, ".agent-harness/learning/lessons/auth-low-confidence.json"), "utf8");
    expect(audit.learning_audit).toBe("needs_attention");
    expect(audit.candidates.low_confidence).toContain("auth-low-confidence");
    expect(beforeAudit).toBe(afterAudit);
    expect(execFileSync("node", [bin, "learn", "prune"], { cwd: tmp, encoding: "utf8" })).toContain("learning prune");
    expect(fs.existsSync(path.join(tmp, ".agent-harness/learning/lessons/auth-cli-lesson.json"))).toBe(true);
  });

  it("surfaces compact learning health guidance during session start", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-session-health-"));
    fs.copyFileSync("tests/fixtures/plans/basic-plan.json", path.join(tmp, "plan.json"));
    fs.mkdirSync(path.join(tmp, "src/auth"), { recursive: true });
    fs.mkdirSync(path.join(tmp, ".agent-harness/runs"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src/auth/session.ts"), "export const session = true;\n");
    fs.writeFileSync(path.join(tmp, ".agent-harness/runs/auth.full.json"), "{}\n");
    execFileSync(
      "node",
      [
        bin,
        "learn",
        "capture",
        "--lesson-id",
        "auth-session-low",
        "--surface",
        "auth",
        "--kind",
        "verification_rule",
        "--summary",
        "Auth session low confidence lesson should make session start ask the agent for compact audit.",
        "--files",
        "src/auth/session.ts",
        "--evidence-ref",
        ".agent-harness/runs/auth.full.json",
        "--confidence",
        "low",
      ],
      { cwd: tmp, stdio: "pipe" },
    );
    const start = JSON.parse(execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "health-session"], { cwd: tmp, encoding: "utf8" }));
    expect(start.next_actions).toContain("learn audit --compact");
    expect(start.data.learning_health.learning_health).toBe("needs_audit");
  });

  it("reports harnessability, controls and plan warnings", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-doctor-controls-"));
    fs.mkdirSync(path.join(tmp, "docs"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "package.json"), `${JSON.stringify({ name: "target", scripts: { lint: "eslint .", "test:run": "vitest run", typecheck: "tsc --noEmit" } }, null, 2)}\n`);
    fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# Rules\n");
    fs.writeFileSync(path.join(tmp, "agent-harness.config.json"), "{}\n");
    fs.writeFileSync(path.join(tmp, "docs", "agent-runtime.md"), "# Runtime\n");
    fs.writeFileSync(path.join(tmp, ".gitignore"), ".agent-harness/runs/\n");

    const doctor = JSON.parse(execFileSync("node", [bin, "doctor", "--harnessability", "--controls", "--cwd", tmp], { encoding: "utf8" }));
    expect(doctor.data.harnessability.score).toBeGreaterThan(50);
    expect(doctor.data.controls.map((control: { id: string }) => control.id)).toContain("scope_guard");

    const plan = {
      schema_version: "agent_harness_plan_v1",
      plan_id: "l3-warning",
      risk_level: "L3",
      rollback_expectation: "Revert the touched files and rerun the focused validation gate.",
      gates: ["pnpm test"],
      tasks: [{ task_id: "task-a", files: ["src/a.ts"], acceptance_criteria: "Run `pnpm test` and confirm task A behavior passes." }],
    };
    fs.writeFileSync(path.join(tmp, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
    const lint = JSON.parse(execFileSync("node", [bin, "plan-lint", "--plan", "plan.json"], { cwd: tmp, encoding: "utf8" }));
    expect(lint.status).toBe("success");
    expect(lint.data.warnings.join("\n")).toContain("L3 task should declare required_evidence");
  });

  it("reports repeated failure steering and validates approved fixtures", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-steering-cli-"));
    fs.mkdirSync(path.join(tmp, ".agent-harness/runs"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "package.json"), `${JSON.stringify({ name: "target", scripts: {} }, null, 2)}\n`);
    fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# Rules\n");
    fs.writeFileSync(path.join(tmp, "agent-harness.config.json"), "{}\n");
    fs.writeFileSync(path.join(tmp, ".gitignore"), ".agent-harness/runs/\n");
    for (const runId of ["one", "two", "three"]) {
      fs.writeFileSync(
        path.join(tmp, ".agent-harness/runs", `${runId}.json`),
        `${JSON.stringify({
          schema_version: "agent_harness_run_v1",
          run_id: runId,
          mode: "weak",
          status: "halt",
          phase: "halt",
          plan: {
            schema_version: "agent_harness_plan_v1",
            plan_id: "steering-plan",
            risk_level: "L2",
            rollback_expectation: "Revert.",
            gates: ["node --version"],
            tasks: [{ task_id: "task-a", acceptance_criteria: "A passes." }],
          },
          tasks: [{ task_id: "task-a", status: "blocked", acceptance_criteria: "A passes.", evidence_ids: [] }],
          declared_files: ["src/a.ts"],
          unexpected_files: ["src/outside.ts"],
          current_task_id: null,
          pending_gate: null,
          evidence: [],
          claims: [],
          verified_claims: [],
          errors: ["unexpected file changed"],
          final_report: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, null, 2)}\n`,
      );
    }
    const steering = JSON.parse(execFileSync("node", [bin, "doctor", "--steering", "--cwd", tmp], { encoding: "utf8" }));
    expect(steering.data.steering.suggestions[0].key).toBe("unexpected_file_changed");

    const fixtureOutput = JSON.parse(execFileSync("node", [bin, "fixtures", "validate", "--file", "tests/fixtures/approved/basic-approved-fixture.json"], { encoding: "utf8" }));
    expect(fixtureOutput.status).toBe("success");
  });

  it("generates and validates weak worker handoff output", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-handoff-"));
    fs.copyFileSync("tests/fixtures/plans/weak-exact-plan.json", path.join(tmp, "plan.json"));
    const handoff = JSON.parse(execFileSync("node", [bin, "handoff", "--plan", "plan.json", "--task-id", "weak-exact-task"], { cwd: tmp, encoding: "utf8" }));
    expect(handoff.status).toBe("success");
    expect(handoff.data.packet.allowed_files).toEqual(["created.txt"]);
    expect(handoff.data.prompt).toContain("Return JSON only");
    const compactHandoff = JSON.parse(execFileSync("node", [bin, "handoff", "--compact", "--plan", "plan.json", "--task-id", "weak-exact-task"], { cwd: tmp, encoding: "utf8" }));
    expect(compactHandoff.task_id).toBe("weak-exact-task");
    expect(compactHandoff.prompt).toContain("Return JSON only");
    expect(compactHandoff).not.toHaveProperty("packet");
    expect(JSON.stringify(compactHandoff).length).toBeLessThan(JSON.stringify(handoff).length);

    fs.writeFileSync(path.join(tmp, "worker-output.json"), `${JSON.stringify({
      status: "done",
      files_changed: ["created.txt"],
      evidence: [{ command: "node --version", result: "pass", output_excerpt: "v22.0.0" }],
      residual_risk: "none",
    })}\n`);
    const valid = JSON.parse(execFileSync("node", [bin, "handoff", "validate", "--plan", "plan.json", "--task-id", "weak-exact-task", "--input", "worker-output.json"], { cwd: tmp, encoding: "utf8" }));
    expect(valid.status).toBe("success");

    fs.writeFileSync(path.join(tmp, "bad-output.json"), `${JSON.stringify({
      status: "done",
      files_changed: ["unexpected.txt"],
      evidence: [],
      residual_risk: "none",
    })}\n`);
    expect(() => execFileSync("node", [bin, "handoff", "validate", "--plan", "plan.json", "--task-id", "weak-exact-task", "--input", "bad-output.json"], { cwd: tmp, stdio: "pipe" })).toThrow();
  });
});

function tryCli(args: string[], cwd: string): { status: string; data: { repair_hint: { kind: string; stop_after_attempts: number } } } {
  try {
    execFileSync("node", [bin, ...args], { cwd, encoding: "utf8", stdio: "pipe" });
    throw new Error("expected command to fail");
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString("utf8") ?? "";
    return JSON.parse(stderr);
  }
}
