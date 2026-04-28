export interface InstallAction {
  action: "create" | "modify" | "skip" | "conflict";
  path: string;
  backup_required: boolean;
}

export function createInstallManifest(files: string[], existing: Set<string>): InstallAction[] {
  return files.map((file) => ({
    action: existing.has(file) ? "conflict" : "create",
    path: file,
    backup_required: existing.has(file),
  }));
}
