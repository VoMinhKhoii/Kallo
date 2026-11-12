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
import { nameKey } from '@/lib/core/text/name-key';

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
const present = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/**
 * What Call 1 left out that the pipeline has a neutral value for: a food
 * without one of its search strings (`queryEn`, `nameVi`) takes the string
 * retrieval falls back to anyway (`cards/query-strings.ts`), and a dish
 * without a `cookingMethod` (Haiku skips it on drinks and packaged foods) is
 * "as served", which names no cooking and matches none of the method rules.
 * Tried only on an answer that failed its schema, so an answer for a schema
 * without these fields is never touched. Returns a copy.
 */
export function withCallOneDefaults(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withCallOneDefaults);
  if (!node || typeof node !== 'object') return node;
  const out = Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      withCallOneDefaults(value),
    ])
  ) as Loose;
  if (
    typeof out.rawName === 'string' &&
    typeof out.canonicalName === 'string'
  ) {
    if (!present(out.queryEn)) out.queryEn = out.canonicalName;
    if (!present(out.nameVi)) out.nameVi = out.rawName;
  }
  const isCallOneDish =
    typeof out.name === 'string' &&
    Array.isArray(out.ingredients) &&
    out.ingredients.some((g) => typeof (g as Loose)?.rawName === 'string');
  if (isCallOneDish && !present(out.cookingMethod))
    out.cookingMethod = 'as served';
  return out;
}

/**
 * Fix the value slips seen from the models on the two pipeline schemas
 * (decomposition and grounded estimation) before the Zod parse: an explicit
 * mass or a dish `servedMassG` of 0 g means no weight was typed, and a dish
 * `statedKcal` of 0 means no calories were typed (Haiku writes
 * `servedMassG: 0` for "no weight", and the schema's > 0 rule then failed the
 * whole Call 1); a missing dish `cookingMethod` is ""; over-long `rejectReason` /
 * `prepNotes` are cut to the schema's lengths; `refusePct` is clamped to
 * 0-80; a Call 2 ingredient at 0 g is dropped, and a `servedG` of 0 means no
 * plate weight; a `vesselToken` over the schema's 16 characters is dropped; a
 * meal item left with no ingredients is dropped when its name is unique (a
 * repeated name is kept, see below). Fields a schema
 * does not have are left alone.
 */
export function repairPipelineOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const out = raw as Loose;
  if (!Array.isArray(out.mealItems)) return raw;
  for (const m of out.mealItems as Loose[]) {
    // A Call 2 ingredient at 0 g is no answer for it (Call 2 asks again).
    if (
      Array.isArray(m?.ingredients) &&
      m.ingredients.some((g) => 'grossG' in (g as Loose))
    )
      m.ingredients = (m.ingredients as Loose[]).filter(
        (g) => Number(g.grossG) > 0
      );
  }
  // Estimates pair to dishes by name and occurrence (resolve/dish-slots.ts),
  // so dropping one of two same-name dishes would hand the next one's answer
  // to its slot. Keep an emptied repeated dish: the parse then fails and the
  // call is asked again, as before this repair.
  const names = new Map<string, number>();
  const keyOf = (m: Loose) => nameKey(String(m?.mealItemName ?? m?.name ?? ''));
  for (const m of out.mealItems as Loose[])
    names.set(keyOf(m), (names.get(keyOf(m)) ?? 0) + 1);
  out.mealItems = (out.mealItems as Loose[]).filter(
    (m) =>
      !Array.isArray(m?.ingredients) ||
      m.ingredients.length > 0 ||
      (names.get(keyOf(m)) ?? 0) > 1
  );
  for (const m of out.mealItems as Loose[]) {
    if (typeof m.vesselToken === 'string' && m.vesselToken.length > 16)
      delete m.vesselToken;
    if (
      ('cookingMethod' in m || 'name' in m) &&
      typeof m.cookingMethod !== 'string'
    )
      m.cookingMethod = '';
    if ('servedMassG' in m && !(Number(m.servedMassG) > 0))
      delete m.servedMassG;
    if ('statedKcal' in m && !(Number(m.statedKcal) > 0)) delete m.statedKcal;
    for (const g of (m.ingredients as Loose[] | undefined) ?? []) {
      if ('servedG' in g && !(Number(g.servedG) > 0)) delete g.servedG;
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

/** A numbered dish or drink label in Call 1's plan ("Dish 2:", "Drink 1:"). */
const PLAN_LABEL = /\b(dish|drink)\s+(\d+)\s*:/gi;

/**
 * A Call 1 answer whose plan numbers more dishes than its meal items hold.
 * Prod 8cb1a999: the plan named rice, braised chicken and stir-fried cabbage
 * as "Dish 1–3", then mealItems closed after the rice and the meal shipped as
 * 189 kcal of rice. Only a numbered plan is counted; a free-form plan is never
 * flagged.
 */
export function isShortOfPlan(raw: unknown): boolean {
  const out = raw as Loose | null;
  if (!out || out.isFood !== true || typeof out.plan !== 'string') return false;
  if (!Array.isArray(out.mealItems)) return false;
  const labels = new Set(
    [...out.plan.matchAll(PLAN_LABEL)].map(
      (m) => `${m[1].toLowerCase()} ${m[2]}`
    )
  );
  return out.mealItems.length < labels.size;
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
