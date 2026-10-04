'use server';

import { z } from 'zod';
import { runAdminAction } from '@/lib/admin/premium/actions/run-admin-action';
import { endFreePremium } from '@/lib/admin/premium/grants/end';
import { givePremium } from '@/lib/admin/premium/grants/give';
import {
  type EndInput,
  endInputSchema,
  type GiveInput,
  giveInputSchema,
} from '@/lib/admin/premium/grants/grant-input';
import { countWho } from '@/lib/admin/premium/targets/count-who';
import {
  type WhoInput,
  whoSchema,
} from '@/lib/admin/premium/targets/who-input';
import { db } from '@/lib/infra/db/client';

/** Admin-only: how many accounts a Who reaches, for the confirm preview. */
export async function previewWhoAction(input: WhoInput) {
  return runAdminAction(
    'previewed a selection',
    z.object({ who: whoSchema }),
    { who: input },
    async (_admin, { who }) => countWho(db, who),
    { mutates: false }
  );
}

/** Admin-only: give free Premium. */
export async function givePremiumAction(input: GiveInput) {
  return runAdminAction(
    'gave free Premium',
    giveInputSchema,
    input,
    async (admin, parsed) => {
      const result = await givePremium(admin, parsed, { db });
      return {
        userCount: result.userCount,
        expiresAt: result.expiresAt?.toISOString() ?? null,
      };
    }
  );
}

/** Admin-only: end free Premium (never paid). */
export async function endFreePremiumAction(input: EndInput) {
  return runAdminAction(
    'ended free Premium',
    endInputSchema,
    input,
    async (admin, parsed) => {
      const result = await endFreePremium(admin, parsed, { db });
      return { userCount: result.userCount };
    }
  );
}
