# Agent Harness Rules

- Use `agent-harness execute` for approved L2/L3, multi-step or delegated plans.
- Do not claim success without artifact final `completed`.
- Every claim needs evidence: command, exit code, output excerpt and scope.
- Evidence must use evidence_type/evidence_types matching the plan required_evidence.
- UI/layout success requires browser smoke or visual assertion; otherwise report partial_validated.
- Enter HALT for destructive commands, missing evidence or unsafe ambiguity.
