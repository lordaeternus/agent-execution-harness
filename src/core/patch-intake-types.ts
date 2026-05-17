export interface PatchIntakeRequest {
  taskId: string;
  patchText: string;
  workerOutput?: unknown;
}

export interface PatchIntakeResult {
  valid: boolean;
  errors: string[];
  changed_files: string[];
  next_actions: string[];
}

export interface PatchApplyResult {
  applied: boolean;
  errors: string[];
}
