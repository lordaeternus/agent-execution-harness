# Protocol

The harness uses a state machine: init, preflight, task_start, gate, evidence, report, completed or HALT.

Every task needs evidence. Claims are checked before final_report. Artifact final `completed` is required before success.

Tasks can declare `required_evidence`. If they do not, the harness infers requirements from `surface` and files.

UI/layout tasks require focused tests, scoped lint, scoped typecheck and browser smoke or visual assertion. If required proof is missing, the final state is `partial_validated`, not `completed`.

## Governed Learning Loop

Learning memory turns repeated failures and durable discoveries into small evidence-backed lessons. It does not train a model and it never overrides source code.

Flow: `capture -> review -> promote -> query -> prune`.

Lesson states:

- `candidate`: captured, not trusted yet
- `validated`: specific and evidence-backed
- `promoted`: allowed in future `learn query` results
- `stale`: related files changed or TTL expired
- `rejected`: bad, generic or unsupported
- `retired`: obsolete

Truth priority: source code > current tests/runtime > canonical docs > run evidence > promoted lessons > old chat.
