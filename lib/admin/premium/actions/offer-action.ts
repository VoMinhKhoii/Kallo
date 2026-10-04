'use server';

import { runAdminAction } from '@/lib/admin/premium/actions/run-admin-action';
import { saveWelcomeOffer } from '@/lib/admin/premium/offer/offer';
import {
  type OfferInput,
  offerInputSchema,
} from '@/lib/admin/premium/offer/offer-input';
import { db } from '@/lib/infra/db/client';

/** Admin-only: change the welcome offer for future signups. */
export async function saveWelcomeOfferAction(input: OfferInput) {
  return runAdminAction(
    'changed the welcome offer',
    offerInputSchema,
    input,
    async (admin, parsed) => {
      await saveWelcomeOffer(admin, parsed, { db });
      return {};
    }
  );
}
