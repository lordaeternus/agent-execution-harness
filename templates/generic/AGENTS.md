# Agent Harness

- Read `docs/agent-runtime.md` first; README is human docs.
- Approved L2/L3, multi-step or delegated plans: use `agent-harness`.
- Prefer: `session start`, `next`, `verify`, `claim auto`, `finish`.
- Weak executor: `--mode weak`; one task, <=2 files, typed evidence.
- Weak `claim auto` batches internally; run it once.
- Risky/unclear: `map query --surface <surface>` before edit.
- Durable structure: `map update --files <files>` then `map record --surface <surface> --files <files> --summary "<fact>"`.
- No success claim without artifact `completed`. Claims need command evidence, exit code, scope.
- Failed `verify` returns `repair_hint`; max 3 equivalent fixes, then HALT.
- UI/layout needs smoke or visual assertion; else partial_validated.
- Long logs: output_ref + sha256; short excerpts only.
- HALT on destructive command, missing evidence or unsafe ambiguity.
