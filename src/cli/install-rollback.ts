import fs from "node:fs";
import path from "node:path";

export function restoreBackup(cwd: string, backupDir: string): number {
  if (!fs.existsSync(backupDir)) throw new Error("backup directory missing");
  let restored = 0;
  for (const file of fs.readdirSync(backupDir, { recursive: true }) as string[]) {
    const source = path.join(backupDir, file);
    if (fs.statSync(source).isDirectory()) continue;
    const target = path.join(cwd, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    restored += 1;
  }
  return restored;
}
