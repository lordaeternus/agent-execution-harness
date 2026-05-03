import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/core/config.js";
import { effectiveExecutionProfile } from "../../src/core/execution-profile.js";

describe("execution profile", () => {
  it("returns strict compact limits for weak mode", () => {
    const profile = effectiveExecutionProfile("weak", defaultConfig());
    expect(profile.maxFilesPerTask).toBe(2);
    expect(profile.maxClaimsPerAction).toBe(8);
    expect(profile.enforceStructuredEvidence).toBe(true);
    expect(profile.observationFormat).toBe("ultra_compact");
  });
});
