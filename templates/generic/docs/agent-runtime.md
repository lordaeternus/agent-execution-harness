# Agent Runtime

Use this file for execution. Use `README.md` only for human learning.

- For L2/L3, multi-step, delegated or risky work, run the harness automatically; user should not need to ask.
- If the plan has `depends_on`, run `agent-harness plan waves --plan <plan>` and follow only unblocked tasks from `next --exact --micro`.
- Start with `agent-harness session start`, then use `agent-harness next --exact --micro` for weak agents.
- If `session start` returns `learning_health=needs_audit`, run `agent-harness learn audit --compact`; do not delete lessons automatically.
- For L2 unclear or L3 high-risk work, run `agent-harness map query --surface <surface> --compact` before editing.
- For repeated failures or known-risk surfaces, run `agent-harness learn query --surface <surface> --top-k 3 --compact --files <files> --failure-signature <sig>`.
- For external weak workers, use `agent-harness handoff --compact --plan <plan> --task-id <id>`.
- If the project keeps causing agent mistakes, run `agent-harness doctor --harnessability --cwd .`.
- After repeated failed runs, run `agent-harness doctor --steering --cwd .` and apply only small evidence-backed controls.
- For critical behavior fixtures, run `agent-harness fixtures validate --file <fixture.json>`.
- After durable structural code changes, run `agent-harness map update --files <files>` and `agent-harness map record --surface <surface> --files <files> --summary "<durable fact>"`.
- After durable fixes or incidents, use `agent-harness learn capture`, then `agent-harness learn validate`, then promote only specific lessons with evidence.
- Prefer `agent-harness verify --task-id <id> --type <evidence_type> --cmd "<command>"`.
- Use `--types a,b` when one command proves multiple evidence types.
- `verify` stores long logs by `output_ref` + `sha256` and records evidence.
- Do not say completed unless artifact status is `completed`.
- UI/layout needs `browser_smoke` or `visual_assertion`; otherwise report `partial_validated`.
- Evidence needs `evidence_type` or `evidence_types`.
- Keep summaries short. Do not paste long logs when `output_ref` exists.
- Lessons are hints, not truth. Source code and current tests win.
- No embeddings, no extra reviewing agent, no long learning report in routine execution.
- HALT on destructive risk, unsafe ambiguity or repeated failure.

Final answer: run_id, artifact, status, evidence policy score, missing evidence, verified claims, rollback.
