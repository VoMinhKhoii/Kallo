import { toJSONSchema, type ZodType } from 'zod';

export const PROVIDER_SCHEMA_MODE_ENV = 'PIPELINE_PROVIDER_SCHEMA_MODE';

export type ProviderJsonSchemaMode = 'full' | 'slim';

type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const RUNTIME_OWNED_ID_KEYS = new Set(['mealItemId', 'ingredientId']);

function stripDescriptionAndRuntimeIdKeys(
  value: JsonValue,
  parentKey?: string
): JsonValue {
  if (Array.isArray(value)) {
    const items = value
      .filter(
        (item) =>
          parentKey !== 'required' ||
          typeof item !== 'string' ||
          !RUNTIME_OWNED_ID_KEYS.has(item)
      )
      .map((item) => stripDescriptionAndRuntimeIdKeys(item, parentKey));
    return items;
  }

  if (!isJsonObject(value)) {
    return value;
  }

  const result: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'description' && parentKey !== 'properties') {
      continue;
    }
    if (parentKey === 'properties' && RUNTIME_OWNED_ID_KEYS.has(key)) {
      continue;
    }
    result[key] = stripDescriptionAndRuntimeIdKeys(child, key);
  }
  return result;
}

export function getProviderJsonSchemaMode(
  env: Record<string, string | undefined> = process.env
): ProviderJsonSchemaMode {
  return env[PROVIDER_SCHEMA_MODE_ENV] === 'slim' ? 'slim' : 'full';
}

export type ProviderJsonSchema = ReturnType<
  typeof toJSONSchema<ZodType<unknown>>
>;

export function toProviderJsonSchema<T>(
  schema: ZodType<T>,
  options?: { mode?: ProviderJsonSchemaMode }
): ProviderJsonSchema {
  const jsonSchema = toJSONSchema(schema);
  const mode = options?.mode ?? getProviderJsonSchemaMode();

  if (mode === 'full') {
    return jsonSchema;
  }

  return stripDescriptionAndRuntimeIdKeys(
    jsonSchema as JsonValue
  ) as ProviderJsonSchema;
}
