import type { ObservationFormat } from "./config-types.js";
import type { DispatchRuntimeCapability } from "./dispatch-types.js";

export type ShellPermissionModel = "ask" | "allow" | "deny" | "unknown";

export interface RuntimeCapabilities {
  runtime_name?: string;
  instruction_files: string[];
  supports_subagents: boolean;
  supports_worktrees: boolean;
  supports_json_output: boolean;
  shell_permission_model: ShellPermissionModel;
  preferred_output_format: ObservationFormat;
  max_parallel: number;
}

export const DEFAULT_RUNTIME_CAPABILITIES: RuntimeCapabilities = {
  instruction_files: ["AGENTS.md"],
  supports_subagents: false,
  supports_worktrees: false,
  supports_json_output: true,
  shell_permission_model: "unknown",
  preferred_output_format: "compact",
  max_parallel: 1,
};

export function normalizeRuntimeCapabilities(input?: Partial<RuntimeCapabilities>): RuntimeCapabilities {
  const merged = { ...DEFAULT_RUNTIME_CAPABILITIES, ...(input ?? {}) };
  return {
    ...merged,
    instruction_files: normalizeInstructionFiles(merged.instruction_files),
    max_parallel: normalizeMaxParallel(merged.max_parallel),
  };
}

export function dispatchRuntimeFromCapabilities(capabilities: Partial<RuntimeCapabilities>): DispatchRuntimeCapability {
  return normalizeRuntimeCapabilities(capabilities).supports_subagents === true ? "subagents" : "serial_only";
}

function normalizeInstructionFiles(value: string[] | undefined): string[] {
  if (!Array.isArray(value) || value.length === 0) return [...DEFAULT_RUNTIME_CAPABILITIES.instruction_files];
  return [...new Set(value.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))];
}

function normalizeMaxParallel(value: number): number {
  return Number.isInteger(value) && value >= 1 ? value : 1;
}
