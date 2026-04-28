# Installation

Use `init` first as a dry run. Review manifest. Use `--apply` only after review.

Installer must support backup, rollback and doctor validation.

Rollback uses the backup path printed by `init --apply`:

```bash
agent-harness init --cwd ../target --rollback .agent-harness/backups/<timestamp>
```
