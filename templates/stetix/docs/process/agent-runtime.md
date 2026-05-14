# Agent Runtime

Use this file for routine harness execution in Stetix. Do not load long docs unless needed.

- Harness command for this project: `pnpm agent:harness`.
- If approved atomic backlog is Markdown-only, run `pnpm agent:harness plan import --from backlog.md --out plan.json --plan-id <id> --risk L2 --rollback "<rollback>"`, then `pnpm agent:harness plan-lint --plan plan.json`.
- For approved L2/L3, multi-step or delegated work, run `pnpm agent:harness` or token-light commands automatically; user should not need to ask.
- If the plan has `depends_on`, run `pnpm agent:harness plan waves --plan <plan>` and follow only unblocked tasks from `next --exact --micro`.
- Start with `pnpm agent:harness session start`, then use `pnpm agent:harness next --exact --micro` for weak agents.
- If `session start` returns `learning_health=needs_audit`, run `pnpm agent:harness learn audit --compact`; do not delete lessons automatically.
- For L2 unclear or L3 high-risk work, run `pnpm agent:harness map query --surface <surface> --compact` before editing.
- For repeated failures or known-risk surfaces, run `pnpm agent:harness learn query --surface <surface> --top-k 3 --compact --files <files> --failure-signature <sig>`.
- For external weak workers, use `pnpm agent:harness handoff --compact --plan <plan> --task-id <id>`.
- If the project keeps causing agent mistakes, run `pnpm agent:harness doctor --harnessability --cwd .`.
- Before broad/risky work, run `pnpm agent:harness doctor --coverage --architecture --cwd .` for compact gaps.
- After repeated failed runs, run `pnpm agent:harness doctor --steering --cwd .` and apply only small evidence-backed controls.
- For critical behavior fixtures, run `pnpm agent:harness fixtures validate --file <fixture.json>`.
- After durable structural code changes, run `pnpm agent:harness map update --files <files>` and `pnpm agent:harness map record --surface <surface> --files <files> --summary "<durable fact>"`.
- After durable fixes or incidents, use `pnpm agent:harness learn capture`, then `pnpm agent:harness learn validate`, then promote only specific lessons with evidence.
- `docs/agent-map.md` and `docs/historico.md` remain canonical; harness memory is compact cache.
- Prefer `pnpm agent:harness verify --task-id <id> --type <evidence_type> --exec <bin> --args-json "[...]"`; use `--cmd` only when shell behavior is required.
- Use `--types a,b` when one command proves multiple evidence types.
- Declare files before editing. Keep task scope local.
- Record structured evidence with `evidence_type` or `evidence_types`.
- `verify` stores long logs by `output_ref` + `sha256`; do not paste long logs.
- UI/layout requires `browser_smoke` or `visual_assertion`; otherwise status is `partial_validated`.
- Do not claim `completed` without completed artifact, evidence policy score, verified claims and rollback.
- Lessons are hints, not truth. Source, tests, docs and runtime evidence win.
- High-confidence memory requires source files and main-agent validation.
- Benchmark smoke must keep `false_success_rate=0` and `unexpected_diff_block_rate=1`.
- No embeddings, no extra reviewing agent, no long learning report in routine execution.
- HALT on DB/destructive risk, unsafe ambiguity, auth/data risk or repeated failure.

Final answer: run_id, artifact, status, evidence policy score, missing evidence, claims, rollback.
