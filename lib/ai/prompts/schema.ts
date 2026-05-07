import { toJSONSchema, type ZodType } from 'zod';

export const PROVIDER_SCHEMA_MODE_ENV = 'PIPELINE_PROVIDER_SCHEMA_MODE';

export type ProviderJsonSchemaMode = 'full' | 'slim';

type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripDescriptionKeys(value: JsonValue, parentKey?: string): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => stripDescriptionKeys(item, parentKey));
  }

  if (!isJsonObject(value)) {
    return value;
  }

  const result: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'description' && parentKey !== 'properties') {
      continue;
    }
    result[key] = stripDescriptionKeys(child, key);
  }
  return result;
}

export function getProviderJsonSchemaMode(
  env: Record<string, string | undefined> = process.env
): ProviderJsonSchemaMode {
  return env[PROVIDER_SCHEMA_MODE_ENV] === 'slim' ? 'slim' : 'full';
}

export function toProviderJsonSchema<T>(
  schema: ZodType<T>,
  options?: { mode?: ProviderJsonSchemaMode }
): ReturnType<typeof toJSONSchema> {
  const jsonSchema = toJSONSchema(schema);
  const mode = options?.mode ?? getProviderJsonSchemaMode();

  if (mode === 'full') {
    return jsonSchema;
  }

  return stripDescriptionKeys(jsonSchema as JsonValue) as ReturnType<
    typeof toJSONSchema
  >;
}
