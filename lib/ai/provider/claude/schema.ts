/**
 * The JSON Schema dialect Claude's structured outputs accept, and the output
 * slips its decoder cannot prevent.
 *
 * Claude enforces structure (types, required keys, enums) but not value
 * bounds, so a bound in the schema is dropped here and its rare violations
 * are repaired after the call instead of re-asking the whole call (each
 * re-ask costs a full 4-5 s call).
 */
import type { ProviderJsonSchema } from '@/lib/ai/prompts/schema';

/** Keywords Claude rejects; `description` adds tokens without changing what it emits. */
const UNSUPPORTED = new Set([
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'pattern',
  'propertyOrdering',
  'description',
]);

/** Drop the keywords Claude rejects and close every object, recursively. */
export function toClaudeSchema(node: ProviderJsonSchema | unknown): unknown {
  if (Array.isArray(node)) return node.map(toClaudeSchema);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED.has(key)) continue;
    out[key] =
      key === 'properties'
        ? Object.fromEntries(
            Object.entries(value as object).map(([p, s]) => [
              p,
              toClaudeSchema(s),
            ])
          )
        : toClaudeSchema(value);
  }
  if (out.type === 'object') out.additionalProperties = false;
  return out;
}

/** Drop empty strings: without minLength, Claude writes "" for an absent optional string. */
export function withoutEmptyStrings(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withoutEmptyStrings);
  if (!node || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => [key, withoutEmptyStrings(value)])
  );
}

type Loose = Record<string, unknown>;

/**
 * Fix the value slips seen from Claude on the two pipeline schemas
 * (decomposition and grounded estimation) before the Zod parse: an explicit
 * mass of 0 g means no mass; a missing dish `cookingMethod` is ""; over-long `rejectReason` /
 * `prepNotes` are cut to the schema's lengths; `refusePct` is clamped to
 * 0-80; a meal item with no ingredients is dropped. Fields a schema does not
 * have are left alone.
 */
export function repairPipelineOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const out = raw as Loose;
  if (!Array.isArray(out.mealItems)) return raw;
  out.mealItems = (out.mealItems as Loose[]).filter(
    (m) => !Array.isArray(m?.ingredients) || m.ingredients.length > 0
  );
  for (const m of out.mealItems as Loose[]) {
    if (
      ('cookingMethod' in m || 'name' in m) &&
      typeof m.cookingMethod !== 'string'
    )
      m.cookingMethod = '';
    for (const g of (m.ingredients as Loose[] | undefined) ?? []) {
      const mass = g.explicitMass as Loose | undefined;
      if (mass && !(Number(mass.grams) > 0)) delete g.explicitMass;
      if (typeof g.rejectReason === 'string' && g.rejectReason.length > 120)
        g.rejectReason = g.rejectReason.slice(0, 120);
      if (Array.isArray(g.prepNotes))
        g.prepNotes = g.prepNotes.map((n) =>
          typeof n === 'string' ? n.slice(0, 60) : n
        );
      if (typeof g.refusePct === 'number')
        g.refusePct = Math.min(80, Math.max(0, g.refusePct));
    }
  }
  return out;
}

/**
 * A food answer with no meal items (`isFood: true, mealItems: []`) parses
 * but reads downstream as "not food". Claude produced it occasionally, so it
 * is treated like a schema slip and re-asked.
 */
export function isEmptyFoodAnswer(raw: unknown): boolean {
  const out = raw as Loose | null;
  return (
    !!out &&
    out.isFood === true &&
    Array.isArray(out.mealItems) &&
    out.mealItems.length === 0
  );
}
