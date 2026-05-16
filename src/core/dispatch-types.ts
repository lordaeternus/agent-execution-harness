import type { HandoffPacket } from "./handoff-types.js";

export type DispatchRuntimeCapability = "serial_only" | "subagents";
export type DispatchMode = "serial" | "parallel";
export type DispatchIsolation = "same_workspace" | "git_worktree" | "forked_workspace" | "external_patch";

export interface DispatchOptions {
  runtime_capability?: DispatchRuntimeCapability;
  max_parallel?: number;
}

export interface DispatchTaskRef {
  task_id: string;
  mode: DispatchMode;
  packet?: HandoffPacket;
}

export interface DispatchBlockedTask {
  task_id: string;
  reason: string;
}

export interface DispatchBatch {
  batch_id: string;
  mode: DispatchMode;
  tasks: DispatchTaskRef[];
  blocked_tasks: DispatchBlockedTask[];
}

export interface DispatchPlan {
  plan_id: string;
  runtime_capability: DispatchRuntimeCapability;
  batches: DispatchBatch[];
  blocked_tasks: DispatchBlockedTask[];
}
