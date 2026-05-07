## 0.11.1

- Clarified `init --apply` success output for first-time users.
- Added a concise human message explaining whether `AGENTS.md` was appended, overwritten, created or left unchanged.
- Expanded install readiness coverage for the clearer init response.

## 0.11.0

- Added `learn validate` so evidence-backed lessons must be validated before promotion.
- Added local `learn query` ranking with optional `--files` and `--failure-signature`.
- Added short repeated-failure learning hints from `verify`.
- Added token budgets for validation output and repeated-failure hints.

## 0.10.1

- Added opt-in micro/compact outputs for token-sensitive agent loops: `next --exact --micro`, `handoff --compact`, `learn query --compact`, and `map query --compact`.
- Expanded token benchmarks and budgets to guard compact output size without removing full audit outputs.

## 0.10.0

- Added optional task `depends_on` support for dependency-aware plan execution.
- Added graph validation, deterministic execution waves, dependency-aware `next --exact`, and compact dependency context in `handoff`.

## 0.9.1

- Clarified that L2/L3, multi-step, delegated or risky work should run through the harness automatically, without requiring the user to remember to request it.

## 0.9.0

- Added a lightweight control catalog so users can see which harness controls cover which risks.
- Added risk-based sensor profile warnings to `plan-lint` without turning valid plans into errors.
- Added `doctor --harnessability` to score project readiness for AI-agent execution.
- Added `doctor --steering` to suggest small controls after repeated evidence-backed failures.
- Added optional approved fixture validation for critical behavior.

## 0.8.0

- Added `handoff` to generate compact task capsules for weak workers such as cheaper, local, junior or external-chat agents.
- Added `handoff validate` to reject worker outputs that invent files, commands, placeholders or success without evidence.
- Documented the strong-planner / weak-executor / harness-validator flow.

## 0.7.0

- Added strict execution mode for lower-trust or lower-context agents.
- Added Ajv-backed runtime validation for versioned harness schemas.
- Added structured `verify --exec --args-json` command execution and strict shell blocking.
- Strengthened strict command enforcement against task `allowed_commands`.
- Expanded scope guard coverage for staged files.
- Hardened acceptance claims so incomplete evidence policy cannot become `acceptance_criteria_met`.
- Added adversarial benchmark metrics and strict/out-of-plan benchmark scenarios.
- Added release-readiness checks for package, README, changelog and release-note version consistency.

## 0.6.4

- Added scope guard to block `finish` when git diff contains product/source files outside declared plan files.
- Added `touched_files` and `unexpected_files` tracking in run artifacts.
- Added `unexpected_file_changed` repair hints and weak-agent simulation coverage.

## 0.6.3

- Added `next --exact` to guide low-context agents with one deterministic next command.
- Added task-level `allowed_commands` for plan-driven validation.
- Added structured CLI `repair_hint` output for operational ordering errors.

## 0.6.2

- Fixed `claim auto` in weak mode by batching generated claims within the execution profile limit.
- Changed claim verification to accumulate verified claims across batches instead of replacing prior claims.
- Added readiness coverage for multi-task weak-mode plans that generate more claims than one weak action can carry.

## 0.6.1

- Clarified safe update behavior for existing installations.
- Added readiness coverage proving init preserves user history, reports, memory, scripts, config and existing AGENTS.md rules unless overwrite is explicitly requested.

## 0.6.0

- Added semantic plan compiler checks for autonomous execution.
- Added weak model execution profile with compact next actions and stricter evidence.
- Added repair hints for failed verification gates.
- Added explicit file-scope evidence support and token benchmarks for weak mode.

# Changelog

## 0.5.0 - 2026-05-02

### Added

- Added governed Learning Loop commands: `learn capture`, `learn review`, `learn promote`, `learn reject`, `learn retire`, `learn query`, and `learn prune`.
- Added `learning_memory` config and `agent_harness_lesson_v1` schema for evidence-backed lessons.
- Added stale detection, TTL pruning, per-surface caps, top-k querying, and secret redaction for lessons.

### Changed

- Documented how lessons complement codebase memory without replacing source code, tests, or runtime evidence.
- Token benchmark now reports `learn query` cost separately from the compact execution path.

## 0.4.0 - 2026-04-30

### Added

- Added codebase memory commands: `map init`, `map status`, `map query`, `map update`, and `map record`.
- Added file-hash freshness tracking so changed files mark affected surfaces as `stale` until durable memory is recorded.
- Added summary quality checks to reject generic memory notes and require validated subagent memory contracts.

### Changed

- High-risk task surfaces can now require `codebase_memory_fresh` evidence before completed status.
- Documented selective mapping so agents avoid remapping the full codebase on every task.

## 0.3.0 - 2026-04-30

### Added

- Added active sessions so agents can stop repeating `--plan`, `--run-id` and `--mode`.
- Added `next` for low-token continuation.
- Added `verify` to run policy-checked gates, store long logs by `output_ref`, hash them with `sha256`, and record evidence automatically.
- Added `ultra_compact` observation mode.

### Changed

- Strengthened token benchmarks to cover repeated flags and long evidence output.

## 0.2.1 - 2026-04-29

### Fixed

- Made the token benchmark measure agent-facing protocol text instead of environment-specific executable paths.

## 0.2.0 - 2026-04-29

### Added

- Added token-aware runtime guidance for agents.
- Added compact/full/json report formats and compact observations.
- Added evidence `output_ref` and `sha256` fields for referenced logs.
- Added dual full/current artifacts for audit plus low-token continuation.
- Added macro CLI commands and conservative auto-claims.
- Added token budget and token benchmark checks.

## 0.1.3 - 2026-04-29

### Added

- Added evidence policy enforcement with required evidence by task surface and files.
- Added `partial_validated` run status when required evidence is missing.
- Added evidence quality score and missing/satisfied evidence details to final reports.
- Added `evidence_type` and `evidence_types` support for structured proof records.

### Changed

- UI/layout tasks now require focused tests, scoped lint, scoped typecheck and browser smoke or visual assertion before `completed`.
- Updated GitHub Actions to Node 24-era action versions.

## 0.1.2 - 2026-04-28

### Fixed

- Fixed npm/npx `init` so templates resolve from the installed package instead of the caller's current directory.

### Changed

- Included docs, security policy, and contributing guide in the published npm package.
- Protected existing `AGENTS.md` files with explicit `--agents-mode skip|append|overwrite` install behavior.

## 0.1.1 - 2026-04-28

### Changed

- Simplified README for both non-technical users and developers.
- Added clearer npm/npx installation, agent prompts, examples, troubleshooting, and contribution/security guidance.
- Strengthened release-readiness audit for public onboarding, README structure, and CLI bin metadata.

## 0.1.0 - 2026-04-28

### Added

- Initial public-readiness harness package.
- Transactional runner, CLI, schemas, templates, benchmark and docs.
