# Agent Harness Rules

- Runtime guide: read `docs/agent-runtime.md` first. Do not load the full README for routine execution.
- Use `agent-harness execute` for approved L2/L3, multi-step or delegated plans.
- Prefer token-light macros: `agent-harness start`, `files declare`, `task start`, `gate pass|fail`, `claim auto`, `finish`.
- Do not claim success without artifact final `completed`.
- Every claim needs evidence: command, exit code, output excerpt and scope.
- Evidence must use evidence_type/evidence_types matching the plan required_evidence.
- Store long logs by output_ref + sha256; keep chat/report excerpts short.
- UI/layout success requires browser smoke or visual assertion; otherwise report partial_validated.
- Enter HALT for destructive commands, missing evidence or unsafe ambiguity.
