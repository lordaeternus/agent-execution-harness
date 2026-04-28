# Agent Execution Harness

A transactional execution harness for AI agents: plans become state machines, claims require evidence, and success requires an auditable artifact.

## Quickstart

```bash
pnpm install
pnpm build
node bin/agent-harness.mjs plan-lint --plan tests/fixtures/plans/basic-plan.json
node bin/agent-harness.mjs execute --plan tests/fixtures/plans/basic-plan.json --run-id demo
```

## Honest Promise

This tool reduces operational hallucination by forcing plans, evidence, claims and reports into a deterministic artifact. It does not make any model infallible.
