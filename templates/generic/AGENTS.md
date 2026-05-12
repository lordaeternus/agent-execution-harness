# Agent Harness

- Runtime: `docs/agent-runtime.md`.
- Auto-run on L2/L3, multi-step or delegated work.
- Think/read first: assumptions, exports, callers, utilities.
- Risky ambiguity -> ask/HALT; else smallest conservative path.
- Surgical: no speculation, refactor, unrelated cleanup.
- Define success; tests prove acceptance/regression/contract.
- Flow: `session start` -> `next --exact --micro` -> `verify` -> `claim auto` -> `finish`.
- Weak: `--mode weak`; <=2 files; typed evidence; prefer `verify --exec`.
- Scope guard blocks out-of-plan product/source diff.
- Risky/unclear: `map query`; durable: `map update`/`map record`.
- Audit noisy memory with `learn audit --compact`; no auto-delete.
- Conflicts: newer/tested/local wins; mention rejected.
- No silent skips/success without artifact/evidence/claims.
- Repair hints: max 3, then HALT.
- UI needs smoke/visual; long logs by ref.
