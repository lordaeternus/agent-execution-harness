import { describe, expect, it } from "vitest";
import { evaluateScopeGuard } from "../../src/core/scope-guard.js";

describe("scope guard", () => {
  it("allows declared files", () => {
    expect(evaluateScopeGuard({
      declared_files: ["src/login.ts"],
      touched_files: ["src/login.ts"],
      generated_allowlist: [],
    })).toMatchObject({ allowed: true, unexpected_files: [] });
  });

  it("rejects files outside the plan", () => {
    expect(evaluateScopeGuard({
      declared_files: ["src/login.ts"],
      touched_files: ["src/login.ts", "src/auth/session.ts"],
      generated_allowlist: [],
    })).toMatchObject({ allowed: false, unexpected_files: ["src/auth/session.ts"] });
  });

  it("allows generated artifacts", () => {
    expect(evaluateScopeGuard({
      declared_files: ["src/login.ts"],
      touched_files: ["src/login.ts", "docs/build-report/agent-harness/runs/run.json"],
      generated_allowlist: ["docs/build-report/agent-harness/**"],
    })).toMatchObject({ allowed: true, unexpected_files: [] });
  });

  it("normalizes Windows paths", () => {
    expect(evaluateScopeGuard({
      declared_files: ["src/login.ts"],
      touched_files: ["src\\login.ts", "src\\other.ts"],
      generated_allowlist: [],
    })).toMatchObject({ allowed: false, unexpected_files: ["src/other.ts"] });
  });
});
