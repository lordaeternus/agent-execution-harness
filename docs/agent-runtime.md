# Agent Runtime

Use for execution. `README.md` is for humans.

Rules:
- Start approved L2/L3 or multi-step work: `agent-harness session start`.
- Use `agent-harness next` for next step only.
- L2 unclear or L3 high-risk: `agent-harness map query --surface <surface>` before edit.
- Durable structural change: `map update --files <files>` then `map record --surface <surface> --files <files> --summary "<durable fact>"`.
- Prefer `agent-harness verify --task-id <id> --type <evidence_type> --cmd "<command>"`.
- Use `--types a,b` when one command proves multiple evidence types.
- `verify` policy-checks commands, stores long logs by `output_ref` + `sha256`, records evidence.
- Do not say completed unless artifact status is `completed`.
- UI/layout needs `browser_smoke` or `visual_assertion`; otherwise report `partial_validated`.
- Evidence must include `evidence_type` or `evidence_types`.
- Keep summaries short. Do not paste long logs when `output_ref` exists.
- On destructive risk, unsafe ambiguity or repeated failure: HALT.

Minimum final answer:
`run_id`, artifact path, status, evidence policy score, missing evidence, verified claims, rollback.
