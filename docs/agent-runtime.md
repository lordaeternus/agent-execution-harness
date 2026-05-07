# Agent Runtime

Execution only.

- L2/L3/multi-step: harness auto. Flow: `session start` -> `next --exact --micro`.
- Weak: `--mode weak`; 1 task, <=2 files, typed evidence, compact next.
- Weak/external: `handoff --compact`, `map query --compact`, `learn query --compact`.
- Strict: `--mode strict`; use `verify --exec <bin> --args-json "[...]"`; shell `--cmd` blocked.
- `claim auto` batches internally; run once.
- Scope guard: `finish` blocks product/source diff outside declared plan files.
- Follow `repair_hint`; max 3 equivalent failures, then HALT.
- L2 unclear/L3: `map query`; durable structure: `map update` + `map record`.
- Repeated/risky failure: `learn query --surface <s> --top-k 3 --compact --files <f> --failure-signature <sig>`.
- Durable fix/incident: `learn capture` -> `learn validate` -> `learn promote`.
- Lessons are evidence-backed hints, not truth; source/runtime/tests win.
- No embeddings, no extra agent, no long learning report.
- Prefer `verify --task-id <id> --type <evidence_type> --cmd "<cmd>"`.
- Long logs: `output_ref` + `sha256`; UI/layout needs smoke/visual assertion.
- Final: `run_id`, artifact, status, score, missing, claims, rollback.
