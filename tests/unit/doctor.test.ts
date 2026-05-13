import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/core/config.js";
import { assessArchitecture, assessCoverage, assessHarnessability, detectProjectTopology, doctorControls } from "../../src/core/doctor.js";

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

  it("detects project topology with cheap filesystem checks", () => {
    const cli = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-cli-"));
    fs.writeFileSync(path.join(cli, "package.json"), `${JSON.stringify({ name: "cli", bin: { cli: "bin.js" } })}\n`);
    expect(detectProjectTopology(cli)).toBe("cli-package");

    const web = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-web-"));
    fs.writeFileSync(path.join(web, "package.json"), "{}\n");
    fs.writeFileSync(path.join(web, "vite.config.ts"), "export default {};\n");
    expect(detectProjectTopology(web)).toBe("web-app");

    const supabase = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-supabase-"));
    fs.mkdirSync(path.join(supabase, "supabase", "functions"), { recursive: true });
    fs.writeFileSync(path.join(supabase, "package.json"), "{}\n");
    expect(detectProjectTopology(supabase)).toBe("supabase-app");
  });

  it("reports compact coverage gaps for weak-agent controls", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-coverage-"));
    fs.writeFileSync(path.join(cwd, "package.json"), "{}\n");
    fs.writeFileSync(path.join(cwd, "vite.config.ts"), "export default {};\n");
    fs.writeFileSync(path.join(cwd, "AGENTS.md"), "# Rules\n");

    const report = assessCoverage(cwd, { ...defaultConfig(), architecture_rules: [] });
    expect(report.topology).toBe("web-app");
    expect(report.covered_controls).toContain("scope_guard");
    expect(report.gaps.map((gap) => gap.control)).toEqual(expect.arrayContaining(["coding_discipline", "architecture_rules"]));
  });

  it("checks lightweight architecture rules without extra dependencies", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-architecture-"));
    fs.mkdirSync(path.join(cwd, "src", "client"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "src", "client", "view.ts"), "import { secret } from '../server/secret';\n");
    const report = assessArchitecture(cwd, {
      ...defaultConfig(),
      product_paths: ["src/"],
      architecture_rules: [{ id: "no_client_server", from: "src/client/*.ts", forbid_import: "../server/*" }],
    });
    expect(report.violations).toEqual([
      expect.objectContaining({ rule_id: "no_client_server", file: "src/client/view.ts" }),
    ]);
  });
});
