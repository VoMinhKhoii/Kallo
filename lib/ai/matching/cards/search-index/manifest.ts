/**
 * The artifact manifest as the runtime reads it: validated before anything in
 * the build is trusted. A format this code does not know (a revision rolled
 * back onto a newer build, or the reverse) is refused, and matching falls back
 * to the database path.
 */
import { z } from 'zod';

/** The artifact format this runtime reads (`scripts/.../spec.ts` writes it). */
export const RUNTIME_FORMAT = 1;

const fileEntry = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().positive(),
});

export const ManifestSchema = z.object({
  format: z.literal(RUNTIME_FORMAT),
  buildId: z.string().min(1),
  counts: z.object({
    catalogRows: z.number().int().positive(),
    texts: z.number().int().positive(),
    links: z.number().int().positive(),
  }),
  files: z.object({
    'catalog.json': fileEntry,
    'texts.f16': fileEntry,
    'text-rows.json': fileEntry,
    'index.usearch': fileEntry,
  }),
});

export type Manifest = z.infer<typeof ManifestSchema>;
