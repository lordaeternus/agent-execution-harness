# Agent Harness

- Read `docs/agent-runtime.md`; README is human docs.
- L2/L3, multi-step, delegated: use `agent-harness`.
- Flow: `session start` -> `next --exact` -> `verify` -> `claim auto` -> `finish`.
- Weak: `--mode weak`; 1 task, <=2 files, typed evidence.
- `claim auto` batches internally; run once.
- Scope guard blocks `finish` if product/source diff is outside declared files.
- Risky/unclear: `map query`; durable structure: `map update` + `map record`.
- No success claim without completed artifact, evidence and claims.
- Failed verify/CLI order returns `repair_hint`; max 3 tries, then HALT.
- UI/layout needs smoke/visual assertion; long logs by `output_ref` + `sha256`.
