# Schemas

Versioned schemas:

- `agent_harness_plan_v1`
- `agent_harness_action_v1`
- `agent_harness_run_v1`
- `agent_harness_config_v1`

Breaking schema changes require golden artifact compatibility tests.

`agent_harness_plan_v1` supports optional task fields:

- `surface`: `ui_layout`, `ui`, `backend`, `api`, `auth`, `db`, `ai`, `docs`, or `generic`
- `files`: files expected for that task
- `required_evidence`: evidence types required before a run can be `completed`

`agent_harness_action_v1` evidence supports:

- `evidence_type`: one proof type
- `evidence_types`: multiple proof types from one gate

`agent_harness_run_v1` supports `partial_validated` when verified claims exist but required evidence is missing.
