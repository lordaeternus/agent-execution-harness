# Agent Runtime

- Plan: JSON -> `--plan`; chat/file -> `plan import --from -|file.md`; bullets -> `--kind feature-list`; `plan-lint`.
- Flow: `session start --plan plan.json` -> `next --exact`.
- Weak: `--mode weak`; 1 task, <=2 files, typed evidence; prefer `verify --exec`.
- External: `handoff --compact`; `handoff validate`; patch -> `patch intake`; `--apply` needs `git apply --check`.
- `claim auto` batches; run once.
- Finish: `finish --check`; then `finish`. Scope guard blocks out-of-plan diff.
- Snapshot: `doctor --quality`; not code-correctness scoring.
- Runtime: `doctor --runtime` before serial vs subagents. Missing capability -> serial. Dispatch does not spawn subagents; only guides capable runtimes.
- Repeat fail: local first; docs/web for deps; compare 2 fixes; max 3.
- Unclear/risky: `map query`; `learn query --surface <s> --top-k 3 --compact --files <f>`.
- Durable lesson: `learn capture` -> `learn validate` -> `learn promote`.
- Memory: sources + main check. Hints only; runtime/tests win. `learning_health=needs_audit` -> `learn audit --compact`.
- Logs: `output_ref` + `sha256`; UI needs smoke/visual.
- Final: `run_id`, artifact, status, score, missing, claims
