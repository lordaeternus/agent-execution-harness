# Configuration

`agent-harness.config.json` defines `artifact_dir`, `product_paths`, `required_scripts`, `doctor_profile`, `command_policy`, `token_budget`, `codebase_memory`, `learning_memory`, and optional `architecture_rules`.

`command_policy.deny` wins over allow.

## Codebase Memory

`codebase_memory` controls selective repository memory.

```json
{
  "codebase_memory": {
    "enabled": true,
    "memory_dir": ".agent-harness/memory",
    "default_strategy": "query",
    "stale_after_days": 14,
    "max_summary_chars": 1200,
    "surface_budgets": {
      "auth": 1800,
      "db": 1800,
      "api": 1400,
      "ai": 1400,
      "ui": 900,
      "ui_layout": 900,
      "docs": 500,
      "generic": 700
    },
    "high_risk_surfaces": ["auth", "db", "api", "ai"]
  }
}
```

The memory is a compact cache. The source code remains the source of truth.

## Learning Memory

`learning_memory` controls evidence-backed lessons from failures, durable fixes and recurring verification rules.

```json
{
  "learning_memory": {
    "enabled": true,
    "memory_dir": ".agent-harness/learning",
    "top_k": 3,
    "ttl_days": 60,
    "max_summary_chars": 500,
    "max_lessons_per_surface": 20,
    "audit_cooldown_days": 7,
    "audit_max_lessons": 50,
    "audit_max_stale_ratio": 0.25,
    "audit_max_low_confidence_ratio": 0.2,
    "audit_max_duplicate_candidates": 5,
    "audit_compact_max_chars": 600
  }
}
```

- `top_k`: max lessons returned by `learn query`
- `ttl_days`: when lessons become stale
- `max_summary_chars`: hard token budget per lesson summary
- `max_lessons_per_surface`: prune cap for noisy surfaces
- `audit_*`: cheap thresholds for `learn health` and compact `learn audit`

Lessons are operational hints. Code, tests and current runtime evidence win. Audits recommend cleanup; they do not delete lessons automatically.

## Harnessability And Steering

Use these commands to keep the harness cheap and practical:

```bash
agent-harness doctor --harnessability --cwd .
agent-harness doctor --coverage --architecture --cwd .
agent-harness doctor --steering --cwd .
```

- `doctor --harnessability` scores local rails such as scripts, tests, `AGENTS.md`, runtime docs and command policy.
- `doctor --coverage` shows compact control gaps for weak-agent work.
- `doctor --architecture` checks optional path/import boundary rules.
- `doctor --steering` scans recent artifacts and suggests a small control only when failures repeat.

The goal is not to add sensors everywhere. Cheap deterministic checks should run early. Expensive checks should be reserved for risky work.

## Architecture Rules

Use `architecture_rules` only for simple boundaries that weak agents often cross:

```json
{
  "architecture_rules": [
    {
      "id": "no_client_secret_import",
      "from": "src/**/*.ts",
      "forbid_import": "**/service-role**",
      "reason": "client code must not import server-only secrets"
    }
  ]
}
```

Rules are string/glob checks, not a full architecture framework.

## Approved Fixtures

Approved fixtures are optional validation anchors for critical behavior:

```bash
agent-harness fixtures validate --file tests/fixtures/approved/basic-approved-fixture.json
```

Use them for auth, billing, clinical AI, data transforms or structured AI output. Do not use them for trivial copy or one-file UI changes.
