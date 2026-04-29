# Agent Runtime

Use this file for execution. Use `README.md` only for human learning.

- Use the harness for approved L2/L3, multi-step or risky work.
- Prefer macros: `start`, `files declare`, `task start`, `gate pass|fail`, `claim auto`, `finish`.
- Do not say completed unless artifact status is `completed`.
- UI/layout needs `browser_smoke` or `visual_assertion`; otherwise report `partial_validated`.
- Evidence needs `evidence_type` or `evidence_types`.
- Keep summaries short. Store long logs with `output_ref` + `sha256`.
- HALT on destructive risk, unsafe ambiguity or repeated failure.

Final answer: run_id, artifact, status, evidence policy score, missing evidence, verified claims, rollback.
