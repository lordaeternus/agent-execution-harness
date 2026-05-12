# Stetix Harness

- Auto-run on L2/L3, multi-step/delegated.
- Runtime: `docs/process/agent-runtime.md`.
- Think/read first: assumptions, exports, callers.
- Risky ambiguity -> ask/HALT; else conservative path.
- Surgical: no speculation, refactor, unrelated cleanup.
- Define success; tests prove acceptance/contract.
- Flow: session -> next --exact --micro -> verify -> claim auto -> finish.
- Weak: `--mode weak`, <=2 files, typed evidence, prefer verify --exec.
- Scope guard blocks out-of-plan product/source diff.
- Memory: `docs/historico.md` is truth; harness memory is cache.
- Durable: `map update`/`map record` after structural edit.
- Audit noisy memory with compact audit; no auto-delete.
- Conflicts: newer/tested/local wins; mention rejected.
- No silent skips/success without artifact/evidence/claims.
- Repair hints: max 3, then HALT.
- UI needs smoke/visual; long logs by ref.
