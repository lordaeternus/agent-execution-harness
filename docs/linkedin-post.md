# LinkedIn Post Draft

Use this as a starting point. Adjust tone before posting.

## Short Version

I just published the first public version of Agent Execution Harness.

It is a small open-source safety layer for AI coding agents.

The idea is simple: do not let an agent say "done" unless it has a plan, recorded evidence, verified claims, and an auditable artifact.

It does not make models smarter. It makes the execution environment harder to misuse.

Install:

```bash
npx agent-execution-harness@latest init --adapter generic --cwd .
```

Repo:

https://github.com/lordaeternus/agent-execution-harness

npm:

https://www.npmjs.com/package/agent-execution-harness

I am treating this as a v0.1 public foundation and would love feedback from people building with coding agents.

## Longer Version

AI coding agents often fail in predictable ways:

- they skip plan steps
- they invent evidence
- they claim tests passed without proof
- they broaden scope quietly
- they say "done" before the work is actually verifiable

I wanted a stricter execution layer for that.

So I published Agent Execution Harness: an open-source harness that forces AI agents to work through a plan, record evidence, verify claims, and generate final reports from artifacts instead of vibes.

It is not a prompt pack.
It is not an attempt to make the model smarter.

It is a control system around the agent:

- plan validation
- scoped execution
- state machine
- dangerous-command blocking
- evidence recording
- claim verification
- auditable run artifacts

Install:

```bash
npx agent-execution-harness@latest init --adapter generic --cwd .
```

GitHub:

https://github.com/lordaeternus/agent-execution-harness

npm:

https://www.npmjs.com/package/agent-execution-harness

This is still v0.1, so I am sharing it as a public foundation, not as a finished silver bullet. Feedback, criticism, and real-world test cases are very welcome.
