# Agent Runtime

Execution only. `README.md` is for humans.

Rules:
- Start approved L2/L3 or multi-step: `agent-harness session start`, then `next`.
- L2 unclear/L3: `map query --surface <surface>`; repeated-risk: `learn query --surface <surface> --top-k 3`.
- Durable structure change: `map update --files <files>` then `map record --surface <surface> --files <files> --summary "<fact>"`.
- Durable fix/incident: `learn capture`; promote only verified lessons.
- Prefer `verify --task-id <id> --type <evidence_type> --cmd "<command>"`.
- Use `--types a,b` when one command proves multiple evidence types.
- `verify` policy-checks commands, stores long logs by `output_ref` + `sha256`.
- Do not say completed unless artifact status is `completed`.
- UI/layout needs `browser_smoke` or `visual_assertion`; otherwise report `partial_validated`.
- Evidence needs `evidence_type` or `evidence_types`.
- Keep summaries short. Do not paste long logs when `output_ref` exists.
- Lessons never outrank source code, tests or runtime evidence.
- Destructive risk, unsafe ambiguity or repeated failure: HALT.

Final answer: `run_id`, artifact, status, evidence score, missing evidence, claims, rollback.
