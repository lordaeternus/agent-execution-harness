# Agent Runtime

Use this file for routine harness execution in Stetix. Do not load long docs unless needed.

- Use `pnpm agent:harness` or token-light commands for approved L2/L3, multi-step or delegated work.
- Start with `pnpm agent:harness session start`, then use `pnpm agent:harness next`.
- For L2 unclear or L3 high-risk work, run `pnpm agent:harness map query --surface <surface>` before editing.
- After durable structural code changes, run `pnpm agent:harness map update --files <files>` and `pnpm agent:harness map record --surface <surface> --files <files> --summary "<durable fact>"`.
- `docs/agent-map.md` and `docs/historico.md` remain canonical; harness memory is compact cache.
- Prefer `pnpm agent:harness verify --task-id <id> --type <evidence_type> --cmd "<command>"`.
- Use `--types a,b` when one command proves multiple evidence types.
- Declare files before editing. Keep task scope local.
- Record structured evidence with `evidence_type` or `evidence_types`.
- `verify` stores long logs by `output_ref` + `sha256`; do not paste long logs.
- UI/layout requires `browser_smoke` or `visual_assertion`; otherwise status is `partial_validated`.
- Do not claim `completed` without completed artifact, evidence policy score, verified claims and rollback.
- HALT on DB/destructive risk, unsafe ambiguity, auth/data risk or repeated failure.

Final answer: run_id, artifact, status, evidence policy score, missing evidence, claims, rollback.
