import { spawnSync } from "node:child_process";

const result = process.platform === "win32"
  ? spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "npm pack --dry-run"], { stdio: "inherit" })
  : spawnSync("npm", ["pack", "--dry-run"], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
