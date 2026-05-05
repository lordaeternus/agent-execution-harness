import path from "node:path";
import { validateApprovedFixture } from "../core/approved-fixtures.js";
import { readJson } from "../core/utils.js";
import { parseFlags, stringFlag } from "./args.js";
import { writeJson } from "./output.js";

export function fixturesCommand(args: string[], cwd = process.cwd()): void {
  const [subcommand, ...rest] = args;
  if (subcommand !== "validate") throw new Error("fixtures command must be: fixtures validate --file <path>");
  const flags = parseFlags(rest);
  const file = stringFlag(flags, "file", true)!;
  const result = validateApprovedFixture(readJson(path.resolve(cwd, file)));
  writeJson({
    status: result.status,
    summary: result.status === "success" ? "approved fixture valid" : "approved fixture invalid",
    artifacts: [{ type: "approved_fixture", path: file }],
    next_actions: result.status === "success" ? [] : ["fix_fixture"],
    errors: result.errors,
  });
  if (result.status === "error") process.exitCode = 1;
}
