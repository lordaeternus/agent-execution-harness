# Demo: From Natural Language To Evidence

This demo shows the intended workflow. It is intentionally small so the mechanism is easy to see.

## Scenario

You have a bug in a project and want an AI coding agent to fix it without guessing, skipping steps, or declaring success without proof.

## Step 1: Install The Harness

From the target project:

```bash
npx agent-execution-harness@latest init --adapter generic --cwd . --apply
```

Check the setup:

```bash
npx agent-execution-harness@latest doctor --cwd .
```

## Step 2: Ask For Investigation First

Ask the agent:

```txt
Investigate the bug. Do not edit code yet. Identify likely files, risk, and the smallest test that proves the issue.
```

This keeps the agent from jumping straight into edits.

## Step 3: Ask For A Plan

Ask:

```txt
Create an implementation plan. Include exact files, acceptance criteria, tests, and rollback.
```

A useful plan should answer:

- what will change
- where it will change
- what must stay compatible
- what command proves the fix
- how to undo the change

## Step 4: Execute With The Harness

Ask:

```txt
Execute the approved plan using the agent harness. Do not declare success without a completed artifact, evidence, and verified claims.
```

The agent should validate the plan, create or resume a run artifact, execute scoped tasks, record evidence, and produce a report from the artifact.

## Step 5: Review Evidence

A strong final response should include:

```txt
run_id: fix-login-20260428
artifact: .agent-harness/runs/fix-login-20260428.json
status: completed
evidence: pnpm test:run tests/login.test.ts -> exit_code 0
verified claims: acceptance_criteria_met, gate_passed, rollback_defined
```

## What The Harness Is Preventing

Without a harness, an agent might say:

```txt
Fixed. Tests passed.
```

That is not enough.

With the harness, the agent must produce structured proof:

- task state
- declared files
- gate command
- evidence output
- verified claims
- final artifact status

## Try A Local Smoke Demo

From this repository, you can lint and execute the included sample plan:

```bash
pnpm build
node bin/agent-harness.mjs plan-lint --plan examples/simulated-bugfix/plan.json
node bin/agent-harness.mjs execute --plan examples/simulated-bugfix/plan.json --run-id demo
```

This does not call model APIs. It only demonstrates the harness contract.
