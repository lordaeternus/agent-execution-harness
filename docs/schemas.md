# Schemas

Versioned schemas:

- `agent_harness_plan_v1`
- `agent_harness_action_v1`
- `agent_harness_run_v1`
- `agent_harness_config_v1`
- `agent_harness_lesson_v1`

Breaking schema changes require golden artifact compatibility tests.

`agent_harness_plan_v1` supports optional task fields:

- `surface`: `ui_layout`, `ui`, `backend`, `api`, `auth`, `db`, `ai`, `docs`, or `generic`
- `files`: files expected for that task
- `required_evidence`: evidence types required before a run can be `completed`

`agent_harness_action_v1` evidence supports:

- `evidence_type`: one proof type
- `evidence_types`: multiple proof types from one gate
- `output_ref`: relative path to a long captured log/artifact
- `sha256`: digest required when `output_ref` is present

`agent_harness_run_v1` supports `partial_validated` when verified claims exist but required evidence is missing.

`agent_harness_config_v1` supports `token_budget` with:

- `observation_format`: `ultra_compact`, `compact`, `standard`, or `full`
- `summary_max_chars`
- `output_excerpt_max_chars`
- `report_compact_max_chars`

`agent_harness_lesson_v1` supports governed learning records with:

- `lesson_id`: safe stable id
- `surface`: affected area such as `auth`, `api`, `ui_layout`
- `kind`: `failure_pattern`, `fix_pattern`, `architecture_fact`, `verification_rule`, or `rollback_note`
- `evidence_refs`: artifact paths backing the lesson
- `status`: `candidate`, `validated`, `promoted`, `stale`, `rejected`, or `retired`
