export function parseFlags(args: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) throw new Error(`unexpected argument: ${arg}`);
    const [flag, inline] = arg.split(/=(.*)/s, 2);
    const key = flag.slice(2);
    const next = args[index + 1];
    if (inline !== undefined) {
      flags[key] = inline;
    } else if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

export function stringFlag(flags: Record<string, string | boolean>, key: string, required = false): string | undefined {
  const value = flags[key];
  if (required && typeof value !== "string") throw new Error(`--${key} is required`);
  return typeof value === "string" ? value : undefined;
}
