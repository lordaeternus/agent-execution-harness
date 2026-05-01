# Agent Harness

- Read `docs/agent-runtime.md` first; README is human docs.
- Approved L2/L3, multi-step or delegated plans: use `agent-harness`.
- Prefer: `session start`, `next`, `verify`, `claim auto`, `finish`.
- Risky/unclear: `map query --surface <surface>` before edit.
- Durable structural change: `map update --files <files>` then `map record --surface <surface> --files <files> --summary "<durable fact>"`.
- No success claim without artifact `completed`.
- Claims need evidence: command, exit code, excerpt, scope.
- Evidence uses evidence_type/evidence_types matching required_evidence.
- Long logs: output_ref + sha256; short excerpts only.
- UI/layout needs browser smoke or visual assertion; else partial_validated.
- HALT on destructive command, missing evidence or unsafe ambiguity.
