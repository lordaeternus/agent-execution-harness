# Agent Runtime

Use this file for execution. Use `README.md` for human learning only.

Rules:
- Start approved L2/L3 or multi-step work with `agent-harness start`.
- Declare files, start one task, run one gate, record evidence, then continue.
- Prefer macro commands: `start`, `files declare`, `task start`, `gate pass|fail`, `claim auto`, `finish`.
- Do not say completed unless artifact status is `completed`.
- UI/layout needs `browser_smoke` or `visual_assertion`; otherwise report `partial_validated`.
- Evidence must include `evidence_type` or `evidence_types`.
- Keep summaries short. Store long logs via `output_ref` + `sha256`.
- On destructive risk, unsafe ambiguity or repeated failure: HALT.

Minimum final answer:
`run_id`, artifact path, status, evidence policy score, missing evidence, verified claims, rollback.
