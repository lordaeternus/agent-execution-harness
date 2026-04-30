import fs from "node:fs";
import path from "node:path";
import { assertSafeId, assertSafeRelativePath } from "../core/utils.js";

export interface ActiveSession {
  plan_path: string;
  run_id: string;
  mode: string;
}

export function activeSessionPath(cwd: string, artifactDir: string): string {
  assertSafeRelativePath(artifactDir, "artifact_dir");
  return path.resolve(cwd, artifactDir, "active-session.json");
}

export function loadActiveSession(cwd: string, artifactDir: string): ActiveSession | null {
  const file = activeSessionPath(cwd, artifactDir);
  if (!fs.existsSync(file)) return null;
  const session = JSON.parse(fs.readFileSync(file, "utf8")) as ActiveSession;
  validateSession(session);
  return session;
}

export function saveActiveSession(cwd: string, artifactDir: string, session: ActiveSession): string {
  validateSession(session);
  const file = activeSessionPath(cwd, artifactDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(session)}\n`);
  return file;
}

function validateSession(session: ActiveSession): void {
  assertSafeRelativePath(session.plan_path, "plan_path");
  assertSafeId(session.run_id, "run_id");
  if (!["strong", "standard", "constrained"].includes(session.mode)) throw new Error("session.mode is invalid");
}
