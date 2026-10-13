import { z } from 'zod';

/**
 * Closed-enum hint extracted from the user's text indicating how the weight
 * (when later estimated in Call 2) should relate to cooking state. `raw_weight`
 * is the "cân sống" / "raw weight" / "before cooking" pattern. `cooked_weight`
 * is the as-eaten default. `unspecified` means the user didn't say — Call 2
 * infers from cooking method + cuisine priors.
 */
export const stateHintSchema = z.enum([
  'raw_weight',
  'cooked_weight',
  'unspecified',
]);

/**
 * Closed-enum size cue the user typed alongside a count/unit ("nhỏ"/"vừa"/
 * "lớn"/"small"/"medium"/"large"). NLP-shaped: the LLM only classifies the
 * word; the server-side portion resolver maps it to a low/mid/high grams band.
 */
export const sizeModifierSchema = z.enum(['small', 'medium', 'large']);

/**
 * Structured explicit mass the user typed (e.g. "250gr ... cân sống"), scaled
 * to the user's share when they ate only part of it ("half of a 400g steak"
 * → 200), since the resolver pins it as the eaten grams.
 * Extraction ONLY — the LLM must NOT invent this when the user gave no weight.
 * `basis` describes whether the typed weight includes physical refuse. The
 * separate `stateHint` field owns the raw/cooked axis.
 */
export const explicitMassSchema = z
  .object({
    grams: z
      .number()
      .positive()
      .finite()
      .describe(
        'Mass in grams the user typed (e.g. 250 for "250gr"); when they ate only a share of it, their share (e.g. 200 for "half of a 400g steak").'
      ),
    basis: z
      .enum(['gross_as_served', 'edible', 'unknown'])
      .describe(
        '"gross_as_served" when the named object is bone-in/shell-on; "edible" for boneless, peeled, shelled, or fillet forms; otherwise "unknown".'
      ),
  })
  .strict();
