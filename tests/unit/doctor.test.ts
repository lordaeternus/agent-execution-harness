import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/core/config.js";
import { assessHarnessability, doctorControls } from "../../src/core/doctor.js";

describe("doctor harnessability", () => {
  it("scores sparse projects lower than configured projects", () => {
    const sparse = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-sparse-"));
    fs.writeFileSync(path.join(sparse, "package.json"), `${JSON.stringify({ name: "sparse", scripts: {} }, null, 2)}\n`);

    const configured = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-configured-"));
    fs.mkdirSync(path.join(configured, "docs"), { recursive: true });
    fs.mkdirSync(path.join(configured, "tests"), { recursive: true });
    fs.writeFileSync(
      path.join(configured, "package.json"),
      `${JSON.stringify({ name: "configured", scripts: { lint: "eslint .", "test:run": "vitest run", typecheck: "tsc --noEmit" } }, null, 2)}\n`,
    );
    fs.writeFileSync(path.join(configured, "AGENTS.md"), "# Rules\n");
    fs.writeFileSync(path.join(configured, "agent-harness.config.json"), "{}\n");
    fs.writeFileSync(path.join(configured, "docs", "agent-runtime.md"), "# Runtime\n");
    fs.writeFileSync(path.join(configured, ".gitignore"), ".agent-harness/runs/\n");

    const sparseScore = assessHarnessability(sparse, defaultConfig()).score;
    const configuredReport = assessHarnessability(configured, defaultConfig());
    expect(configuredReport.score).toBeGreaterThan(sparseScore);
    expect(configuredReport.weak).not.toContain("agents_rules");
  });

  it("exposes low-token controls to doctor output", () => {
    expect(doctorControls().map((control) => control.id)).toContain("scope_guard");
  });
});
