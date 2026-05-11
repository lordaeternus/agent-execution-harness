# Agent Runtime

Execution only.

- L2/L3/multi-step: auto. Flow: `session start` -> `next --exact --micro`.
- If `learning_health=needs_audit`, run `learn audit --compact`; do not delete automatically.
- Weak: `--mode weak`; 1 task, <=2 files, typed evidence.
- External: `handoff --compact`, `map query --compact`, `learn query --compact`.
- Weak/strict: prefer `verify --exec <bin> --args-json "[...]"`.
- `claim auto` batches internally; run once.
- Scope guard: `finish` blocks diff outside declared files.
- Follow `repair_hint`; max 3 equivalent failures, then HALT.
- L2 unclear/L3: `map query`; durable: `map update` + `map record`.
- Repeated/risky: `learn query --surface <s> --top-k 3 --compact --files <f> --failure-signature <sig>`.
- Fix/incident: `learn capture` -> `learn validate` -> `learn promote`.
- High-confidence memory needs sources + main check.
- Lessons are hints; source/runtime/tests win. No embeddings/extra agent/long report.
- Prefer `verify --task-id <id> --type <type> --exec <bin> --args-json "[...]"`.
- Long logs: `output_ref` + `sha256`; UI needs smoke/visual.
- Final: `run_id`, artifact, status, score, missing, claims, rollback.
