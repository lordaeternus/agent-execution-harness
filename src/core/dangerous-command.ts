const DANGEROUS_PATTERNS: Array<[RegExp, string]> = [
  [/\bDROP\b/i, "database drop"],
  [/\bTRUNCATE\b/i, "database truncate"],
  [/\bDELETE\b(?![\s\S]*\bWHERE\b)/i, "delete without where"],
  [/\bUPDATE\b(?![\s\S]*\bWHERE\b)/i, "update without where"],
  [/\bgit\s+reset\s+--hard\b/i, "git reset hard"],
  [/\bgit\s+push\b[\s\S]*(--force|--force-with-lease)/i, "git force push"],
  [/\brm\s+-rf\b/i, "recursive force remove"],
  [/\bRemove-Item\b[\s\S]*(-Recurse)[\s\S]*(-Force)/i, "recursive force remove"],
];

export function classifyDangerousCommand(command: string): string | null {
  for (const [pattern, reason] of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) return reason;
  }
  return null;
}
