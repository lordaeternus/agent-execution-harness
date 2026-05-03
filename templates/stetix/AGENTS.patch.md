# Stetix Adapter Patch

- Approved L2/L3, multi-step/delegated work: require `pnpm agent:harness`.
- Routine execution: read `docs/process/agent-runtime.md`; avoid long docs.
- Weak executor: `--mode weak`, <=2 files/task, typed evidence.
- Prefer: session start, next, verify, claim auto, finish.
- Weak `claim auto` batches internally; run it once.
- Canonical memory: `docs/historico.md`. Risky/unclear: query harness memory before edit.
- Durable structure: update harness memory after edit. Memory is cache; source/docs stay canonical.
- No success claim without artifact `completed`.
- Failed verify returns repair hint; max 3 equivalent fixes, then HALT.
- UI/layout needs smoke/visual assertion; else `partial_validated`.
- Evidence must include evidence_type/evidence_types matching required evidence.
- Long logs by reference/hash. Simulations: verify no product paths changed.
