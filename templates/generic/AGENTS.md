# Agent Harness

- Runtime: `docs/agent-runtime.md`.
- Auto-run on L2/L3, multi-step/delegated.
- Think/read: assumptions, exports, callers.
- Discipline: smallest correct change, verifiable success.
- Risky ambiguity -> ask/HALT; else smallest safe path.
- Surgical: no speculation/refactor/unrelated cleanup.
- Success first; tests prove acceptance/contract.
- Flow: `session start` -> `next --exact --micro` -> `verify` -> `claim auto` -> `finish`.
- Weak: `--mode weak`; <=2 files; typed evidence; prefer `verify --exec`.
- Scope guard blocks out-of-plan diff.
- Risky/unclear: `map query`; durable: `map update`/`map record`.
- Audit noisy memory; no auto-delete.
- Conflicts: newer/tested/local wins; note rejected.
- Repeat fail: local first; docs/web only for deps; compare 2 fixes.
- No silent success/skips; require evidence.
- UI needs smoke/visual; logs by ref.
