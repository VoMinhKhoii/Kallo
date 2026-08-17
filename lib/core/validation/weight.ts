/** Request schema for logging a body-weight entry. */
import { z } from 'zod';
import { dateStringSchema } from '@/lib/core/validation/primitives';

/** Shared schema for a single weight log entry. */
export const weightLogSchema = z.object({
  loggedDate: dateStringSchema,
  weightKg: z
    .number()
    .min(30, 'Cân nặng phải lớn hơn hoặc bằng 30 kg.')
    .max(300, 'Cân nặng phải nhỏ hơn hoặc bằng 300 kg.'),
});

export type WeightLogInput = z.infer<typeof weightLogSchema>;
