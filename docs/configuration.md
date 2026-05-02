# Configuration

`agent-harness.config.json` defines `artifact_dir`, `product_paths`, `required_scripts`, `doctor_profile`, `command_policy`, `token_budget`, `codebase_memory`, and `learning_memory`.

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
    "max_lessons_per_surface": 20
  }
}
```

- `top_k`: max lessons returned by `learn query`
- `ttl_days`: when lessons become stale
- `max_summary_chars`: hard token budget per lesson summary
- `max_lessons_per_surface`: prune cap for noisy surfaces

Lessons are operational hints. Code, tests and current runtime evidence win.
