import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lintPlan, validateConfig } from "../../src/core/schema-validation.js";

describe("repository contracts", () => {
  it("validates plan and config fixtures", () => {
    const plan = JSON.parse(fs.readFileSync("tests/fixtures/plans/basic-plan.json", "utf8"));
    expect(lintPlan(plan).status).toBe("success");
    const config = JSON.parse(fs.readFileSync("templates/generic/agent-harness.config.json", "utf8"));
    expect(() => validateConfig(config)).not.toThrow();
  });

  it("keeps required docs and templates present", () => {
    for (const file of [
      "README.md",
      "docs/protocol.md",
      "docs/configuration.md",
      "docs/versioning-and-compatibility.md",
      "templates/generic/AGENTS.md",
      ".github/workflows/ci.yml",
    ]) {
      expect(fs.existsSync(path.resolve(file))).toBe(true);
    }
  });
});
