# Agent Execution Harness

A transactional execution harness for AI agents. It turns implementation plans into a strict state machine, requires evidence for every meaningful claim, blocks dangerous operations, and prevents an agent from declaring success without an auditable run artifact.

The goal is not to make a model smarter. The goal is to make the execution environment harder to misuse. The harness moves critical discipline out of the model's memory and into deterministic files, schemas, commands, and verification gates.

## Why This Exists

AI coding agents fail in predictable ways:

- they start editing before understanding the plan
- they skip tasks when the plan is long
- they claim a test passed without running it
- they invent files, commands, APIs, or validations
- they broaden scope without noticing
- they continue after dangerous ambiguity
- they report success with no reproducible proof

This harness reduces those failures by forcing the agent to work through a narrow operational contract:

1. read the plan
2. declare the affected files
3. work on one task at a time
4. run an explicit gate
5. record evidence
6. verify claims
7. generate a final report only after the artifact is complete

If any required proof is missing, the correct output is partial progress or `halt`, not success.

## Mental Model

Think of the harness as a flight recorder for autonomous coding work.

The model can still reason, search, edit, and test. But the harness records the execution path in a structured JSON artifact so that a human or another agent can audit what actually happened.

The important idea is simple:

> The final report is not trusted because the agent wrote it. It is trusted because it is derived from the run artifact.

## Core Concepts

### Plan

A plan is a JSON document with:

- `schema_version`
- `plan_id`
- `risk_level`
- `rollback_expectation`
- `gates`
- `tasks`

Each task must have:

- `task_id`
- `acceptance_criteria`

Example:

```json
{
  "schema_version": "agent_harness_plan_v1",
  "plan_id": "basic-plan",
  "risk_level": "L2",
  "rollback_expectation": "Delete generated test files.",
  "gates": ["node --version"],
  "tasks": [
    {
      "task_id": "basic-task",
      "acceptance_criteria": "node --version evidence passes."
    }
  ]
}
```

A valid plan must be specific enough that an agent does not need to invent success criteria while executing.

### Action

An action is one state transition requested by the agent. The supported action space is intentionally small:

- `read_context`
- `declare_files`
- `edit_file_ready`
- `run_gate`
- `record_evidence`
- `verify_claims`
- `final_report`
- `halt_for_risk`

In constrained mode, the agent should perform one action at a time. This makes the process easier for weaker models and easier to audit.

### Artifact

The artifact is the source of truth for execution.

By default, run artifacts are stored in:

```txt
.agent-harness/runs/<run_id>.json
```

A run artifact records:

- run id
- mode
- phase
- plan
- task statuses
- declared files
- pending gates
- evidence
- claims
- verified claims
- errors
- final report metadata

If the artifact is not `completed`, the work is not complete.

### Evidence

Evidence is the proof that a gate or check actually happened.

Each evidence item records:

- `evidence_id`
- `check`
- `result`
- `exit_code`
- `output_excerpt`
- `scope_covered`
- optional `residual_gap`

The harness treats evidence as stronger than narrative. A sentence like "tests passed" is not enough. The agent must record which command ran, what the exit code was, and what output proves the result.

### Claims

A claim is something the agent wants to assert as true.

Supported claim kinds include:

- `file_exists`
- `command_ran`
- `gate_passed`
- `gate_failed`
- `dangerous_command_blocked`
- `task_reconciled`
- `bug_reproduced_before_fix`
- `bug_fixed_after_fix`
- `acceptance_criteria_met`
- `contract_preserved`
- `rollback_defined`
- `no_product_code_changed`

A final report can only be produced after claims are verified. This prevents the agent from making unsupported success statements.

## State Machine

The run follows this lifecycle:

```txt
init -> preflight -> task_start -> gate -> evidence -> report -> completed
```

A run may also enter:

```txt
halt
```

### `init`

The run has been created but no context has been recorded yet.

Allowed next action:

- `read_context`

### `preflight`

The agent has summarized the task context and must declare likely files before editing.

Allowed next action:

- `declare_files`

### `task_start`

The agent can begin a specific task or verify claims if all tasks are reconciled.

Allowed next actions:

- `edit_file_ready`
- `verify_claims`

### `gate`

The agent has identified the task and files. It must now declare the validation command.

Allowed next action:

- `run_gate`

### `evidence`

A gate has been declared. The agent must record the actual result.

Allowed next action:

- `record_evidence`

### `report`

All tasks are reconciled. The agent must verify claims before producing the final report.

Allowed next actions:

- `verify_claims`
- `final_report`

### `completed`

The run is complete. No more actions are allowed.

### `halt`

The run stopped because continuing would be unsafe or invalid. No more actions are allowed until a human or orchestrator decides what to do next.

## Simple Practical Workflow for Non-Technical Users

If you are using this harness through an AI coding agent, you usually do not need to understand every command. The practical workflow is:

1. Ask the agent to investigate the problem.

   Example:

   ```txt
   Find the bug that breaks the checkout flow. Do not edit code yet.
   ```

2. Ask the agent to create an implementation plan.

   Example:

   ```txt
   Create a detailed plan to fix this bug. Include files, risks, tests, and rollback.
   ```

3. Review the plan at a high level.

   You do not need to understand every technical detail. Check whether the plan says:

   - what problem will be fixed
   - which area of the project will be changed
   - how the agent will test the fix
   - how the change can be rolled back if something goes wrong

4. Ask the agent to execute the approved plan using the harness.

   Example:

   ```txt
   Execute this approved plan using the agent harness. Do not declare success without the final artifact, evidence, and verified claims.
   ```

5. The agent should run the harness commands.

   In a properly configured project, the agent should call commands such as:

   ```bash
   agent-harness plan-lint
   agent-harness execute
   agent-harness run
   agent-harness report
   ```

   You, as the user, should not need to type every command manually. The agent should use them as part of its execution process.

6. At the end, ask for the evidence.

   Example:

   ```txt
   Show me the run_id, artifact path, final status, evidence, tests executed, and verified claims.
   ```

7. Only trust the result if the artifact says the run is complete.

   The strongest completion signal is:

   ```txt
   status: completed
   phase: completed
   verified claims: present
   evidence: present
   ```

If those fields are missing, the work may still be partial even if the agent sounds confident.

## Do I Need To Run Commands Myself?

Usually, no.

The intended experience is conversational:

```txt
User: Create a plan.
Agent: Here is the plan.
User: Execute the plan using the harness.
Agent: Runs the harness commands, edits code, records evidence, and reports the artifact.
```

However, this only works if the project and the agent are configured to use the harness. The harness is not magic background behavior built into every AI tool.

There are three possible levels of integration:

### Level 1: Manual Use

A human or agent explicitly runs commands like:

```bash
agent-harness execute --plan plan.json --run-id fix-login
```

This is the most explicit mode. It is useful for testing and debugging the harness itself.

### Level 2: Agent-Guided Use

The user asks the agent to execute a plan with the harness, and the agent runs the commands.

This is the recommended mode for most coding-agent workflows.

The user says:

```txt
Execute the approved plan using the harness.
```

The agent is responsible for:

- validating the plan
- creating or resuming the artifact
- recording evidence
- verifying claims
- generating the final report

### Level 3: Project-Enforced Use

The project has instructions, scripts, and checks that require the harness for risky or multi-step work.

For example, the project's `AGENTS.md` may say:

```txt
For approved L2/L3, multi-step, or delegated plans, use the agent harness.
Do not declare success without a completed artifact, evidence, and verified claims.
```

In this mode, a well-behaved agent should automatically use the harness when the task requires it.

This is the best long-term setup, but it still depends on the agent obeying the project instructions. The harness makes correct behavior easier to enforce and audit; it does not physically force every possible model or tool to comply unless the surrounding system invokes it.

## What To Ask The Agent

Use prompts like these:

```txt
Create a plan first. Do not edit files yet.
```

```txt
Before executing, validate the plan with the harness.
```

```txt
Execute the plan using the harness and keep the artifact updated.
```

```txt
Do not say the task is done unless the harness artifact is completed.
```

```txt
In your final answer, include the run_id, artifact path, final status, evidence, and verified claims.
```

These prompts matter because they tell the agent to use the harness as the execution contract, not just as optional documentation.

## CLI Commands

Build the project first:

```bash
pnpm install
pnpm build
```

Then use the CLI through:

```bash
node bin/agent-harness.mjs <command>
```

### `plan-lint`

Validates a plan before execution.

```bash
node bin/agent-harness.mjs plan-lint --plan tests/fixtures/plans/basic-plan.json
```

Use this before starting any approved multi-step implementation.

### `execute`

Initializes or resumes a run.

```bash
node bin/agent-harness.mjs execute --plan tests/fixtures/plans/basic-plan.json --run-id demo
```

If the artifact does not exist, this creates the first run state. If it exists, the command reports the current phase and next action.

### `run`

Applies one low-level action to the run state.

```bash
node bin/agent-harness.mjs run \
  --plan tests/fixtures/plans/basic-plan.json \
  --run-id demo \
  --action '{"schema_version":"agent_harness_action_v1","type":"read_context","summary":"Read plan and repo context."}'
```

This is the transactional command used by autonomous agents.

### `report`

Generates a final report from a completed artifact.

```bash
node bin/agent-harness.mjs report --run-id demo
```

The report command should not invent a result. It reads the artifact and renders what was actually recorded.

### `doctor`

Checks whether a project is configured correctly for the harness.

```bash
node bin/agent-harness.mjs doctor --cwd examples/minimal-js-project
```

Doctor checks include:

- `package.json` presence
- `AGENTS.md` presence
- config presence
- artifact directory ignored by Git
- basic profile compatibility

### `benchmark`

Runs an offline benchmark over captured scenarios.

```bash
node bin/agent-harness.mjs benchmark --mode smoke
```

The benchmark does not call model APIs. It scores captured runs and scenarios so changes to the harness can be compared deterministically.

### `init`

Prepares a target project using templates.

```bash
node bin/agent-harness.mjs init --adapter generic --cwd ../some-project
```

By default, init behaves as a dry run. It reports what would be created or changed. Applying changes should be explicit.

## Configuration

Projects can define:

```txt
agent-harness.config.json
```

Example:

```json
{
  "schema_version": "agent_harness_config_v1",
  "artifact_dir": ".agent-harness/runs",
  "product_paths": ["src/", "supabase/"],
  "required_scripts": ["agent:harness", "agent:plan:lint"],
  "doctor_profile": "generic",
  "command_policy": {
    "allow": [],
    "deny": ["DROP", "TRUNCATE", "git reset --hard", "push --force"]
  }
}
```

Important fields:

- `artifact_dir`: where run artifacts are stored
- `product_paths`: paths treated as product code for scope checks
- `required_scripts`: scripts expected by doctor
- `doctor_profile`: validation profile for the project
- `command_policy`: allow/deny rules for commands

Deny rules take priority over allow rules.

## Safety Model

The harness blocks or halts when it sees unsafe behavior, including:

- destructive database commands
- destructive Git commands
- force push
- recursive forced deletion
- evidence that does not match the pending gate
- final report before verified claims
- completion before all tasks are reconciled

This does not replace human judgment. It creates mechanical pressure against unsafe automation.

## How An Agent Should Use It

A well-behaved agent should follow this loop:

1. Run `plan-lint`.
2. Run `execute` to create or resume an artifact.
3. Read the current phase and allowed next actions.
4. Apply exactly one action with `run`.
5. Perform the actual implementation or validation outside the artifact.
6. Record evidence with command, exit code, and output excerpt.
7. Repeat until all tasks are completed, blocked, deferred, or cancelled.
8. Verify claims.
9. Generate report.
10. Only then claim success.

The agent should enter `halt_for_risk` if it detects unsafe ambiguity, destructive work, missing evidence, scope conflict, or a plan/runtime mismatch.

## What This Harness Does Not Promise

This harness does not guarantee that:

- the model will understand the product perfectly
- every bug will be found
- every generated test is meaningful
- every architectural decision is correct
- no human review is needed

It does guarantee a stronger operating discipline:

- work is decomposed into tasks
- state is recorded
- evidence is required
- claims are checked
- dangerous operations are blocked or halted
- final reports are derived from artifacts

## Development

Install dependencies:

```bash
pnpm install
```

Run typecheck:

```bash
pnpm typecheck
```

Run tests:

```bash
pnpm test
```

Build:

```bash
pnpm build
```

Run integration tests:

```bash
pnpm test:integration
```

Run smoke benchmark:

```bash
pnpm benchmark:smoke
```

Run release readiness audit:

```bash
pnpm audit:release-readiness
```

## Current Status

This repository is currently private and versioned as `0.1.0-private`. Treat it as an internal harness foundation until compatibility, installer behavior, and adapter workflows mature further.
