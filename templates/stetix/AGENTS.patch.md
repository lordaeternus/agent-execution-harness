# Stetix Adapter Patch

- L2/L3, multi-step/delegated: require `pnpm agent:harness` automatically; user should not need to ask.
- Read `docs/process/agent-runtime.md`; avoid long docs.
- Flow: session start -> next --exact -> verify -> claim auto -> finish.
- Weak: `--mode weak`, <=2 files/task, typed evidence; claim auto batches.
- Scope guard blocks finish when product/source diff is outside declared files.
- Canonical memory: `docs/historico.md`; risky/unclear: query harness memory.
- Durable structure: update memory after edit; memory is cache, source/docs win.
- No success claim without completed artifact, evidence and claims.
- Failed verify/CLI order returns repair hint; max 3 tries, then HALT.
- UI/layout needs smoke/visual assertion; long logs by reference/hash.
