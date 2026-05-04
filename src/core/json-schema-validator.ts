import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import { ACTION_SCHEMA_VERSION, CONFIG_SCHEMA_VERSION, PLAN_SCHEMA_VERSION, RUN_SCHEMA_VERSION } from "./constants.js";

type SchemaName =
  | typeof ACTION_SCHEMA_VERSION
  | typeof CONFIG_SCHEMA_VERSION
  | typeof PLAN_SCHEMA_VERSION
  | typeof RUN_SCHEMA_VERSION;

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators = new Map<SchemaName, ValidateFunction>();

export function validateAgainstSchema(schemaName: SchemaName, value: unknown): string[] {
  const validate = validator(schemaName);
  if (validate(value)) return [];
  return (validate.errors ?? []).map((error: ErrorObject) => {
    const location = error.instancePath || "/";
    return `${schemaName}${location} ${error.message ?? "is invalid"}`;
  });
}

function validator(schemaName: SchemaName): ValidateFunction {
  const existing = validators.get(schemaName);
  if (existing) return existing;
  const schema = JSON.parse(fs.readFileSync(schemaPath(schemaName), "utf8")) as object;
  const compiled = ajv.compile(schema);
  validators.set(schemaName, compiled);
  return compiled;
}

function schemaPath(schemaName: SchemaName): string {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  return path.join(root, "schemas", `${schemaName}.schema.json`);
}
