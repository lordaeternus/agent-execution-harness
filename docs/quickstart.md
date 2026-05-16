# Quickstart

This guide is for someone who wants to install Agent Execution Harness in an existing project and start using it with an AI coding agent.

## Simple Installation

Copy and paste these commands inside your project.

## 1. Open Your Project Folder

Example:

```bash
cd C:\Projetos\my-app
```

Replace `C:\Projetos\my-app` with your real project path.

## 2. Preview First

```bash
npx agent-execution-harness@latest init --adapter generic --cwd .
```

This shows what the harness would install.

Preview mode should not change your project.

## 3. Install

```bash
npx agent-execution-harness@latest init --adapter generic --cwd . --apply --agents-mode append
```

This is the recommended install command.

It appends harness rules to `AGENTS.md` instead of replacing your current file.

## 4. Check The Setup

Run:

```bash
npx agent-execution-harness@latest doctor --harnessability --cwd .
```

Expected result:

```txt
Agent Execution Harness doctor passed.
Harnessability score: 90/100
```

If doctor reports errors, fix them before trusting the harness.

By default, install and doctor commands print human-readable messages. Use `--json` only for CI, scripts or automation.

## 5. Tell The Agent To Use It

Use this prompt. It intentionally names the real harness command so weaker agents do not need to guess:

```txt
Use Agent Execution Harness for approved plans, multi-step work, risky changes, and any task where you need to prove completion.

Harness command for this project:
pnpm agent:harness

Before executing, run:
pnpm agent:harness doctor --harnessability --cwd .

For L2/L3 tasks, run the harness automatically. Do not replace it with a generic test command unless the harness tells you to verify with that command.
Read docs/agent-runtime.md first.
Do not claim success unless the artifact is completed and includes evidence plus verified claims.
In the final answer, include run_id, artifact path, status, gates, evidence, verified claims, and rollback notes.
```

If your project does not use pnpm, replace only the script runner. For example:

```txt
Harness command for this project:
npx agent-execution-harness@latest
```

## AGENTS.md Modes

If your project already has `AGENTS.md`, choose one:

```bash
# safest: do not change AGENTS.md
npx agent-execution-harness@latest init --adapter generic --cwd . --apply --agents-mode skip

# recommended: add harness rules to AGENTS.md
npx agent-execution-harness@latest init --adapter generic --cwd . --apply --agents-mode append

# advanced: replace AGENTS.md after backup
npx agent-execution-harness@latest init --adapter generic --cwd . --apply --agents-mode overwrite
```

Use `append` if you are not sure.

## Stetix-Style Project

For a Stetix-style project, use:

```bash
npx agent-execution-harness@latest init --adapter stetix --cwd . --apply --agents-mode append
```

After install, tell the agent to use:

```txt
Harness command for this project:
pnpm agent:harness
```

## What To Ask The Agent

```txt
Create a plan for this bug.
```

```txt
Execute the approved plan using the harness.
```

```txt
Show the run_id, artifact path, status, evidence, verified claims, and rollback.
```

## Compact Agent Flow

You do not need to memorize this. It shows what the agent should run behind the scenes:

If the approved plan exists only as an atomic Markdown backlog, first convert it:

```bash
agent-harness plan import --from backlog.md --out plan.json --plan-id fix-login --risk L2 --rollback "Delete generated files."
agent-harness plan-lint --plan plan.json
```

The importer accepts only the atomic checklist format. Dependencies must be `Nenhum` or `Tarefa N`.

```bash
agent-harness session start --plan plan.json --run-id fix-login --summary "ctx"
agent-harness next
agent-harness files declare --files src/login.ts
agent-harness task start --task-id login-fix --files src/login.ts
agent-harness verify --task-id login-fix --type focused_tests --cmd "pnpm test"
agent-harness claim auto
agent-harness finish --summary "Login fix validated."
agent-harness report --run-id fix-login --format compact
```

If tasks depend on each other, add `depends_on` in the plan and preview safe execution order:

```bash
agent-harness plan waves --plan plan.json
agent-harness next --exact
```

For stricter execution with weaker or less trusted agents:

```bash
agent-harness session start --plan plan.json --run-id fix-login --mode strict
agent-harness verify --task-id login-fix --type focused_tests --exec pnpm --args-json "[\"test\"]"
```

In strict mode, the command must be listed in the task `allowed_commands`. Shell-style `--cmd` is blocked by default.

Optional handoff for DeepSeek, local models, junior agents, or another weak worker:

```bash
agent-harness handoff --plan plan.json --task-id login-fix
agent-harness handoff validate --plan plan.json --task-id login-fix --input worker-output.json
```

Paste the generated `data.prompt` into the worker. Keep what passes validation; repair or discard the rest.

Optional dispatch guidance for agents that may or may not have subagents:

```bash
agent-harness dispatch plan --plan plan.json
agent-harness dispatch plan --plan plan.json --runtime subagents
agent-harness dispatch next --batch --runtime subagents
```

Dispatch is runtime-agnostic. With `--runtime subagents`, it can return a parallel batch with one handoff packet per safe task. Without subagents, it falls back to one serial task, so agents can keep using the normal `next --exact` flow.

Dispatch does not spawn or validate workers itself. Save each worker JSON response and validate it with:

```bash
agent-harness handoff validate --plan plan.json --task-id task-id --input worker-output.json
```

The optional task `isolation` field is advisory metadata in this version. It records the intended isolation model, but dispatch does not automatically create worktrees, forked workspaces, or sandboxes.

Optional cheap project readiness and steering checks:

```bash
agent-harness doctor --harnessability --cwd .
agent-harness doctor --steering --cwd .
```

Use `doctor --harnessability` when agents keep struggling in a project. Use `doctor --steering` after repeated failures to see whether one small rule, test or sensor would prevent recurrence.

Optional approved fixtures for critical behavior:

```bash
agent-harness fixtures validate --file tests/fixtures/approved/basic-approved-fixture.json
```

Use fixtures selectively. They are for behavior that must not be guessed.

Optional codebase memory flow for risky or unclear work:

```bash
agent-harness map init
agent-harness map query --surface auth
agent-harness map update --files src/auth/session.ts
agent-harness map record --surface auth --files src/auth/session.ts --summary "Auth session owns login state contracts and must be checked before authorization edits."
```

Do not run a full map for every tiny change. Query the affected surface when the work is broad, risky, or not obvious. Update memory after structural changes so the next agent starts with better context.

Optional learning loop for repeated bugs or known-risk areas:

```bash
agent-harness learn query --surface auth --top-k 3
agent-harness learn capture --surface auth --kind failure_pattern --summary "Auth fixes must verify authorization guards after session edits." --files src/auth/session.ts --evidence-ref .agent-harness/runs/fix.full.json
agent-harness learn promote --lesson-id auth-failure-pattern-20260502
```

Use `learn query` before risky work when prior lessons may help. Use `learn capture` only after real evidence exists, then `learn promote` only for specific lessons worth reusing.

## 6. What A Good Final Answer Looks Like

```txt
run_id: fix-login-20260428
artifact: .agent-harness/runs/fix-login-20260428.json
status: completed
gates: pnpm test:run tests/login.test.ts
evidence: exit_code 0, affected login tests passed
evidence_policy: score 100, no missing required evidence
verified claims: bug_reproduced_before_fix, bug_fixed_after_fix, acceptance_criteria_met
rollback: revert commit abc123 or restore files listed in the artifact
```

If the final answer does not include artifact, evidence policy score, evidence, and verified claims, treat the work as partial.
