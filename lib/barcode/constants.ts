/** Maximum plausible gram weight for a single logged food item or package.
 *  Single source of truth shared by OFF sizing validation
 *  (`parseSizeGrams`), the staging schema (`stageBarcodeMealSchema`), and the
 *  quantity picker's clamp — so all three enforce the same upper bound and a
 *  large-but-valid package is never silently truncated. Kept in this
 *  dependency-light module so the client picker can import it without pulling
 *  in server-side fetch code. */
export const MAX_FOOD_ITEM_GRAMS = 100_000;
