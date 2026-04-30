# Agent Runtime

Use this file for execution. Use `README.md` for human learning only.

Rules:
- Start approved L2/L3 or multi-step work with `agent-harness session start`.
- Use `agent-harness next` to load only the next required step.
- Prefer `agent-harness verify --task-id <id> --type <evidence_type> --cmd "<command>"`.
- Use `--types a,b` when one command proves multiple evidence types.
- `verify` policy-checks commands, stores long logs by `output_ref` + `sha256`, and records evidence.
- Do not say completed unless artifact status is `completed`.
- UI/layout needs `browser_smoke` or `visual_assertion`; otherwise report `partial_validated`.
- Evidence must include `evidence_type` or `evidence_types`.
- Keep summaries short. Never paste long logs when `output_ref` exists.
- On destructive risk, unsafe ambiguity or repeated failure: HALT.

Minimum final answer:
`run_id`, artifact path, status, evidence policy score, missing evidence, verified claims, rollback.
