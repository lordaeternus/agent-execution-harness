import { spawnSync } from "node:child_process";

const result =
  process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", "pnpm exec tsc"], { stdio: "inherit" })
    : spawnSync("pnpm", ["exec", "tsc"], { stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
