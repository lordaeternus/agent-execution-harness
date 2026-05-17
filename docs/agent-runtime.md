# Agent Runtime

Execution only.

- Plan: JSON -> `--plan`; chat/file -> `plan import --from -|file.md`; feature bullets -> `--kind feature-list`; then `plan-lint`.
- Flow: `session start --plan plan.json` -> `next --exact`.
- `learning_health=needs_audit`: `learn audit --compact`; no auto-delete.
- Weak: `--mode weak`; 1 task, <=2 files, typed evidence; prefer `verify --exec <bin> --args-json "[...]"`.
- External: `handoff --compact`; then `handoff validate`; patch -> `patch intake`; `--apply` needs `git apply --check`.
- `claim auto` batches internally; run once.
- Finish: run `finish --check`; then `finish`. Scope guard blocks diff outside declared files.
- Project snapshot: `doctor --quality`; not code-correctness scoring.
- Repeat fail: local first; docs/web for deps; compare 2 fixes; max 3 then HALT.
- Unclear/risky: `map query`; `learn query --surface <s> --top-k 3 --compact --files <f>`.
- Durable lesson: `learn capture` -> `learn validate` -> `learn promote`.
- Memory needs sources + main check. Lessons are hints; runtime/tests win.
- Long logs: `output_ref` + `sha256`; UI needs smoke/visual.
- Final: `run_id`, artifact, status, score, missing, claims, rollback
