import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PATTERNS = [/sk-[A-Za-z0-9]{20,}/, /ghp_[A-Za-z0-9]{20,}/, /service_role[A-Za-z0-9._-]{10,}/i];
const SKIP = new Set(["node_modules", "dist", ".git"]);
const findings = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const text = fs.readFileSync(full, "utf8");
      if (PATTERNS.some((pattern) => pattern.test(text))) findings.push(path.relative(ROOT, full));
    }
  }
}

walk(ROOT);
if (findings.length) {
  console.error(JSON.stringify({ status: "error", findings }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "success", findings: [] }, null, 2));
}
