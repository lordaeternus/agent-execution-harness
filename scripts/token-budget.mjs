import fs from "node:fs";

const limits = [
  ["docs/agent-runtime.md", 1200],
  ["templates/generic/AGENTS.md", 900],
  ["templates/stetix/AGENTS.patch.md", 900],
];

const failures = [];
for (const [file, max] of limits) {
  const size = fs.readFileSync(file, "utf8").length;
  if (size > max) failures.push(`${file} has ${size} chars; max ${max}`);
}

const compactReportBudget = 1600;
const observationBudget = 700;
const ultraObservationBudget = 420;
if (compactReportBudget > 1600) failures.push("compact report budget exceeds 1600 chars");
if (observationBudget > 700) failures.push("compact observation budget exceeds 700 chars");
if (ultraObservationBudget > 420) failures.push("ultra compact observation budget exceeds 420 chars");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("token-budget pass");
}
