# Security Policy

Agent Execution Harness is designed to reduce unsafe AI-agent execution. Security reports are taken seriously, especially issues that could let an agent bypass evidence, skip verification, run dangerous commands, or publish misleading success reports.

## Supported Versions

| Version | Supported |
| --- | --- |
| `0.1.x` | Yes |

## Reporting A Vulnerability

Please report security issues privately to the repository owner before opening a public issue.

Include:

- affected version
- operating system and Node.js version
- reproduction steps
- expected behavior
- actual behavior
- impact
- suggested fix, if known

Do not include real secrets, patient data, customer data, production tokens, or private repository content in the report.

## What Counts As Security-Relevant

Examples:

- dangerous command policy bypass
- final report generated without verified claims
- evidence accepted for the wrong gate
- artifact tampering that is not detectable
- installer overwriting unrelated project files
- secret exposure in logs, fixtures, reports, or generated files
- workflow or release configuration that can publish untrusted code

## Secrets

Never paste npm tokens, GitHub tokens, API keys, passwords, cookies, JWTs, service-role keys, or connection strings into issues, pull requests, logs, examples, or chat transcripts.

If a secret is exposed, revoke it immediately and rotate any affected credential.

## Disclosure

Please allow reasonable time for triage and remediation before public disclosure. Responsible disclosure helps protect users who install the harness in real projects.
