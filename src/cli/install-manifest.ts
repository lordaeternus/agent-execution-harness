export interface InstallAction {
  action: "create" | "merge" | "skip" | "conflict";
  path: string;
  backup_required: boolean;
  reason: string;
}

export function createInstallManifest(files: string[], existing: Set<string>): InstallAction[] {
  return files.map((file) => ({
    action: existing.has(file) ? "merge" : "create",
    path: file,
    backup_required: existing.has(file),
    reason: existing.has(file) ? "file exists and needs safe merge/backup" : "file will be created",
  }));
}
