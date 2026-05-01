# Stetix Adapter Patch

- Approved L2/L3, multi-step or delegated work: require `pnpm agent:harness`.
- Routine execution: read `docs/process/agent-runtime.md`; avoid long docs.
- Prefer: session start, next, verify, claim auto, finish.
- Canonical memory: `docs/historico.md`.
- Risky/unclear: query harness codebase memory before edit.
- Durable structural change: update harness memory after edit.
- Harness memory is cache; source, `docs/agent-map.md`, `docs/historico.md` stay canonical.
- No success claim without artifact `completed`.
- UI/layout needs browser smoke or visual assertion; else `partial_validated`.
- Evidence must include evidence_type/evidence_types matching required evidence.
- Long logs by reference/hash.
- Simulations: verify no product paths like `src/` or `supabase/` changed.
