import fs from "node:fs";

const required = [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "schemas/agent_harness_plan_v1.schema.json",
  "templates/generic/AGENTS.md",
  ".github/workflows/ci.yml"
];
const findings = required
  .filter((file) => !fs.existsSync(file))
  .map((file) => ({ severity: "P1", file, message: "required file missing" }));

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (pkg.private === true) findings.push({ severity: "P0", file: "package.json", message: "package must not be private for public readiness" });
if (pkg.license !== "MIT") findings.push({ severity: "P0", file: "package.json", message: "license must be MIT" });
if (String(pkg.version).includes("private")) findings.push({ severity: "P0", file: "package.json", message: "version must not include private suffix" });
if (pkg.bin?.["agent-harness"] !== "bin/agent-harness.mjs") {
  findings.push({ severity: "P0", file: "package.json", message: "agent-harness bin must point to bin/agent-harness.mjs" });
}

const readme = fs.existsSync("README.md") ? fs.readFileSync("README.md", "utf8") : "";
for (const requiredSection of ["## Quick Start", "## For Non-Technical Users", "## Troubleshooting", "## CLI Reference"]) {
  if (!readme.includes(requiredSection)) {
    findings.push({ severity: "P1", file: "README.md", message: `README missing ${requiredSection}` });
  }
}
if (!readme.includes("npx agent-execution-harness@latest init")) {
  findings.push({ severity: "P1", file: "README.md", message: "README missing npm/npx installation path" });
}

const ci = fs.existsSync(".github/workflows/ci.yml") ? fs.readFileSync(".github/workflows/ci.yml", "utf8") : "";
const release = fs.existsSync(".github/workflows/release.yml") ? fs.readFileSync(".github/workflows/release.yml", "utf8") : "";
if (ci.includes("pnpm test -- --run") || release.includes("pnpm test -- --run")) {
  findings.push({ severity: "P0", file: ".github/workflows", message: "workflows use invalid pnpm test invocation" });
}
if (!release.includes("id-token: write") || !release.includes("--access public")) {
  findings.push({ severity: "P1", file: ".github/workflows/release.yml", message: "release workflow missing public provenance settings" });
}

const codeowners = fs.existsSync(".github/CODEOWNERS") ? fs.readFileSync(".github/CODEOWNERS", "utf8") : "";
if (codeowners.includes("OWNER_PLACEHOLDER")) findings.push({ severity: "P1", file: ".github/CODEOWNERS", message: "CODEOWNERS placeholder still present" });

const status = findings.some((finding) => ["P0", "P1"].includes(finding.severity)) ? "error" : "success";
console.log(JSON.stringify({ status, findings }, null, 2));
process.exitCode = status === "error" ? 1 : 0;
