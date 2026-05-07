import { describe, expect, it } from 'vitest';
import { toJSONSchema, z } from 'zod';
import {
  getProviderJsonSchemaMode,
  toProviderJsonSchema,
} from '@/lib/ai/prompts/schema';

describe('toProviderJsonSchema', () => {
  const schema = z.object({
    name: z.string().describe('Human-readable meal name'),
    status: z.enum(['ok', 'needs_review']).describe('Review state'),
    description: z.string().describe('User-provided description field'),
    nested: z
      .object({
        ingredientId: z.string().optional().describe('Runtime-owned ID'),
        grams: z.number().describe('Estimated grams'),
      })
      .describe('Nested object metadata'),
    mealItems: z
      .array(
        z.object({
          mealItemId: z.string().optional().describe('Runtime-owned ID'),
          name: z.string(),
        })
      )
      .describe('Meal items'),
  });

  it('keeps full Zod JSON schema by default', () => {
    expect(toProviderJsonSchema(schema)).toEqual(toJSONSchema(schema));
  });

  it('removes schema description metadata in slim mode', () => {
    const jsonSchema = toProviderJsonSchema(schema, { mode: 'slim' });

    expect(JSON.stringify(jsonSchema)).not.toContain(
      'Human-readable meal name'
    );
    expect(JSON.stringify(jsonSchema)).not.toContain('Nested object metadata');
    expect(JSON.stringify(jsonSchema)).not.toContain('Estimated grams');
  });

  it('preserves required fields, enums, and data fields named description', () => {
    const jsonSchema = toProviderJsonSchema(schema, { mode: 'slim' });

    expect(jsonSchema).toEqual(
      expect.objectContaining({
        required: ['name', 'status', 'description', 'nested', 'mealItems'],
      })
    );
    expect(jsonSchema.properties).toEqual(
      expect.objectContaining({
        status: expect.objectContaining({
          enum: ['ok', 'needs_review'],
        }),
        description: expect.objectContaining({
          type: 'string',
        }),
      })
    );
  });

  it('removes runtime-owned IDs in slim mode', () => {
    const jsonSchema = toProviderJsonSchema(schema, { mode: 'slim' });
    const serialized = JSON.stringify(jsonSchema);

    expect(serialized).not.toContain('mealItemId');
    expect(serialized).not.toContain('ingredientId');
    expect(serialized).toContain('mealItems');
    expect(serialized).toContain('grams');
  });

  it('does not alter runtime Zod parsing', () => {
    toProviderJsonSchema(schema, { mode: 'slim' });

    const parsed = schema.parse({
      name: 'rice bowl',
      status: 'ok',
      description: 'with fish sauce',
      nested: { ingredientId: 'i1', grams: 120 },
      mealItems: [{ mealItemId: 'm1', name: 'rice bowl' }],
    });

    expect(parsed).toEqual({
      name: 'rice bowl',
      status: 'ok',
      description: 'with fish sauce',
      nested: { ingredientId: 'i1', grams: 120 },
      mealItems: [{ mealItemId: 'm1', name: 'rice bowl' }],
    });
    expect(() =>
      schema.parse({
        name: 'rice bowl',
        status: 'invalid',
        description: 'with fish sauce',
        nested: { grams: 120 },
        mealItems: [{ name: 'rice bowl' }],
      })
    ).toThrow();
  });
});

describe('getProviderJsonSchemaMode', () => {
  it('defaults to full provider schemas', () => {
    expect(getProviderJsonSchemaMode({})).toBe('full');
  });

  it('enables slim provider schemas only when explicitly requested', () => {
    expect(
      getProviderJsonSchemaMode({
        PIPELINE_PROVIDER_SCHEMA_MODE: 'slim',
      })
    ).toBe('slim');
    expect(
      getProviderJsonSchemaMode({
        PIPELINE_PROVIDER_SCHEMA_MODE: 'experimental',
      })
    ).toBe('full');
  });
});
