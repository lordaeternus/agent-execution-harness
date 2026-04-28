# Versioning and Compatibility

Patch: bug fixes with same schemas.

Minor: additive commands, claims or fields.

Major: breaking schema or artifact behavior.

Golden artifacts must remain readable until a documented migration exists. Each schema version needs at least one fixture in `tests/fixtures/golden`.
