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

  it("infers highest-priority surface independent of file order", () => {
    expect(inferTaskSurface(["README.md", "supabase/migrations/001.sql"])).toBe("db");
    expect(inferTaskSurface(["supabase/migrations/001.sql", "README.md"])).toBe("db");
    expect(inferTaskSurface(["README.md", "src/components/Button.tsx"])).toBe("ui_layout");
    expect(inferTaskSurface(["src/components/Button.tsx", "README.md"])).toBe("ui_layout");
  });

  it("returns required evidence from explicit task requirements first", () => {
    expect(
      requiredEvidenceForTask({
        planTask: {
          files: ["src/components/Button.tsx"],
          required_evidence: ["custom_check"],
        },
      }),
    ).toEqual(["custom_check"]);
  });

  it("infers default required evidence by surface", () => {
    expect(requiredEvidenceForTask({ planTask: { files: ["src/components/App.tsx"] } })).toEqual([
      "browser_smoke|visual_assertion",
      "focused_tests",
      "scoped_lint",
      "scoped_typecheck",
    ]);
    expect(requiredEvidenceForTask({ planTask: { files: ["src/auth/login.ts"] } })).toEqual([
      "authz_negative_test",
      "focused_tests",
      "scoped_typecheck",
    ]);
    expect(requiredEvidenceForTask({ planTask: { files: ["README.md"] } })).toEqual([]);
    expect(requiredEvidenceForTask({ planTask: { files: ["notes.txt"] } })).toEqual(["focused_tests"]);
  });

  it("adds fresh memory evidence for high-risk run tasks that started", () => {
    expect(
      requiredEvidenceForTask({
        runTask: {
          status: "in_progress",
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
