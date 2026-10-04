'use server';

import { z } from 'zod';
import { searchAccounts } from '@/lib/admin/premium/accounts/search';
import { runAdminAction } from '@/lib/admin/premium/actions/run-admin-action';
import { db } from '@/lib/infra/db/client';

const searchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, 'Type at least 2 characters.')
    .max(100, 'Search is too long.'),
});

/** Admin-only: find accounts by email, name or handle for the picker. */
export async function searchAccountsAction(query: string) {
  return runAdminAction(
    'searched accounts',
    searchSchema,
    { query },
    async (_admin, parsed) => {
      const matches = await searchAccounts(db, parsed.query);
      return {
        matches: matches.map((m) => ({
          ...m,
          joinedAt: m.joinedAt.toISOString(),
          freeUntil: m.freeUntil?.toISOString() ?? null,
        })),
      };
    },
    { mutates: false }
  );
}
