# Agent Runtime

Use this file for routine harness execution in Stetix. Do not load long docs unless needed.

- Use `pnpm agent:harness` or token-light macros for approved L2/L3, multi-step or delegated work.
- Declare files before editing. Keep task scope local.
- Record structured evidence with `evidence_type` or `evidence_types`.
- Store long logs by `output_ref` + `sha256`, not pasted text.
- UI/layout requires `browser_smoke` or `visual_assertion`; otherwise status is `partial_validated`.
- Do not claim `completed` without completed artifact, evidence policy score, verified claims and rollback.
- HALT on DB/destructive risk, unsafe ambiguity, auth/data risk or repeated failure.

Final answer: run_id, artifact, status, evidence policy score, missing evidence, claims, rollback.
