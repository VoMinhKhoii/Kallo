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
/**
 * Metadata-only schema keys Gemini does NOT enforce. Stripping them shaves
 * 200-1000 tokens from the schema field of every request without changing
 * model behavior. See `stripDescriptionAndRuntimeIdKeys` for the parent-key
 * guard that keeps data fields literally named after these.
 */
const NON_ENFORCED_METADATA_KEYS = new Set([
  'description',
  'title',
  'examples',
  '$schema',
  '$id',
  'default',
  'readOnly',
  'writeOnly',
  'deprecated',
  '$comment',
]);

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
    if (NON_ENFORCED_METADATA_KEYS.has(key) && parentKey !== 'properties') {
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

/**
 * Module-level memoization. The pipeline ships with a small fixed set of
 * Zod schemas (mealDecompositionSchema, nutritionAdjustmentSchema) and two
 * modes ('full', 'slim'). `toJSONSchema` + `stripDescriptionAndRuntimeIdKeys`
 * are pure, so the result is stable per (schema-ref, mode). Memoizing avoids
 * 10-100 ms of per-request schema serialization on the LLM hot path
 * (Phase C2: lib/ai/provider/{structured-output,streaming}.ts).
 */
const providerSchemaCache = new WeakMap<
  ZodType<unknown>,
  Partial<Record<ProviderJsonSchemaMode, ProviderJsonSchema>>
>();

export function toProviderJsonSchema<T>(
  schema: ZodType<T>,
  options?: { mode?: ProviderJsonSchemaMode }
): ProviderJsonSchema {
  const mode = options?.mode ?? getProviderJsonSchemaMode();
  const schemaKey = schema as unknown as ZodType<unknown>;
  const modeMap = providerSchemaCache.get(schemaKey);
  const cached = modeMap?.[mode];
  if (cached) return cached;

  const jsonSchema = toJSONSchema(schema);
  const result =
    mode === 'full'
      ? jsonSchema
      : (stripDescriptionAndRuntimeIdKeys(
          jsonSchema as JsonValue
        ) as ProviderJsonSchema);

  if (modeMap) {
    modeMap[mode] = result;
  } else {
    providerSchemaCache.set(schemaKey, { [mode]: result });
  }
  return result;
}
