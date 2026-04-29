# Protocol

The harness uses a state machine: init, preflight, task_start, gate, evidence, report, completed or HALT.

Every task needs evidence. Claims are checked before final_report. Artifact final `completed` is required before success.

Tasks can declare `required_evidence`. If they do not, the harness infers requirements from `surface` and files.

UI/layout tasks require focused tests, scoped lint, scoped typecheck and browser smoke or visual assertion. If required proof is missing, the final state is `partial_validated`, not `completed`.
