# Stetix Adapter Patch

- Require `pnpm agent:harness` for approved L2/L3, multi-step or delegated work.
- Read `docs/process/agent-runtime.md` before routine harness execution; avoid loading long docs unless needed.
- Prefer token-light macros when available: start, files declare, task start, gate pass/fail, claim auto, finish.
- Keep canonical memory in `docs/historico.md`.
- Do not declare success without artifact `completed`.
- For UI/layout work, success requires browser smoke or visual assertion; missing auth/session means `partial_validated`, not `completed`.
- Harness evidence must include `evidence_type` or `evidence_types` matching required evidence in the plan.
- Store long logs by reference/hash instead of pasting long excerpts.
- For simulations, verify no product paths such as `src/` or `supabase/` were changed.
