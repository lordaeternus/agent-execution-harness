# Stetix

- Auto-run on L2/L3, multi-step/delegated.
- Runtime: `docs/process/agent-runtime.md`.
- Think/read: assumptions, exports, callers.
- Discipline: smallest correct change, verifiable success.
- Risky ambiguity -> ask/HALT; else conservative path.
- Surgical: no speculation/refactor/unrelated cleanup.
- Success first; tests prove acceptance/contract.
- Flow: session -> next --exact --micro -> verify -> claim auto -> finish.
- Weak: `--mode weak`, <=2 files, typed evidence, prefer verify --exec.
- Scope guard blocks out-of-plan diff.
- Memory: `docs/historico.md` truth; harness cache.
- Durable: `map update`/`map record`.
- Audit noisy memory; no auto-delete.
- Conflicts: newer/tested/local wins; note rejected.
- Repeat fail: local first; docs/web only for deps; compare 2 fixes.
- No silent success/skips; require evidence.
- UI needs smoke/visual; logs by ref.
