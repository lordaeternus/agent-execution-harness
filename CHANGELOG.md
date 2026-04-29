# Changelog

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
