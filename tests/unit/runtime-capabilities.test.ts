import { describe, expect, it } from "vitest";
import { dispatchRuntimeFromCapabilities, normalizeRuntimeCapabilities } from "../../src/core/runtime-capabilities.js";

describe("runtime capabilities", () => {
  it("uses conservative serial defaults", () => {
    const capabilities = normalizeRuntimeCapabilities();
    expect(capabilities.supports_subagents).toBe(false);
    expect(capabilities.max_parallel).toBe(1);
    expect(dispatchRuntimeFromCapabilities(capabilities)).toBe("serial_only");
  });

  it("merges explicit subagent support", () => {
    const capabilities = normalizeRuntimeCapabilities({ supports_subagents: true, max_parallel: 3 });
    expect(capabilities.supports_subagents).toBe(true);
    expect(capabilities.max_parallel).toBe(3);
    expect(dispatchRuntimeFromCapabilities(capabilities)).toBe("subagents");
  });

  it("normalizes invalid max_parallel to one", () => {
    expect(normalizeRuntimeCapabilities({ max_parallel: 0 }).max_parallel).toBe(1);
  });
});
