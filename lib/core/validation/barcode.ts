// What a barcode string looks like — one rule, shared by the REST contract
// (`lib/api/contracts/barcode.ts`), the server actions in
// `lib/actions/logging/barcode.ts`, and the composer pick that carries a
// scanned product into an analysis (`lib/core/validation/meal.ts`).
//
// It lives HERE rather than in the contract because the meal-analysis request
// schema needs it too, and `lib/core` may not import upward from `lib/api`.
import { z } from 'zod';

export const barcodeSchema = z
  .string()
  .min(1, 'Mã vạch không được để trống')
  .max(64)
  .regex(/^\d+$/, 'Mã vạch chỉ được chứa số');
