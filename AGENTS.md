# Agent Harness

- Runtime: `docs/agent-runtime.md`.
- Prefer smallest correct changes with explicit evidence.
- Use `plan-lint`, `next --exact`, `verify`, `claim auto`, `finish --check`, then `finish`.
- For imported chat plans, use `plan import --from -`; for feature bullets, use `plan import --kind feature-list`.
- Do not claim success without passing validation and recorded evidence.
- Scope guard failures mean fix the plan or remove out-of-scope edits.
