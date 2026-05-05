import { APPROVED_FIXTURE_SCHEMA_VERSION } from "./constants.js";
import { validateAgainstSchema } from "./json-schema-validator.js";

export interface ApprovedFixtureCase {
  input: unknown;
  expected_output: unknown;
}

export interface ApprovedFixture {
  schema_version: typeof APPROVED_FIXTURE_SCHEMA_VERSION;
  fixture_id: string;
  surface: string;
  owner_approved: true;
  validator_command: string;
  cases: ApprovedFixtureCase[];
}

export interface ApprovedFixtureValidationResult {
  status: "success" | "error";
  errors: string[];
}

export function validateApprovedFixture(value: unknown): ApprovedFixtureValidationResult {
  const errors = validateAgainstSchema(APPROVED_FIXTURE_SCHEMA_VERSION, value);
  if (errors.length) return { status: "error", errors };
  const fixture = value as ApprovedFixture;
  if (fixture.owner_approved !== true) errors.push("owner_approved must be true");
  if (!fixture.cases.length) errors.push("cases must be non-empty");
  return { status: errors.length ? "error" : "success", errors };
}
