import type { CommandPolicy } from "./config-types.js";
import { classifyDangerousCommand } from "./dangerous-command.js";

export interface CommandPolicyResult {
  allowed: boolean;
  reason?: string;
}

export function evaluateCommandPolicy(command: string, policy: CommandPolicy = {}): CommandPolicyResult {
  const dangerous = classifyDangerousCommand(command);
  if (dangerous) return { allowed: false, reason: dangerous };
  for (const denied of policy.deny ?? []) {
    if (command.toLowerCase().includes(denied.toLowerCase())) return { allowed: false, reason: `denied by config: ${denied}` };
  }
  const allow = policy.allow ?? [];
  if (allow.length > 0 && !allow.some((item) => command.toLowerCase().startsWith(item.toLowerCase()))) {
    return { allowed: false, reason: "not allowed by command policy" };
  }
  return { allowed: true };
}
