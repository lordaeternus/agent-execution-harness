# Protocol

The harness uses a state machine: init, preflight, task_start, gate, evidence, report, completed or HALT.

Every task needs evidence. Claims are checked before final_report. Artifact final `completed` is required before success.
