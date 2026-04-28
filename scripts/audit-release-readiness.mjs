import fs from "node:fs";

const required = [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CHANGELOG.md",
  "schemas/agent_harness_plan_v1.schema.json",
  "templates/generic/AGENTS.md",
  ".github/workflows/ci.yml"
];
const missing = required.filter((file) => !fs.existsSync(file));
const status = missing.length ? "error" : "success";
console.log(JSON.stringify({ status, findings: missing.map((file) => ({ severity: "P1", file })) }, null, 2));
process.exitCode = missing.length ? 1 : 0;
