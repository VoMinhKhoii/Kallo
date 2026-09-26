import { type Column, getTableColumns, type Table } from 'drizzle-orm';
import type { JsonSchema } from '@/lib/api/openapi/components';

/**
 * JSON Schema building blocks for the export document, derived from Drizzle
 * columns so a column's type and nullability cannot drift from the spec. Used
 * by `export-shapes.ts`; kept apart so that file holds only the document's
 * shape.
 */

export const nullable = (schema: JsonSchema): JsonSchema => ({
  ...schema,
  type: [schema.type, 'null'],
});
export const uuid: JsonSchema = { type: 'string', format: 'uuid' };
export const dateTime: JsonSchema = { type: 'string', format: 'date-time' };
export const anyJson: JsonSchema = { description: 'Free-form JSON.' };

function columnSchema(column: Column): JsonSchema {
  const base = ((): JsonSchema => {
    switch (column.columnType) {
      case 'PgUUID':
        return uuid;
      case 'PgDateString':
        return { type: 'string', format: 'date' };
      case 'PgNumeric':
        return { type: 'string', description: 'Decimal, as a string.' };
      case 'PgInteger':
      case 'PgSmallInt':
      case 'PgSerial':
        return { type: 'integer' };
      case 'PgArray':
        return { type: 'array', items: uuid };
      default:
        break;
    }
    switch (column.dataType) {
      case 'number':
        return { type: 'number' };
      case 'boolean':
        return { type: 'boolean' };
      case 'date':
        return dateTime;
      case 'json':
        return anyJson;
      default:
        return { type: 'string' };
    }
  })();
  if (column.notNull || !('type' in base)) return base;
  return nullable(base);
}

/** Property schemas for `keys` of `table` (every column when omitted). */
export function columns(
  table: Table,
  keys?: string[]
): Record<string, JsonSchema> {
  const all = getTableColumns(table) as Record<string, Column>;
  return Object.fromEntries(
    (keys ?? Object.keys(all)).map((key) => [key, columnSchema(all[key])])
  );
}

export function object(
  properties: Record<string, JsonSchema>,
  description?: string
): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
    ...(description ? { description } : {}),
  };
}

export const list = (items: JsonSchema, description?: string): JsonSchema => ({
  type: 'array',
  items,
  ...(description ? { description } : {}),
});
