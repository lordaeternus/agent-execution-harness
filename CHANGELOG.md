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
