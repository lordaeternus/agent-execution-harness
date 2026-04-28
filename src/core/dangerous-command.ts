const DANGEROUS_PATTERNS: Array<[RegExp, string]> = [
  [/\bDROP\b/i, "database drop"],
  [/\bTRUNCATE\b/i, "database truncate"],
  [/\bALTER\s+TABLE\b/i, "database schema alteration"],
  [/\bDELETE\b(?![\s\S]*\bWHERE\b)/i, "delete without where"],
  [/\bUPDATE\b(?![\s\S]*\bWHERE\b)/i, "update without where"],
  [/\bgit\s+reset\s+--hard\b/i, "git reset hard"],
  [/\bgit\s+clean\b[\s\S]*-[a-z]*f/i, "git clean force"],
  [/\bgit\s+push\b[\s\S]*(--force|--force-with-lease)/i, "git force push"],
  [/\brm\s+-rf\b/i, "recursive force remove"],
  [/\bdel\b[\s\S]*\/[sq]\b/i, "recursive delete"],
  [/[>]{1,2}\s*(\.env|.*secret|.*token)/i, "redirect to sensitive file"],
  [/\bRemove-Item\b[\s\S]*(-Recurse)[\s\S]*(-Force)/i, "recursive force remove"],
];

export function classifyDangerousCommand(command: string): string | null {
  const normalized = normalizeCommand(command);
  for (const [pattern, reason] of DANGEROUS_PATTERNS) {
    if (pattern.test(normalized)) return reason;
  }
  return null;
}

function normalizeCommand(command: string): string {
  return command
    .replace(/[`'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
