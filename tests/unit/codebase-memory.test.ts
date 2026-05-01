import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/core/config.js";
import { initMemory, queryMemory, recordMemory, updateMemory } from "../../src/core/codebase-memory.js";

function tempProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-memory-"));
  fs.mkdirSync(path.join(tmp, "src/auth"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "src/components"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "node_modules/pkg"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src/auth/session.ts"), "export const session = true;\n");
  fs.writeFileSync(path.join(tmp, "src/components/Card.tsx"), "export function Card() { return null; }\n");
  fs.writeFileSync(path.join(tmp, "node_modules/pkg/index.js"), "ignored\n");
  return tmp;
}

describe("codebase memory", () => {
  it("initializes product file index without dependency folders", () => {
    const cwd = tempProject();
    const config = defaultConfig();
    const result = initMemory(cwd, config);
    const fileIndex = JSON.parse(fs.readFileSync(path.join(cwd, ".agent-harness/memory/file-index.json"), "utf8"));
    expect(result.files).toBe(2);
    expect(Object.keys(fileIndex.files)).toEqual(["src/auth/session.ts", "src/components/Card.tsx"]);
  });

  it("marks changed files as stale until durable memory is recorded", () => {
    const cwd = tempProject();
    const config = defaultConfig();
    initMemory(cwd, config);
    fs.writeFileSync(path.join(cwd, "src/auth/session.ts"), "export const session = 'changed';\n");
    const update = updateMemory(cwd, config, ["src/auth/session.ts"]);
    expect(update.touched_surfaces).toEqual(["auth"]);
    expect(queryMemory(cwd, config, "auth").status).toBe("stale");
    const record = recordMemory(cwd, config, {
      surface: "auth",
      files: ["src/auth/session.ts"],
      summary: "Session auth surface owns login state contracts and must be checked against authorization call sites before edits.",
      confidence: "high",
    });
    expect(record.status).toBe("fresh");
  });

  it("rejects generic summaries and incomplete subagent records", () => {
    const cwd = tempProject();
    const config = defaultConfig();
    initMemory(cwd, config);
    expect(() =>
      recordMemory(cwd, config, {
        surface: "auth",
        files: ["src/auth/session.ts"],
        summary: "code updated",
      }),
    ).toThrow("memory summary");
    expect(() =>
      recordMemory(cwd, config, {
        surface: "auth",
        files: ["src/auth/session.ts"],
        summary: "Auth session contract summary produced by a read-only subagent and requiring main-agent validation.",
        subagent: true,
        confidence: "medium",
      }),
    ).toThrow("subagent memory requires");
  });
});
