export interface CliEnvelope {
  status: "success" | "warning" | "error" | "halt";
  summary: string;
  artifacts: Array<{ type: string; path?: string; run_id?: string }>;
  next_actions: string[];
  errors: string[];
  data?: unknown;
}

export function envelope(input: CliEnvelope): CliEnvelope {
  return input;
}

export function writeJson(input: CliEnvelope): void {
  process.stdout.write(`${JSON.stringify(input, null, 2)}\n`);
}

export function writeCompactJson(input: CliEnvelope): void {
  process.stdout.write(`${JSON.stringify(input)}\n`);
}
