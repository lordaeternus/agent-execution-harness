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
npx agent-execution-harness@latest doctor --cwd .
```

Expected result:

```txt
status: success
```

If doctor reports errors, fix them before trusting the harness.

## 5. Tell The Agent To Use It

Use this prompt:

```txt
Use the agent harness for approved plans, multi-step work, risky changes, and any task where you need to prove completion.
Read docs/agent-runtime.md first.
Do not claim success unless the artifact is completed and includes evidence plus verified claims.
In the final answer, include run_id, artifact path, status, gates, evidence, verified claims, and rollback notes.
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

Optional codebase memory flow for risky or unclear work:

```bash
agent-harness map init
agent-harness map query --surface auth
agent-harness map update --files src/auth/session.ts
agent-harness map record --surface auth --files src/auth/session.ts --summary "Auth session owns login state contracts and must be checked before authorization edits."
```

Do not run a full map for every tiny change. Query the affected surface when the work is broad, risky, or not obvious. Update memory after structural changes so the next agent starts with better context.

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
