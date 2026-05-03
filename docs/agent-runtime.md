# Agent Runtime

Execution only. `README.md` is for humans.

Rules:
- Start L2/L3 or multi-step: `agent-harness session start`, then `next`.
- Weak executor: `--mode weak`; one task, <=2 files, typed evidence, compact next.
- Weak `claim auto` batches internally; run it once.
- L2 unclear/L3: `map query --surface <surface>`; repeated-risk: `learn query --surface <surface> --top-k 3`.
- Durable structure: `map update --files <files>` then `map record --surface <surface> --files <files> --summary "<fact>"`.
- Durable fix/incident: `learn capture`; promote only verified lessons.
- Prefer `verify --task-id <id> --type <evidence_type> --cmd "<command>"`. Failed `verify` returns `repair_hint`; max 3 equivalent fixes, then HALT.
- Use `--types a,b` for multi-evidence. Long logs: `output_ref` + `sha256`.
- Do not say completed unless artifact status is `completed`. UI/layout needs `browser_smoke` or `visual_assertion`; else `partial_validated`.
- Evidence needs `evidence_type`/`evidence_types`; `file_scope` only when plan asks.
- Destructive risk, unsafe ambiguity or repeated failure: HALT.

Final answer: `run_id`, artifact, status, score, missing evidence, claims, rollback.
