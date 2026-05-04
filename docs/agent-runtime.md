# Agent Runtime

Execution only.

- L2/L3 or multi-step: `session start` -> `next --exact`.
- Weak: `--mode weak`; 1 task, <=2 files, typed evidence, compact next.
- Strict: `--mode strict`; task `allowed_commands` required; prefer `verify --exec <bin> --args-json "[...]"`; shell `--cmd` blocked by default.
- `claim auto` batches internally; run once.
- Scope guard: `finish` blocks product/source diff outside declared plan files.
- Blocked scope: follow `repair_hint`; revert file or add it to plan.
- L2 unclear/L3: `map query`; repeated-risk: `learn query --top-k 3`.
- Durable structure: `map update` then `map record` with one durable fact.
- Durable fix/incident: `learn capture`; promote only verified lessons.
- Prefer `verify --task-id <id> --type <evidence_type> --cmd "<cmd>"`.
- Failed `verify`/CLI order returns `repair_hint`; max 3 tries, then HALT.
- Long logs: `output_ref` + `sha256`; UI/layout needs smoke/visual assertion.
- Final answer: `run_id`, artifact, status, score, missing, claims, rollback.
