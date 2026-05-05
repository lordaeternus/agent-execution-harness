import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { validateApprovedFixture } from "../../src/core/approved-fixtures.js";

describe("approved fixtures", () => {
  it("accepts owner-approved critical behavior fixtures", () => {
    const fixture = JSON.parse(fs.readFileSync("tests/fixtures/approved/basic-approved-fixture.json", "utf8"));
    expect(validateApprovedFixture(fixture)).toEqual({ status: "success", errors: [] });
  });

  it("rejects fixtures that are not owner approved", () => {
    const fixture = JSON.parse(fs.readFileSync("tests/fixtures/approved/basic-approved-fixture.json", "utf8")) as Record<string, unknown>;
    fixture.owner_approved = false;
    const result = validateApprovedFixture(fixture);
    expect(result.status).toBe("error");
    expect(result.errors.join("\n")).toContain("owner_approved");
  });
});
