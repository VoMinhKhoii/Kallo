// How much of one food a single log entry may claim — the bound and the schema
// that enforces it, in one place because three request contracts spell out the
// same rule: `POST /api/v1/barcode/log`, the `stageBarcodeMeal` action, and the
// composer's barcode pick.
//
// Lives under `lib/core/validation/` rather than beside the barcode domain
// because `lib/core` may not import from `lib/domain`, and the meal-analysis
// request schema needs it too.
import { z } from 'zod';

/** Maximum plausible gram weight for a single logged food item or package.
 *  Single source of truth shared by OFF sizing validation
 *  (`parseSizeGrams`), the staging schema (`stageBarcodeMealSchema`), and the
 *  quantity picker's clamp — so all three enforce the same upper bound and a
 *  large-but-valid package is never silently truncated. Kept in this
 *  dependency-light module so the client picker can import it without pulling
 *  in server-side fetch code. */
export const MAX_FOOD_ITEM_GRAMS = 100_000;

/** A gram amount a user chose for one food item, bounded by
 *  {@link MAX_FOOD_ITEM_GRAMS}. One schema so a weight the REST contract
 *  refuses cannot get in through the Server Action or a composer pick. */
export const foodItemGramsSchema = z
  .number()
  .positive('Khối lượng phải lớn hơn 0')
  .finite()
  .max(MAX_FOOD_ITEM_GRAMS, 'Khối lượng quá lớn');
