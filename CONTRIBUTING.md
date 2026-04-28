# Contributing

Thank you for helping improve Agent Execution Harness.

This project is a safety tool. Contributions should preserve the core promise: agents must not be able to claim success without evidence and verified claims.

## Development Setup

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm test:integration
pnpm benchmark:smoke
pnpm pack:dry
pnpm audit:release-readiness
```

## Pull Request Checklist

Every PR should include:

- purpose of the change
- risk level
- rollback plan
- test plan
- changelog impact
- compatibility impact
- security impact, if any

## Design Rules

- Prefer small, reversible changes.
- Keep schemas explicit.
- Keep command policy conservative.
- Do not hide failed gates behind friendly wording.
- Do not add dependencies unless the benefit is clear and documented.
- Do not weaken dangerous-command detection without tests.
- Do not allow final reports before evidence and verified claims.

## Tests

Add or update tests when changing:

- state machine behavior
- schema validation
- dangerous command handling
- installer behavior
- artifact/report behavior
- CLI command behavior

Use focused tests first, then run the broader gates listed above.

## Documentation

Update `README.md` when user-facing behavior changes.

Update `CHANGELOG.md` for any public behavior, CLI, schema, package, or workflow change.

## Security

Never include real secrets in tests, fixtures, logs, screenshots, issues, pull requests, or docs.

If you find a security issue, follow `SECURITY.md`.
