import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const bin = path.resolve("dist/cli/index.js");

describe("cli integration", () => {
  it("prints a plain version for humans", () => {
    const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
    expect(execFileSync("node", [bin, "--version"], { encoding: "utf8" }).trim()).toBe(version);
    expect(execFileSync("node", [bin, "version"], { encoding: "utf8" }).trim()).toBe(version);
  });

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
    execFileSync("git", ["init"], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "add", "plan.json", "created.txt"], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "baseline"], { cwd: tmp, stdio: "pipe" });
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
    expect(next.data.exact.command).toBe("agent-harness finish --check");
    const checked = JSON.parse(execFileSync("node", [bin, "finish", "--check"], { cwd: tmp, encoding: "utf8" }));
    expect(checked.status).toBe("success");
    expect(checked.next_actions).toEqual(['finish --summary "validated"']);
    execFileSync("node", [bin, "finish", "--summary", "validated"], { cwd: tmp });
    const report = execFileSync("node", [bin, "report", "--run-id", "exact-smoke", "--format", "compact"], { cwd: tmp, encoding: "utf8" });
    expect(report).toContain("status: completed");
  });

  it("checks finish readiness without mutating a pending run", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-finish-check-"));
    fs.copyFileSync("tests/fixtures/plans/basic-plan.json", path.join(tmp, "plan.json"));
    execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "finish-check-smoke"], { cwd: tmp });
    const runFile = path.join(tmp, ".agent-harness/runs/finish-check-smoke.full.json");
    const before = fs.readFileSync(runFile, "utf8");
    const blocked = tryCli(["finish", "--check"], tmp);

    expect(blocked.status).toBe("error");
    expect(blocked.errors.join("\n")).toContain("pending_tasks");
    expect(blocked.next_actions).toEqual(["next --exact"]);
    expect(fs.readFileSync(runFile, "utf8")).toBe(before);
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

  it("imports an atomic markdown backlog into an executable plan", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-plan-import-"));
    fs.writeFileSync(
      path.join(tmp, "backlog.md"),
      [
        "- [ ] **Tarefa [1]**: Criar arquivo em `created.txt`.",
        "  - **Dependência:** Nenhum",
        "  - **DoD:** `node --version` passa.",
      ].join("\n"),
    );
    fs.writeFileSync(path.join(tmp, "created.txt"), "ok");

    const outputPlan = "plans with space/plan file.json";
    const imported = JSON.parse(execFileSync("node", [bin, "plan", "import", "--from", "backlog.md", "--out", outputPlan, "--plan-id", "import-demo", "--risk", "L2", "--rollback", "Delete generated files."], { cwd: tmp, encoding: "utf8" }));
    expect(imported.status).toBe("success");
    expect(imported.next_actions).toContain('agent-harness plan-lint --plan "plans with space/plan file.json"');
    expect(imported.next_actions).toContain('agent-harness session start --plan "plans with space/plan file.json" --run-id import-demo --mode weak');
    expect(fs.existsSync(path.join(tmp, outputPlan))).toBe(true);
    execFileSync("node", [bin, "plan-lint", "--plan", outputPlan], { cwd: tmp, stdio: "pipe" });
    execFileSync("node", [bin, "session", "start", "--plan", outputPlan, "--run-id", "import-demo", "--mode", "weak"], { cwd: tmp, stdio: "pipe" });
    const next = JSON.parse(execFileSync("node", [bin, "next", "--exact", "--micro"], { cwd: tmp, encoding: "utf8" }));
    expect(next.command).toContain("agent-harness files declare");
  });

  it("imports an approved chat plan from stdin without needing an intermediate file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-plan-import-stdin-"));
    const markdown = [
      "- [ ] **Tarefa [1]**: Criar arquivo em `created.txt`.",
      "  - **Dependência:** Nenhum",
      "  - **DoD:** `node --version` passa.",
    ].join("\n");

    const imported = JSON.parse(
      execFileSync(
        "node",
        [bin, "plan", "import", "--from", "-", "--out", "plan.json", "--plan-id", "chat-plan", "--risk", "L2", "--rollback", "Delete generated files."],
        { cwd: tmp, encoding: "utf8", input: markdown },
      ),
    );

    expect(imported.status).toBe("success");
    expect(imported.summary).toBe("markdown backlog imported");
    expect(imported.data.input_source).toBe("stdin");
    expect(fs.existsSync(path.join(tmp, "plan.json"))).toBe(true);
    execFileSync("node", [bin, "plan-lint", "--plan", "plan.json"], { cwd: tmp, stdio: "pipe" });
  });

  it("imports a simple feature list from markdown and stdin", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-feature-list-"));
    const markdown = [
      "- Add finish check in `src/cli/macro.ts`",
      "  - **DoD:** `node --version` passa.",
      "- Document finish check in `README.md`",
      "  - **Dependência:** Feature 1",
      "  - **DoD:** README mentions finish --check.",
    ].join("\n");
    fs.writeFileSync(path.join(tmp, "features.md"), markdown);

    const fromFile = JSON.parse(execFileSync("node", [bin, "plan", "import", "--kind", "feature-list", "--from", "features.md", "--out", "feature-plan.json", "--plan-id", "feature-list", "--risk", "L2", "--rollback", "Revert changed files.", "--gate", "node --version"], { cwd: tmp, encoding: "utf8" }));
    expect(fromFile.summary).toBe("feature list imported");
    expect(fromFile.data.kind).toBe("feature-list");
    execFileSync("node", [bin, "plan-lint", "--plan", "feature-plan.json"], { cwd: tmp, stdio: "pipe" });

    const fromStdin = JSON.parse(execFileSync("node", [bin, "plan", "import", "--kind", "feature-list", "--from", "-", "--out", "stdin-plan.json", "--plan-id", "feature-list-stdin", "--risk", "L2", "--rollback", "Revert changed files.", "--gate", "node --version"], { cwd: tmp, encoding: "utf8", input: markdown }));
    expect(fromStdin.status).toBe("success");
    execFileSync("node", [bin, "plan-lint", "--plan", "stdin-plan.json"], { cwd: tmp, stdio: "pipe" });
  });

  it("does not overwrite an existing imported plan unless overwrite is explicit", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-plan-import-no-overwrite-"));
    const existingPlan = JSON.stringify({ existing: true }, null, 2);
    fs.writeFileSync(path.join(tmp, "plan.json"), `${existingPlan}\n`);
    fs.writeFileSync(
      path.join(tmp, "backlog.md"),
      [
        "- [ ] **Tarefa [1]**: Criar arquivo em `created.txt`.",
        "  - **Dependência:** Nenhum",
        "  - **DoD:** `node --version` passa.",
      ].join("\n"),
    );

    const blocked = tryCli(["plan", "import", "--from", "backlog.md", "--out", "plan.json", "--plan-id", "safe-import", "--risk", "L2", "--rollback", "Delete generated files."], tmp);
    expect(blocked.status).toBe("error");
    expect(blocked.summary).toContain("already exists");
    expect(fs.readFileSync(path.join(tmp, "plan.json"), "utf8")).toBe(`${existingPlan}\n`);

    const overwritten = JSON.parse(execFileSync("node", [bin, "plan", "import", "--from", "backlog.md", "--out", "plan.json", "--plan-id", "safe-import", "--risk", "L2", "--rollback", "Delete generated files.", "--overwrite"], { cwd: tmp, encoding: "utf8" }));
    expect(overwritten.status).toBe("success");
    expect(JSON.parse(fs.readFileSync(path.join(tmp, "plan.json"), "utf8")).plan_id).toBe("safe-import");
  });

  it("fails plan import before writing compiler-invalid plans", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-plan-import-invalid-"));
    fs.writeFileSync(
      path.join(tmp, "backlog.md"),
      [
        "- [ ] **Tarefa [1]**: Editar arquivos em `a.ts`, `b.ts`, `c.ts`, `d.ts`.",
        "  - **Dependência:** Nenhum",
        "  - **DoD:** `node --version` passa.",
      ].join("\n"),
    );

    const output = tryCli(["plan", "import", "--from", "backlog.md", "--out", "plan.json", "--plan-id", "invalid-import", "--risk", "L2", "--rollback", "Delete generated files."], tmp);
    expect(output.status).toBe("error");
    expect(output.summary).toBe("imported plan invalid");
    expect(JSON.stringify(output.errors)).toContain("too_many_files");
    expect(fs.existsSync(path.join(tmp, "plan.json"))).toBe(false);
  });

  it("guides agents to import a markdown backlog when session plan is missing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-missing-plan-"));
    const output = tryCli(["session", "start", "--run-id", "missing-plan"], tmp);
    expect(output.summary).toContain("No plan was provided.");
    expect(output.summary).toContain("plan import");
    expect(output.summary).toContain("--from -");
    expect(output.summary).toContain("plan-lint");
    expect(output.summary).toContain("session start --plan");
    expect(output.summary).not.toContain("recreate");
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
    fs.mkdirSync(path.join(tmp, "src", "client"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "package.json"), `${JSON.stringify({ name: "target", scripts: { lint: "eslint .", "test:run": "vitest run", typecheck: "tsc --noEmit" } }, null, 2)}\n`);
    fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# Rules\nSmallest surgical change with evidence and success criteria.\n");
    fs.writeFileSync(path.join(tmp, "src", "client", "view.ts"), "import { secret } from '../server/secret';\n");
    fs.writeFileSync(path.join(tmp, "agent-harness.config.json"), `${JSON.stringify({
      schema_version: "agent_harness_config_v1",
      artifact_dir: ".agent-harness/runs",
      product_paths: ["src/"],
      required_scripts: [],
      doctor_profile: "generic",
      command_policy: { deny: ["DROP"], strict_requires_allowed_command: true, strict_disallow_shell: true },
      architecture_rules: [{ id: "no_client_server", from: "src/client/*.ts", forbid_import: "../server/*" }],
    })}\n`);
    fs.writeFileSync(path.join(tmp, "docs", "agent-runtime.md"), "# Runtime\n");
    fs.writeFileSync(path.join(tmp, ".gitignore"), ".agent-harness/runs/\n");

    const humanDoctor = execFileSync("node", [bin, "doctor", "--harnessability", "--controls", "--cwd", tmp], { encoding: "utf8" });
    expect(humanDoctor).toContain("Agent Execution Harness doctor passed.");
    expect(humanDoctor).toContain("Harnessability score:");
    expect(humanDoctor).toContain("For JSON output:");
    const doctor = JSON.parse(execFileSync("node", [bin, "doctor", "--json", "--harnessability", "--controls", "--cwd", tmp], { encoding: "utf8" }));
    expect(doctor.data.harnessability.score).toBeGreaterThan(50);
    expect(doctor.data.controls.map((control: { id: string }) => control.id)).toContain("scope_guard");
    const coverageHuman = execFileSync("node", [bin, "doctor", "--coverage", "--cwd", tmp], { encoding: "utf8" });
    expect(coverageHuman).toContain("Coverage:");
    const coverage = JSON.parse(execFileSync("node", [bin, "doctor", "--json", "--coverage", "--cwd", tmp], { encoding: "utf8" }));
    expect(coverage.data.coverage.covered_controls).toContain("coding_discipline");
    const architectureHuman = execFileSync("node", [bin, "doctor", "--architecture", "--cwd", tmp], { encoding: "utf8" });
    expect(architectureHuman).toContain("Architecture:");
    const architecture = JSON.parse(execFileSync("node", [bin, "doctor", "--json", "--architecture", "--cwd", tmp], { encoding: "utf8" }));
    expect(architecture.data.architecture.violations[0].rule_id).toBe("no_client_server");
    const qualityHuman = execFileSync("node", [bin, "doctor", "--quality", "--cwd", tmp], { encoding: "utf8" });
    expect(qualityHuman).toContain("Quality:");
    const quality = JSON.parse(execFileSync("node", [bin, "doctor", "--json", "--quality", "--cwd", tmp], { encoding: "utf8" }));
    expect(quality.data.quality.signals.doctor_status).toBe("success");
    expect(quality.data.quality.status).not.toBe("blocked");
    const runtimeHuman = execFileSync("node", [bin, "doctor", "--runtime", "--cwd", tmp], { encoding: "utf8" });
    expect(runtimeHuman).toContain("Runtime:");
    const runtime = JSON.parse(execFileSync("node", [bin, "doctor", "--json", "--runtime", "--cwd", tmp], { encoding: "utf8" }));
    expect(runtime.data.runtime.mode).toBe("serial");
    expect(runtime.next_actions).toContain("use next --exact");

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
    const steering = JSON.parse(execFileSync("node", [bin, "doctor", "--json", "--steering", "--cwd", tmp], { encoding: "utf8" }));
    expect(steering.data.steering.suggestions[0].key).toBe("unexpected_file_changed");

    const fixtureOutput = JSON.parse(execFileSync("node", [bin, "fixtures", "validate", "--file", "tests/fixtures/approved/basic-approved-fixture.json"], { encoding: "utf8" }));
    expect(fixtureOutput.status).toBe("success");
  });

  it("reports dispatch batches with serial fallback and subagent packets", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-dispatch-"));
    fs.writeFileSync(
      path.join(tmp, "plan.json"),
      `${JSON.stringify({
        schema_version: "agent_harness_plan_v1",
        plan_id: "dispatch-cli",
        risk_level: "L2",
        rollback_expectation: "Delete dispatch CLI test files.",
        gates: ["node --version"],
        tasks: [
          {
            task_id: "task-a",
            acceptance_criteria: "Run `node --version` and pass task A.",
            files: ["a.txt"],
            allowed_commands: ["node --version"],
            parallel_safe: true,
          },
          {
            task_id: "task-b",
            acceptance_criteria: "Run `node --version` and pass task B.",
            files: ["b.txt"],
            allowed_commands: ["node --version"],
            parallel_safe: true,
          },
        ],
      }, null, 2)}\n`,
    );
    const serial = JSON.parse(execFileSync("node", [bin, "dispatch", "plan", "--plan", "plan.json"], { cwd: tmp, encoding: "utf8" }));
    expect(serial.data.batches[0].mode).toBe("serial");
    expect(serial.data.batches[0].tasks.map((item: { task_id: string }) => item.task_id)).toEqual(["task-a"]);

    const parallel = JSON.parse(execFileSync("node", [bin, "dispatch", "plan", "--plan", "plan.json", "--runtime", "subagents"], { cwd: tmp, encoding: "utf8" }));
    expect(parallel.data.batches[0].mode).toBe("parallel");
    expect(parallel.data.batches[0].tasks[0].packet.allowed_files).toEqual(["a.txt"]);
    expect(parallel.next_actions.join(" ")).not.toContain("dispatch validate");
    expect(parallel.next_actions.join(" ")).toContain("handoff validate");
    fs.writeFileSync(path.join(tmp, "agent-harness.config.json"), `${JSON.stringify({
      schema_version: "agent_harness_config_v1",
      artifact_dir: ".agent-harness/runs",
      product_paths: [],
      required_scripts: [],
      doctor_profile: "generic",
      command_policy: { deny: ["DROP"] },
      runtime_capabilities: { supports_subagents: true, max_parallel: 2 },
    }, null, 2)}\n`);
    const fromConfig = JSON.parse(execFileSync("node", [bin, "dispatch", "plan", "--plan", "plan.json"], { cwd: tmp, encoding: "utf8" }));
    expect(fromConfig.data.runtime_capability).toBe("subagents");
    expect(fromConfig.data.batches[0].mode).toBe("parallel");

    execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "dispatch-cli", "--mode", "standard"], { cwd: tmp });
    const next = JSON.parse(execFileSync("node", [bin, "dispatch", "next", "--batch", "--runtime", "subagents"], { cwd: tmp, encoding: "utf8" }));
    expect(next.data.batch.mode).toBe("parallel");
    expect(next.next_actions).toContain("spawn_subagents");
    expect(next.next_actions.join(" ")).not.toContain("dispatch validate");
    expect(next.next_actions.join(" ")).toContain("handoff validate");

    const runFile = path.join(tmp, ".agent-harness/runs/dispatch-cli.full.json");
    const state = JSON.parse(fs.readFileSync(runFile, "utf8"));
    state.phase = "gate";
    state.current_task_id = "task-a";
    state.tasks[0].status = "in_progress";
    state.updated_at = new Date().toISOString();
    fs.writeFileSync(runFile, `${JSON.stringify(state, null, 2)}\n`);
    fs.writeFileSync(path.join(tmp, ".agent-harness/runs/dispatch-cli.json"), `${JSON.stringify(state, null, 2)}\n`);

    const active = JSON.parse(execFileSync("node", [bin, "dispatch", "next", "--batch", "--runtime", "subagents"], { cwd: tmp, encoding: "utf8" }));
    expect(active.status).toBe("warning");
    expect(active.summary).toContain("task already in progress");
    expect(active.next_actions).toEqual(["next --exact --micro"]);
    expect(active.data.batch).toBeNull();
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
    expect(valid.next_actions.join(" ")).toContain("patch intake");

    fs.writeFileSync(path.join(tmp, "bad-output.json"), `${JSON.stringify({
      status: "done",
      files_changed: ["unexpected.txt"],
      evidence: [],
      residual_risk: "none",
    })}\n`);
    expect(() => execFileSync("node", [bin, "handoff", "validate", "--plan", "plan.json", "--task-id", "weak-exact-task", "--input", "bad-output.json"], { cwd: tmp, stdio: "pipe" })).toThrow();
  });

  it("validates and applies worker patches only inside task scope", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-patch-intake-"));
    fs.copyFileSync("tests/fixtures/plans/weak-exact-plan.json", path.join(tmp, "plan.json"));
    fs.writeFileSync(path.join(tmp, "created.txt"), "old\n");
    execFileSync("git", ["init"], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "add", "plan.json", "created.txt"], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "baseline"], { cwd: tmp, stdio: "pipe" });
    fs.writeFileSync(path.join(tmp, "worker.patch"), diffFor("created.txt", "old", "new"));
    fs.writeFileSync(path.join(tmp, "worker-output.json"), `${JSON.stringify({
      status: "done",
      files_changed: ["created.txt"],
      evidence: [{ command: "node --version", result: "pass", output_excerpt: "v22.0.0" }],
      residual_risk: "none",
      patch_file: "worker.patch",
    })}\n`);

    const accepted = JSON.parse(execFileSync("node", [bin, "patch", "intake", "--plan", "plan.json", "--task-id", "weak-exact-task", "--patch", "worker.patch", "--worker-output", "worker-output.json"], { cwd: tmp, encoding: "utf8" }));
    expect(accepted.status).toBe("success");
    expect(accepted.data).toMatchObject({ changed_files: ["created.txt"], applied: false });
    expect(fs.readFileSync(path.join(tmp, "created.txt"), "utf8")).toBe("old\n");

    const applied = JSON.parse(execFileSync("node", [bin, "patch", "intake", "--plan", "plan.json", "--task-id", "weak-exact-task", "--patch", "worker.patch", "--worker-output", "worker-output.json", "--apply"], { cwd: tmp, encoding: "utf8" }));
    expect(applied.status).toBe("success");
    expect(applied.data).toMatchObject({ changed_files: ["created.txt"], applied: true });
    expect(fs.readFileSync(path.join(tmp, "created.txt"), "utf8").replace(/\r\n/g, "\n")).toBe("new\n");

    fs.writeFileSync(path.join(tmp, "outside.patch"), diffFor("outside.txt", "old", "new"));
    const rejected = tryCli(["patch", "intake", "--plan", "plan.json", "--task-id", "weak-exact-task", "--patch", "outside.patch"], tmp);
    expect(rejected.status).toBe("error");
    expect(rejected.errors.join("\n")).toContain("patch changes file outside allowed_files: outside.txt");
  });

  it("rejects patch apply when git cannot check the patch context", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-patch-conflict-"));
    fs.copyFileSync("tests/fixtures/plans/weak-exact-plan.json", path.join(tmp, "plan.json"));
    fs.writeFileSync(path.join(tmp, "created.txt"), "different\n");
    execFileSync("git", ["init"], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "add", "plan.json", "created.txt"], { cwd: tmp, stdio: "pipe" });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "baseline"], { cwd: tmp, stdio: "pipe" });
    fs.writeFileSync(path.join(tmp, "worker.patch"), diffFor("created.txt", "old", "new"));

    const rejected = tryCli(["patch", "intake", "--plan", "plan.json", "--task-id", "weak-exact-task", "--patch", "worker.patch", "--apply"], tmp);
    expect(rejected.status).toBe("error");
    expect(rejected.summary).toContain("patch apply rejected");
    expect(rejected.errors.join("\n")).toContain("git apply --check failed");
    expect(fs.readFileSync(path.join(tmp, "created.txt"), "utf8")).toBe("different\n");
  });
});

function tryCli(args: string[], cwd: string): { status: string; summary: string; errors: string[]; next_actions: string[]; data: { repair_hint?: { kind: string; stop_after_attempts: number } } } {
  try {
    execFileSync("node", [bin, ...args], { cwd, encoding: "utf8", stdio: "pipe" });
    throw new Error("expected command to fail");
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString("utf8") ?? "";
    const stdout = (error as { stdout?: Buffer }).stdout?.toString("utf8") ?? "";
    return JSON.parse(stderr || stdout);
  }
}

function diffFor(file: string, before: string, after: string): string {
  return [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    "@@ -1 +1 @@",
    `-${before}`,
    `+${after}`,
    "",
  ].join("\n");
}
