# Agent Harness Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing local agent harness using iii-inspired contracts and chokepoints without adding workers, daemons, buses, or token-heavy runtime machinery.

**Architecture:** Keep `agent-execution-harness` as a single-process CLI/package. Add one deep task-contract module, reuse existing finish/evidence modules as canonical chokepoints, and tighten weak/strict evidence paths. Defer trace-lite until there is demonstrated audit/debug pain; current run artifacts and `next --exact --micro` already serve low-power models well.

**Tech Stack:** Node >=20, ESM TypeScript, AJV JSON schemas, Vitest, existing CLI commands under `src/cli`, pure core logic under `src/core`.

---

## Critical revision before implementation

My previous recommendation had four items: task contract, completion chokepoint, weak/strict manual evidence restriction, and trace-lite. After re-reviewing the codebase and token goals, the improved conclusion is:

1. **Keep the iii idea, not the iii infrastructure.** Do not add WebSocket workers, registry, approval UI, OTel, provider routers, or any long-running process.
2. **Prioritize deterministic local controls.** The harness is strongest when it gives weak models one exact next command and rejects false completion.
3. **Demote trace-lite to a later optional feature.** It adds another artifact stream and more code paths. Current state artifacts, logs, SHA-256 evidence, and token benchmarks already cover the low-power model use case. Add trace-lite only if repeated debugging incidents show a need.
4. **Implement the smallest deep seams.** The two best seams are:
   - task contract: one source of truth for surface/evidence/file limits;
   - completion/evidence chokepoints: final report must require auto claims; weak/strict should not rely on unexecuted manual pass evidence by accident.
5. **Accept this as L3.** It touches evidence, claims, finish behavior, command/evidence safety, schemas/tests/docs. Verification must be broad.

## File structure map

### Create

- `src/core/task-contract.ts`
  - Owns task surface inference, evidence requirements, risk file limits, and default allowed command derivation.
  - This is a deep module: callers learn one interface instead of duplicating surface/evidence rules.

- `tests/unit/task-contract.test.ts`
  - Characterization tests for surface inference, evidence requirements, risk limits, and allowed command fallback.

### Modify

- `src/core/plan-compiler.ts`
  - Replace local `SURFACE_BY_PATH`, `EVIDENCE_BY_SURFACE`, `MAX_FILES_BY_RISK`, and local `inferSurface()` with `task-contract` calls.

- `src/core/evidence-policy.ts`
  - Replace local `SURFACE_REQUIREMENTS`, `inferSurface()`, and `requiredEvidenceForTask()` logic with `task-contract` calls.

- `src/core/auto-claims.ts`
  - Export `claimKey()` and add `missingAutoClaims(state)` so finish checks and final report validation use the same logic.

- `src/core/finish-check.ts`
  - Replace local auto-claim key logic with `missingAutoClaims(state)`.

- `src/core/state-machine.ts`
  - In `final_report`, reject completion if required auto claims are missing. This closes the direct low-level `run` completion path.

- `src/cli/macro.ts`
  - Tighten `gate pass` / `gate fail` evidence for `strict`; warn or block weak manual evidence depending on the compatibility decision below.
  - Add support for `--output-ref` and `--sha256` when recording external evidence through manual gate macros.

- `src/core/run-types.ts`
  - No required schema change if we reuse existing `Evidence.output_ref` and `Evidence.sha256`.

- `schemas/agent_harness_run_v1.schema.json`
  - No schema field addition planned. Only verify existing optional `output_ref` and `sha256` remain accepted.

- `tests/unit/core.test.ts`
  - Update final-report tests so completion includes the auto `task_reconciled` claim.
  - Add negative test for direct final report with missing auto claims.

- `tests/unit/finish-check.test.ts`
  - Keep behavior equivalent, but cover `missingAutoClaims()` integration.

- `tests/integration/cli.test.ts`
  - Update weak-flow tests that currently use `gate pass` to use `verify`, or pass explicit external evidence metadata if testing external evidence.
  - Add strict manual gate rejection test.

- `tests/unit/public-readiness.test.ts`
  - Update any weak-mode manual evidence flow if affected.
  - Ensure public readiness still covers install/update safety.

- `README.md`
  - Add a short note: weak/strict agents should use `verify`; manual `gate pass` is for externally proven evidence only.

- `docs/agent-runtime.md`
  - Keep compact; update the `Weak:` line only if required and stay under token budget.

- `docs/configuration.md`
  - Document that evidence rules come from the task contract and manual evidence must carry proof metadata in strict mode.

- `CHANGELOG.md`
  - Add an Unreleased note. Mark weak/strict manual evidence tightening as compatibility-sensitive.

### Do not create

- No worker system.
- No daemon.
- No event bus.
- No OpenTelemetry.
- No provider abstraction.
- No approval surface.
- No new dependency.

## Compatibility decision

Recommended default:

- `strict`: block manual `gate pass`/`gate fail` unless `--output-ref` and `--sha256` are provided.
- `weak`: prefer compatibility first. Emit a compact warning when manual gate evidence lacks `output_ref`/`sha256`, but do not block in the first release. Update `next --exact`/docs to steer weak agents to `verify`.

Reason: blocking weak manual `gate pass` immediately would break existing tests and users who use macro flows. Strict mode is already opt-in for stronger guarantees, so blocking there is safer.

---

### Task 1: Add task-contract module with characterization tests

**Files:**
- Create: `src/core/task-contract.ts`
- Create: `tests/unit/task-contract.test.ts`

- [ ] **Step 1: Write the failing task-contract tests**

Create `tests/unit/task-contract.test.ts` with these tests:

```ts
import { describe, expect, it } from "vitest";
import {
  allowedCommandsForTask,
  inferTaskSurface,
  maxFilesForRisk,
  requiredEvidenceForTask,
} from "../../src/core/task-contract.js";

describe("task contract", () => {
  it("infers sensitive and UI surfaces from paths", () => {
    expect(inferTaskSurface(["supabase/migrations/001.sql"])).toBe("db");
    expect(inferTaskSurface(["supabase/functions/pay/index.ts"])).toBe("api");
    expect(inferTaskSurface(["src/auth/session.ts"])).toBe("auth");
    expect(inferTaskSurface(["src/ai/prompts/system.ts"])).toBe("ai");
    expect(inferTaskSurface(["src/components/Button.tsx"])).toBe("ui_layout");
    expect(inferTaskSurface(["README.md"])).toBe("docs");
    expect(inferTaskSurface(["src/core/runner.ts"])).toBe("backend");
    expect(inferTaskSurface(["notes.txt"])).toBe("generic");
  });

  it("returns required evidence from explicit task requirements first", () => {
    expect(
      requiredEvidenceForTask({
        planTask: {
          task_id: "t1",
          acceptance_criteria: "Run focused check.",
          files: ["src/components/Button.tsx"],
          required_evidence: ["custom_check"],
        },
      }),
    ).toEqual(["custom_check"]);
  });

  it("infers default required evidence by surface", () => {
    expect(requiredEvidenceForTask({ planTask: { task_id: "ui", acceptance_criteria: "UI passes.", files: ["src/components/App.tsx"] } })).toEqual([
      "browser_smoke|visual_assertion",
      "focused_tests",
      "scoped_lint",
      "scoped_typecheck",
    ]);
    expect(requiredEvidenceForTask({ planTask: { task_id: "auth", acceptance_criteria: "Auth passes.", files: ["src/auth/login.ts"] } })).toEqual([
      "authz_negative_test",
      "focused_tests",
      "scoped_typecheck",
    ]);
    expect(requiredEvidenceForTask({ planTask: { task_id: "docs", acceptance_criteria: "Docs updated.", files: ["README.md"] } })).toEqual([]);
  });

  it("adds fresh memory evidence for high-risk run tasks that started", () => {
    expect(
      requiredEvidenceForTask({
        runTask: {
          task_id: "api",
          acceptance_criteria: "API passes.",
          status: "in_progress",
          evidence_ids: [],
          files: ["supabase/functions/pay/index.ts"],
        },
      }),
    ).toContain("codebase_memory_fresh");
  });

  it("keeps file limits by risk level", () => {
    expect(maxFilesForRisk("L1")).toBe(3);
    expect(maxFilesForRisk("L2")).toBe(3);
    expect(maxFilesForRisk("L3")).toBe(2);
  });

  it("derives allowed commands with task, checks, plan gate precedence", () => {
    expect(allowedCommandsForTask({ taskAllowedCommands: ["pnpm test"], requiredChecks: ["pnpm typecheck"], planGates: ["pnpm test:run"] })).toEqual(["pnpm test"]);
    expect(allowedCommandsForTask({ requiredChecks: ["pnpm typecheck"], planGates: ["pnpm test:run"] })).toEqual(["pnpm typecheck"]);
    expect(allowedCommandsForTask({ planGates: ["pnpm test:run"] })).toEqual(["pnpm test:run"]);
    expect(allowedCommandsForTask({ planGates: ["pnpm test", "pnpm typecheck"] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm build && pnpm test:run -- tests/unit/task-contract.test.ts
```

Expected: fail because `src/core/task-contract.ts` does not exist.

- [ ] **Step 3: Implement `src/core/task-contract.ts`**

Create `src/core/task-contract.ts`:

```ts
import type { AgentHarnessTask, RiskLevel, TaskSurface } from "./plan-types.js";
import type { RunTask } from "./run-types.js";

const SURFACE_BY_PATH: Array<[RegExp, TaskSurface]> = [
  [/^supabase\/migrations\//, "db"],
  [/^supabase\/functions\//, "api"],
  [/(^|\/)(auth|permissions|session|rls)(\/|\.|-)/i, "auth"],
  [/(^|\/)(ai|llm|prompt|prompts)(\/|\.|-)/i, "ai"],
  [/\.(md|mdx)$/i, "docs"],
  [/(^src\/(components|pages|features)\/|\.(tsx|jsx|css)$)/i, "ui_layout"],
  [/^src\//, "backend"],
];

export const SURFACE_REQUIREMENTS: Record<TaskSurface, string[]> = {
  ui_layout: ["focused_tests", "scoped_lint", "scoped_typecheck", "browser_smoke|visual_assertion"],
  ui: ["focused_tests", "scoped_lint", "scoped_typecheck"],
  backend: ["focused_tests", "scoped_typecheck"],
  api: ["focused_tests", "scoped_typecheck", "api_contract"],
  auth: ["focused_tests", "scoped_typecheck", "authz_negative_test"],
  db: ["migration_or_schema_check", "rollback_plan"],
  ai: ["golden_case", "schema_validation", "rollback_plan"],
  docs: [],
  generic: [],
};

const MAX_FILES_BY_RISK: Record<RiskLevel, number> = { L1: 3, L2: 3, L3: 2 };
const HIGH_RISK_SURFACES: TaskSurface[] = ["auth", "db", "api", "ai"];

export function inferTaskSurface(files: string[]): TaskSurface {
  for (const file of files) {
    const normalized = file.replace(/\\/g, "/");
    const match = SURFACE_BY_PATH.find(([pattern]) => pattern.test(normalized));
    if (match) return match[1];
  }
  return "generic";
}

export function requiredEvidenceForTask(input: { planTask?: Pick<AgentHarnessTask, "files" | "required_evidence" | "surface">; runTask?: Pick<RunTask, "files" | "required_evidence" | "status" | "surface"> }): string[] {
  if (input.planTask?.required_evidence?.length) return unique(input.planTask.required_evidence);
  if (input.runTask?.required_evidence?.length) return unique(input.runTask.required_evidence);
  const files = [...(input.planTask?.files ?? []), ...(input.runTask?.files ?? [])];
  const surface = (input.planTask?.surface ?? input.runTask?.surface ?? inferTaskSurface(files)) as TaskSurface;
  const base = SURFACE_REQUIREMENTS[surface] ?? [];
  const memory = input.runTask && taskNeedsFreshCodebaseMemory(input.runTask, surface) ? ["codebase_memory_fresh"] : [];
  return unique([...base, ...memory]);
}

export function maxFilesForRisk(riskLevel: RiskLevel): number {
  return MAX_FILES_BY_RISK[riskLevel] ?? 3;
}

export function allowedCommandsForTask(input: { taskAllowedCommands?: string[]; requiredChecks?: string[]; planGates?: string[] }): string[] {
  if (input.taskAllowedCommands?.length) return unique(input.taskAllowedCommands);
  if (input.requiredChecks?.length) return unique(input.requiredChecks);
  if (input.planGates?.length === 1) return unique(input.planGates);
  return [];
}

function taskNeedsFreshCodebaseMemory(task: Pick<RunTask, "status">, surface: TaskSurface): boolean {
  return HIGH_RISK_SURFACES.includes(surface) && task.status !== "not_started";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}
```

- [ ] **Step 4: Run focused test to verify it passes**

Run:

```bash
pnpm build && pnpm test:run -- tests/unit/task-contract.test.ts
```

Expected: pass.

---

### Task 2: Refactor plan compiler and evidence policy to use task contract

**Files:**
- Modify: `src/core/plan-compiler.ts`
- Modify: `src/core/evidence-policy.ts`
- Test: `tests/unit/plan-compiler.test.ts`
- Test: `tests/unit/evidence-policy.test.ts`
- Test: `tests/unit/task-contract.test.ts`

- [ ] **Step 1: Replace duplicated plan compiler constants**

In `src/core/plan-compiler.ts`, remove local `SURFACE_BY_PATH`, `EVIDENCE_BY_SURFACE`, `MAX_FILES_BY_RISK`, and local `inferSurface()`.

Add import:

```ts
import { allowedCommandsForTask, inferTaskSurface, maxFilesForRisk, requiredEvidenceForTask } from "./task-contract.js";
```

Change these lines inside `compilePlan()` and `compileTask()`:

```ts
const maxFiles = maxFilesForRisk(plan.risk_level);
const surface = task.surface ?? inferTaskSurface(files);
const requiredEvidence = requiredEvidenceForTask({ planTask: { ...task, files, surface } });
const allowedCommands = allowedCommandsForTask({
  taskAllowedCommands: task.allowed_commands,
  requiredChecks: task.required_checks,
  planGates,
});
```

- [ ] **Step 2: Run plan compiler tests**

Run:

```bash
pnpm build && pnpm test:run -- tests/unit/plan-compiler.test.ts tests/unit/task-contract.test.ts
```

Expected: pass.

- [ ] **Step 3: Replace duplicated evidence policy requirements**

In `src/core/evidence-policy.ts`, remove local `SURFACE_REQUIREMENTS`, local `inferSurface()`, and local `taskNeedsFreshCodebaseMemory()`.

Add import:

```ts
import { requiredEvidenceForTask } from "./task-contract.js";
```

Change `requiredEvidenceForTask()` call site by renaming the local helper or replacing it with:

```ts
const required = requiredEvidenceForTask({ task, planTask });
```

If TypeScript name conflict occurs, import as:

```ts
import { requiredEvidenceForTask as taskRequiredEvidence } from "./task-contract.js";
```

and call:

```ts
const required = taskRequiredEvidence({ runTask: task, planTask });
```

- [ ] **Step 4: Run evidence tests**

Run:

```bash
pnpm build && pnpm test:run -- tests/unit/evidence-policy.test.ts tests/unit/core.test.ts tests/unit/task-contract.test.ts
```

Expected: pass.

---

### Task 3: Make auto claims a canonical completion requirement

**Files:**
- Modify: `src/core/auto-claims.ts`
- Modify: `src/core/finish-check.ts`
- Modify: `src/core/state-machine.ts`
- Modify: `tests/unit/core.test.ts`
- Modify: `tests/unit/finish-check.test.ts`
- Modify: `tests/integration/cli.test.ts`

- [ ] **Step 1: Add missing-auto-claims helper test**

In `tests/unit/finish-check.test.ts`, add a test after the pending-task test:

```ts
it("fails when a completed run is missing required auto claims", () => {
  const state = readyState();
  state.verified_claims = state.verified_claims.filter((claim) => claim.kind !== "task_reconciled");

  const result = assessFinishReadiness({ state, touchedFiles: { ok: true, files: ["created.txt"] } });

  expect(result.ready).toBe(false);
  expect(result.errors.join("\n")).toContain("missing_auto_claims");
});
```

- [ ] **Step 2: Export claim helpers from auto-claims**

Modify `src/core/auto-claims.ts` by exporting `claimKey()` and adding `missingAutoClaims()`:

```ts
import type { HarnessClaim } from "./action-types.js";
import type { AgentHarnessRunState, VerifiedClaim } from "./run-types.js";

export function missingAutoClaims(state: AgentHarnessRunState): HarnessClaim[] {
  const verifiedKeys = new Set(state.verified_claims.filter((claim) => claim.verified).map(claimKey));
  return buildAutoClaims(state).filter((claim) => !verifiedKeys.has(claimKey(claim)));
}

export function claimKey(claim: Pick<VerifiedClaim, "kind" | "value" | "evidence_id">): string {
  return `${claim.kind}:${claim.value}:${claim.evidence_id}`;
}
```

Keep existing `buildAutoClaims()` and `dedupeClaims()` behavior unchanged.

- [ ] **Step 3: Use helper in finish-check**

In `src/core/finish-check.ts`, replace local `claimKey()` and manual auto-claim comparison with:

```ts
import { missingAutoClaims } from "./auto-claims.js";
```

Then compute:

```ts
const missingAutoClaimsCount = missingAutoClaims(input.state).length;
```

Use `missingAutoClaimsCount` in the existing error and data fields.

- [ ] **Step 4: Enforce auto claims in final report**

In `src/core/state-machine.ts`, import:

```ts
import { missingAutoClaims } from "./auto-claims.js";
```

In the `final_report` branch, after checking unverified claims and unfinished tasks, add:

```ts
const missingClaims = missingAutoClaims(next);
if (missingClaims.length) throw new Error(`final_report requires auto claims: ${missingClaims.length} missing`);
```

- [ ] **Step 5: Update core tests that manually claim completion**

In `tests/unit/core.test.ts`, where a final report test manually provides claims, include a `task_reconciled` claim for each completed task/evidence pair:

```ts
{ claim_id: "c-task", kind: "task_reconciled", value: "unit-task", evidence_id: "ev-green" }
```

For tests where the exact claim IDs do not matter, prefer:

```ts
claims: buildAutoClaims(state)
```

- [ ] **Step 6: Add direct final-report negative test**

In `tests/unit/core.test.ts`, add a test that creates a completed/evidenced state, verifies only a gate claim, and expects final report to throw:

```ts
expect(() =>
  processHarnessAction({
    plan: plan(),
    previousState: stateWithOnlyGateClaim,
    runId: "missing-auto-claim-run",
    mode: "constrained",
    config,
    action: { schema_version: ACTION_SCHEMA_VERSION, type: "final_report", summary: "validated" },
  }),
).toThrow("final_report requires auto claims");
```

- [ ] **Step 7: Run completion tests**

Run:

```bash
pnpm build && pnpm test:run -- tests/unit/core.test.ts tests/unit/finish-check.test.ts tests/integration/cli.test.ts
```

Expected: pass after updating tests to use `claim auto` or full auto-claim sets.

---

### Task 4: Tighten strict manual gate evidence while preserving weak compatibility

**Files:**
- Modify: `src/cli/macro.ts`
- Modify: `tests/integration/cli.test.ts`
- Modify: `tests/unit/public-readiness.test.ts` if weak macro flows are affected

- [ ] **Step 1: Add strict manual gate rejection integration test**

In `tests/integration/cli.test.ts`, add a test near the strict exact verify test:

```ts
it("blocks strict manual gate pass without external evidence metadata", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-strict-manual-gate-"));
  fs.copyFileSync("tests/fixtures/plans/weak-exact-plan.json", path.join(tmp, "plan.json"));
  fs.writeFileSync(path.join(tmp, "created.txt"), "ok");
  execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "strict-manual", "--mode", "strict"], { cwd: tmp });
  execFileSync("node", [bin, "files", "declare", "--files", "created.txt"], { cwd: tmp });
  execFileSync("node", [bin, "task", "start", "--task-id", "weak-exact-task", "--files", "created.txt"], { cwd: tmp });

  const output = tryCli(["gate", "pass", "--check", "node --version", "--type", "focused_tests"], tmp);

  expect(output.status).toBe("error");
  expect(output.summary).toContain("strict manual evidence requires --output-ref and --sha256");
});
```

- [ ] **Step 2: Add strict external evidence success test**

In the same file, add:

```ts
it("allows strict manual gate pass with external evidence metadata", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-strict-external-gate-"));
  fs.copyFileSync("tests/fixtures/plans/weak-exact-plan.json", path.join(tmp, "plan.json"));
  fs.writeFileSync(path.join(tmp, "created.txt"), "ok");
  fs.mkdirSync(path.join(tmp, ".checks"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".checks", "external.log"), "external check passed\n");
  const sha256 = "0".repeat(64);

  execFileSync("node", [bin, "session", "start", "--plan", "plan.json", "--run-id", "strict-external", "--mode", "strict"], { cwd: tmp });
  execFileSync("node", [bin, "files", "declare", "--files", "created.txt"], { cwd: tmp });
  execFileSync("node", [bin, "task", "start", "--task-id", "weak-exact-task", "--files", "created.txt"], { cwd: tmp });

  const output = JSON.parse(execFileSync("node", [bin, "gate", "pass", "--check", "node --version", "--type", "focused_tests", "--output-ref", ".checks/external.log", "--sha256", sha256], { cwd: tmp, encoding: "utf8" }));

  expect(output.status).toBe("success");
});
```

- [ ] **Step 3: Implement strict metadata check and evidence fields**

In `src/cli/macro.ts`, before building manual gate evidence, add helper functions:

```ts
function requireStrictExternalEvidenceMetadata(resource: string | undefined, verb: string | undefined, mode: string, flags: Record<string, string | boolean>): void {
  if (mode !== "strict") return;
  if (resource !== "gate" || (verb !== "pass" && verb !== "fail")) return;
  if (stringFlag(flags, "output-ref") && stringFlag(flags, "sha256")) return;
  throw new Error("strict manual evidence requires --output-ref and --sha256; use verify --exec for executed evidence");
}
```

Call it in `macroCommand()` after `mode` is resolved and before any `gate pass`/`gate fail` action is processed:

```ts
requireStrictExternalEvidenceMetadata(resource, verb, mode, flags);
```

Then add the optional fields in `buildMacroAction()` manual evidence object:

```ts
output_ref: stringFlag(flags, "output-ref"),
sha256: stringFlag(flags, "sha256"),
```

- [ ] **Step 4: Preserve weak compatibility with a compact warning**

Do not block weak manual evidence in this task. If adding a warning is straightforward without changing output contracts, add this data field only for weak manual evidence without metadata:

```ts
manual_evidence_warning: "prefer verify; external evidence should include output_ref and sha256"
```

If adding the warning complicates the output path, leave weak unchanged and rely on docs plus `next --exact` steering.

- [ ] **Step 5: Run manual gate tests**

Run:

```bash
pnpm build && pnpm test:run -- tests/integration/cli.test.ts tests/unit/public-readiness.test.ts
```

Expected: pass.

---

### Task 5: Update docs and changelog without increasing token budgets

**Files:**
- Modify: `README.md`
- Modify: `docs/agent-runtime.md`
- Modify: `docs/configuration.md`
- Modify: `CHANGELOG.md`
- Test: `scripts/token-budget.mjs`

- [ ] **Step 1: Update README with the new rule**

Add a short paragraph in the usage/evidence section:

```md
For weak and strict runs, prefer `agent-harness verify` because it executes the command and stores `output_ref` plus `sha256`. Manual `gate pass`/`gate fail` is for externally proven evidence; strict mode requires `--output-ref` and `--sha256` for that path.
```

- [ ] **Step 2: Keep runtime doc compact**

In `docs/agent-runtime.md`, update the weak line to stay short:

```md
- Weak: `--mode weak`; 1 task, <=2 files, typed evidence; prefer `verify --exec`.
```

- [ ] **Step 3: Update configuration docs**

In `docs/configuration.md`, add one concise sentence under command policy or harnessability:

```md
Strict manual evidence must include `output_ref` and `sha256`; weak agents are steered to `verify` to avoid unexecuted pass claims.
```

- [ ] **Step 4: Add changelog entry**

In `CHANGELOG.md` under `[Unreleased]`, add:

```md
- Hardened completion so final reports require the same auto-claim coverage checked by `finish --check`.
- Centralized task surface and required-evidence inference in one task contract.
- Tightened strict manual gate evidence by requiring external proof metadata.
```

- [ ] **Step 5: Run docs/token checks**

Run:

```bash
git diff --check -- README.md docs/agent-runtime.md docs/configuration.md CHANGELOG.md
node scripts/token-budget.mjs
```

Expected: both pass. If `docs/agent-runtime.md` exceeds its budget, shorten wording rather than raising the budget.

---

### Task 6: Full proportional verification

**Files:**
- All changed files

- [ ] **Step 1: Run focused tests first**

Run:

```bash
pnpm build && pnpm test:run -- tests/unit/task-contract.test.ts tests/unit/plan-compiler.test.ts tests/unit/evidence-policy.test.ts tests/unit/finish-check.test.ts tests/unit/core.test.ts tests/integration/cli.test.ts tests/unit/public-readiness.test.ts
```

Expected: pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: pass.

- [ ] **Step 3: Run full test suite because this is L3**

Run:

```bash
pnpm test:run
```

Expected: pass.

- [ ] **Step 4: Run token budget and release-readiness gates**

Run:

```bash
node scripts/token-budget.mjs
pnpm audit:release-readiness
```

Expected: pass.

- [ ] **Step 5: Inspect public diff**

Run:

```bash
git diff -- src/core src/cli tests README.md docs CHANGELOG.md schemas
```

Expected:

- No new dependency.
- No worker/daemon/bus code.
- No schema breaking field addition.
- No loosened command policy.
- No weakened scope guard.
- Weak exact path still points to `verify`.
- Strict manual evidence without metadata fails closed.

---

## Rollback plan

If any L3 gate fails and the cause is not obvious after one debugging pass:

1. Revert strict manual evidence changes first:
   - `src/cli/macro.ts`
   - related integration tests
2. Keep `task-contract.ts` only if all task/evidence tests pass; otherwise revert Task 1 and Task 2 together.
3. Revert auto-claim final-report enforcement if it creates unacceptable compatibility breakage, but keep the new negative test as skipped only after explicit maintainer decision.
4. Restore docs/changelog to match the surviving behavior.
5. Re-run:

```bash
pnpm typecheck
pnpm test:run
node scripts/token-budget.mjs
```

## Residual risks

- Enforcing auto claims in `final_report` can break callers that manually used partial claim sets. This is intentional safety hardening but must be called out in release notes.
- Strict manual evidence metadata does not prove the external log hash matches the file unless a later task validates it. This plan only prevents metadata-free manual strict passes.
- Weak manual evidence remains compatible in this first pass. A future release can block it after telemetry/user feedback.
- `scope_guard` remains CLI/git-context dependent and is not fully enforceable inside the pure state machine. This is acceptable because `finish --check` and `finish` already perform the git-aware guard.

## Self-review

- Spec coverage: covers iii-inspired contracts, completion chokepoint, manual evidence safety, simplicity, token economy, and low-power model support.
- Placeholder scan: no intentionally unresolved implementation steps; trace-lite is explicitly deferred, not left half-designed.
- Type consistency: new functions are consistently named `inferTaskSurface`, `requiredEvidenceForTask`, `maxFilesForRisk`, `allowedCommandsForTask`, `missingAutoClaims`, and `claimKey`.
- Overengineering check: no workers, no bus, no daemon, no OTel, no new dependency.
