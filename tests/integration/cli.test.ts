import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const bin = path.resolve("dist/cli/index.js");

describe("cli integration", () => {
  it("runs plan-lint and execute", () => {
    execFileSync("node", [bin, "plan-lint", "--plan", "tests/fixtures/plans/basic-plan.json"], { stdio: "pipe" });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-cli-"));
    fs.copyFileSync("tests/fixtures/plans/basic-plan.json", path.join(tmp, "plan.json"));
    const output = execFileSync("node", [bin, "execute", "--plan", "plan.json", "--run-id", "cli-smoke"], { cwd: tmp, encoding: "utf8" });
    expect(output).toContain("declare_files");
    expect(fs.existsSync(path.join(tmp, ".agent-harness/runs/cli-smoke.json"))).toBe(true);
  });
});
