# Agent Runtime

Execution only.

- L2/L3: JSON -> `--plan plan.json`; chat/file -> `plan import --from -|file.md` -> `plan-lint`.
- Flow: `session start --plan plan.json` -> `next --exact --micro`.
- `learning_health=needs_audit`: `learn audit --compact`; no auto-delete.
- Weak: `--mode weak`; 1 task, <=2 files, typed evidence.
- External: `handoff --compact`; compact map/learn queries.
- Weak/strict: prefer `verify --exec <bin> --args-json "[...]"`.
- `claim auto` batches internally; run once.
- Scope guard: `finish` blocks diff outside declared files.
- Repeat failure: local first; docs/web for deps; compare 2 fixes; max 3 then HALT.
- L2 unclear/L3: `map query`; durable: `map update` + `map record`.
- Repeated/risky: `learn query --surface <s> --top-k 3 --compact --files <f>`.
- Fix/incident: `learn capture` -> `learn validate` -> `learn promote`.
- High-confidence memory needs sources + main check.
- Lessons are hints; source/runtime/tests win. No embeddings/extra agent/long report.
- Prefer `verify --type <type> --exec <bin> --args-json "[...]"`.
- Long logs: `output_ref` + `sha256`; UI needs smoke/visual.
- Final: `run_id`, artifact, status, score, missing, claims, rollback
