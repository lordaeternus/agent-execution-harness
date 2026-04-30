# Agent Runtime

Use this file for execution. Use `README.md` only for human learning.

- Use the harness for approved L2/L3, multi-step or risky work.
- Start with `agent-harness session start`, then use `agent-harness next`.
- Prefer `agent-harness verify --task-id <id> --type <evidence_type> --cmd "<command>"`.
- Use `--types a,b` when one command proves multiple evidence types.
- `verify` stores long logs by `output_ref` + `sha256` and records evidence.
- Do not say completed unless artifact status is `completed`.
- UI/layout needs `browser_smoke` or `visual_assertion`; otherwise report `partial_validated`.
- Evidence needs `evidence_type` or `evidence_types`.
- Keep summaries short. Do not paste long logs when `output_ref` exists.
- HALT on destructive risk, unsafe ambiguity or repeated failure.

Final answer: run_id, artifact, status, evidence policy score, missing evidence, verified claims, rollback.
