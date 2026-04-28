import fs from "node:fs";
import path from "node:path";

export interface BackupEntry {
  path: string;
  existed: boolean;
  backup_path?: string;
}

export interface BackupManifest {
  schema_version: "agent_harness_install_backup_v1";
  created_at: string;
  entries: BackupEntry[];
}

export function createBackup(cwd: string, backupDir: string, files: string[]): BackupManifest {
  fs.mkdirSync(backupDir, { recursive: true });
  const manifest: BackupManifest = {
    schema_version: "agent_harness_install_backup_v1",
    created_at: new Date().toISOString(),
    entries: [],
  };
  for (const file of files) {
    const source = path.join(cwd, file);
    const backupPath = path.join(backupDir, file);
    if (fs.existsSync(source)) {
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(source, backupPath);
      manifest.entries.push({ path: file, existed: true, backup_path: file });
    } else {
      manifest.entries.push({ path: file, existed: false });
    }
  }
  fs.writeFileSync(path.join(backupDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function restoreBackup(cwd: string, backupDir: string): number {
  if (!fs.existsSync(backupDir)) throw new Error("backup directory missing");
  const manifestPath = path.join(backupDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as BackupManifest;
    let restored = 0;
    for (const entry of manifest.entries) {
      const target = path.join(cwd, entry.path);
      if (!entry.existed) {
        if (fs.existsSync(target)) fs.rmSync(target, { force: true });
        restored += 1;
        continue;
      }
      const source = path.join(backupDir, entry.backup_path ?? entry.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
      restored += 1;
    }
    return restored;
  }
  let restored = 0;
  for (const file of fs.readdirSync(backupDir, { recursive: true }) as string[]) {
    if (file === "manifest.json") continue;
    const source = path.join(backupDir, file);
    if (fs.statSync(source).isDirectory()) continue;
    const target = path.join(cwd, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    restored += 1;
  }
  return restored;
}
