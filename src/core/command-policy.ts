import type { CommandPolicy } from "./config-types.js";
import { classifyDangerousCommand } from "./dangerous-command.js";

export interface CommandPolicyResult {
  allowed: boolean;
  reason?: string;
}

export function evaluateCommandPolicy(command: string, policy: CommandPolicy = {}): CommandPolicyResult {
  const dangerous = classifyDangerousCommand(command);
  if (dangerous) return { allowed: false, reason: dangerous };
  const normalized = command.trim().replace(/\s+/g, " ");
  for (const denied of policy.deny ?? []) {
    if (matchesPolicyPattern(normalized, denied)) return { allowed: false, reason: `denied by config: ${denied}` };
  }
  const allow = policy.allow ?? [];
  if (allow.length > 0 && !allow.some((item) => matchesPolicyPattern(normalized, item, true))) {
    return { allowed: false, reason: "not allowed by command policy" };
  }
  return { allowed: true };
}

export function evaluateTaskCommandPolicy(command: string, allowedCommands: string[] | undefined, mode: string, policy: CommandPolicy = {}): CommandPolicyResult {
  const base = evaluateCommandPolicy(command, policy);
  if (!base.allowed) return base;
  if (mode === "strict" && policy.strict_requires_allowed_command !== false) {
    if (!allowedCommands?.length) return { allowed: false, reason: "strict task has no allowed_commands" };
    if (!allowedCommands.some((allowed) => normalizeCommand(command) === normalizeCommand(allowed))) {
      return { allowed: false, reason: "not allowed by task allowed_commands" };
    }
  }
  return { allowed: true };
}

function matchesPolicyPattern(command: string, pattern: string, prefixOnly = false): boolean {
  const commandLower = command.toLowerCase();
  const patternLower = pattern.toLowerCase();
  if (prefixOnly) return commandLower.startsWith(patternLower);
  if (patternLower.startsWith("/") && patternLower.endsWith("/")) {
    return new RegExp(pattern.slice(1, -1), "i").test(command);
  }
  return commandLower.includes(patternLower);
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}
