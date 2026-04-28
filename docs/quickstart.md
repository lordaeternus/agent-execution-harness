# Quickstart

This guide is for someone who wants to install Agent Execution Harness in an existing project and start using it with an AI coding agent.

## 1. Open Your Project

Open a terminal in the project where you want the harness installed.

Example:

```bash
cd C:\Projetos\my-app
```

## 2. Preview The Installation

Run:

```bash
npx agent-execution-harness@latest init --adapter generic --cwd .
```

This is a preview. It shows what the harness would configure.

## 3. Apply The Installation

If the preview looks correct, run:

```bash
npx agent-execution-harness@latest init --adapter generic --cwd . --apply
```

If your project already has `AGENTS.md`, the installer keeps it unchanged by default. For most existing projects, append the harness rules:

```bash
npx agent-execution-harness@latest init --adapter generic --cwd . --apply --agents-mode append
```

Use `--agents-mode overwrite` only when you truly want to replace the current `AGENTS.md`. A backup is created first.

For a Stetix-style project, use:

```bash
npx agent-execution-harness@latest init --adapter stetix --cwd . --apply
```

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
Before editing, validate the plan.
During execution, keep the harness artifact updated.
Do not claim success unless the artifact is completed and includes evidence plus verified claims.
In the final answer, include run_id, artifact path, status, gates, evidence, verified claims, and rollback notes.
```

## 6. What A Good Final Answer Looks Like

```txt
run_id: fix-login-20260428
artifact: .agent-harness/runs/fix-login-20260428.json
status: completed
gates: pnpm test:run tests/login.test.ts
evidence: exit_code 0, affected login tests passed
verified claims: bug_reproduced_before_fix, bug_fixed_after_fix, acceptance_criteria_met
rollback: revert commit abc123 or restore files listed in the artifact
```

If the final answer does not include artifact, evidence, and verified claims, treat the work as partial.
