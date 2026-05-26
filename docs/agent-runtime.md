# Agent Runtime

- Plan: JSON -> `--plan`; chat/file -> `plan import --from -|file.md`; bullets -> `--kind feature-list`.
- Flow: `session start --plan plan.json` -> `next --exact --micro`.
- Weak: `--mode weak`; 1 task, <=2 files, typed evidence; use `verify --exec`.
- External: `handoff --compact`; `handoff validate`; patch -> `patch intake`; `--apply` runs `git apply --check`.
- `claim auto` batches; run once.
- Finish: `finish --check`; then `finish`. Scope guard blocks out-of-plan diff.
- Snapshot: `doctor --quality`; not code-correctness scoring.
- Runtime: `doctor --runtime`; missing capability -> serial. Dispatch guides only.
- Branch: stay current; never create/switch unless user asks.
- Repeat fail: local first; docs/web for deps; compare 2 fixes; max 3.
- Unclear/risky: `map query`; `learn query --surface <s> --top-k 3 --compact --files <f>`.
- Durable lesson: `learn capture` -> `learn validate` -> `learn promote`.
- Memory: sources + main check; runtime/tests win. `needs_audit` -> `learn audit --compact`.
- Logs: `output_ref` + `sha256`; UI needs smoke/visual.
- Final: `run_id`, artifact, status, score, missing, claims
