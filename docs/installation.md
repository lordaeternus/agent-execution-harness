# Installation

Use `init` first as a dry run. Review manifest. Use `--apply` only after review.

Installer must support backup, rollback and doctor validation.

`AGENTS.md` is protected by default. If the target project already has one, choose the behavior explicitly:

```bash
agent-harness init --cwd ../target --apply --agents-mode skip
agent-harness init --cwd ../target --apply --agents-mode append
agent-harness init --cwd ../target --apply --agents-mode overwrite
```

Use `append` for most existing projects. Use `overwrite` only when replacing the current agent rules is intentional.

Rollback uses the backup path printed by `init --apply`:

```bash
agent-harness init --cwd ../target --rollback .agent-harness/backups/<timestamp>
```
