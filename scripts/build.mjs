import { spawnSync } from "node:child_process";

const pnpmCli = process.env.npm_execpath;
const result = pnpmCli
  ? spawnSync(process.execPath, [pnpmCli, "exec", "tsc"], { stdio: "inherit" })
  : spawnSync("pnpm", ["exec", "tsc"], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
