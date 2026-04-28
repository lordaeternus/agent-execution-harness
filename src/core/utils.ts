import fs from "node:fs";
import path from "node:path";

export function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} must be a non-empty string`);
}

export function assertSafeId(value: string, field: string): void {
  assertNonEmptyString(value, field);
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) throw new Error(`${field} contains unsafe characters`);
}

export function assertSafeRelativePath(value: string, field: string): void {
  assertNonEmptyString(value, field);
  if (path.isAbsolute(value) || value.includes("..")) throw new Error(`${field} must be a safe relative path`);
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}
