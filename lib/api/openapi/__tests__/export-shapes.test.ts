import { describe, expect, it } from 'vitest';
import type { JsonSchema, PathItem } from '@/lib/api/openapi/components';
import { openApiDocument } from '@/lib/api/openapi/document';
import { EXPORT_SCHEMAS } from '@/lib/api/openapi/export-shapes';
import { createExportDb } from '@/lib/domain/account-export/__fixtures__/export-db';
import { buildDataExport } from '@/lib/domain/account-export/build-export';

// ---------------------------------------------------------------------------
// The DataExport schema is only honest if a real export validates against it.
// The fixture db answers every export query with one row generated from the
// selected columns, so this walks every section with values of the runtime
// type Drizzle would return, serialised exactly as the route serialises them.
// A deliberately small validator: the subset of JSON Schema the export schema
// uses (type, required, additionalProperties: false, items, enum, format).
// ---------------------------------------------------------------------------

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  return typeof value;
}

function validate(schema: JsonSchema, value: unknown, at: string): string[] {
  const errors: string[] = [];
  const actual = typeOf(value);
  if (schema.type !== undefined) {
    const allowed = ([] as unknown[]).concat(schema.type);
    const ok =
      allowed.includes(actual) ||
      (actual === 'integer' && allowed.includes('number'));
    if (!ok) return [`${at}: expected ${allowed.join('|')}, got ${actual}`];
  }
  if (schema.enum && !(schema.enum as unknown[]).includes(value)) {
    errors.push(`${at}: ${String(value)} not in enum`);
  }
  if (schema.format === 'date-time' && actual === 'string') {
    if (Number.isNaN(Date.parse(value as string))) {
      errors.push(`${at}: not a date-time`);
    }
  }
  if (actual === 'object' && schema.properties) {
    const properties = schema.properties as Record<string, JsonSchema>;
    const record = value as Record<string, unknown>;
    for (const key of (schema.required as string[]) ?? []) {
      if (!(key in record)) errors.push(`${at}.${key}: missing`);
    }
    for (const [key, child] of Object.entries(record)) {
      const childSchema = properties[key];
      if (!childSchema) {
        if (schema.additionalProperties === false) {
          errors.push(`${at}.${key}: not in schema`);
        }
        continue;
      }
      errors.push(...validate(childSchema, child, `${at}.${key}`));
    }
  }
  if (actual === 'array' && schema.items) {
    (value as unknown[]).forEach((item, index) => {
      errors.push(
        ...validate(schema.items as JsonSchema, item, `${at}[${index}]`)
      );
    });
  }
  return errors;
}

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'owner@kallo.fit',
  created_at: '2026-01-02T03:04:05.000Z',
  last_sign_in_at: '2026-09-20T10:00:00.000Z',
  app_metadata: { providers: ['google'] },
};

async function exportAsJson(rows?: () => unknown[]) {
  const { db } = createExportDb(rows);
  return JSON.parse(JSON.stringify(await buildDataExport(db, user)));
}

describe('DataExport OpenAPI schema', () => {
  it('validates a fully populated export', async () => {
    const document = await exportAsJson();
    expect(validate(EXPORT_SCHEMAS.DataExport, document, '$')).toEqual([]);
    // Guard the guard: the populated export really populated every list.
    expect(document.meals[0].items).toHaveLength(1);
    expect(document.chat.groups.length).toBeGreaterThan(0);
  });

  it('validates the export of an account with no data', async () => {
    const document = await exportAsJson(() => []);
    expect(validate(EXPORT_SCHEMAS.DataExport, document, '$')).toEqual([]);
  });

  it('rejects a key the schema does not describe', () => {
    expect(
      validate(EXPORT_SCHEMAS.DataExport, { surprise: true }, '$')
    ).toContain('$.surprise: not in schema');
  });

  it('is the documented response of GET /api/v1/account', () => {
    const doc = openApiDocument() as {
      paths: Record<string, PathItem>;
      components: { schemas: Record<string, JsonSchema> };
    };
    const responses = doc.paths['/api/v1/account']?.get?.responses as Record<
      string,
      { content: Record<string, unknown> }
    >;
    expect(responses['200']?.content['application/json']).toEqual({
      schema: { $ref: '#/components/schemas/DataExport' },
    });
    expect(doc.components.schemas.DataExport).toBe(EXPORT_SCHEMAS.DataExport);
  });
});
