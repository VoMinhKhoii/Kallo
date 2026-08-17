import {
  deleteAccountAction,
  exportMyDataAction,
} from '@/lib/actions/identity/account';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

/** Full data export for the authenticated user (mobile "Export my data"). */
export async function GET() {
  try {
    const expectedUserId = await requireUserId();
    const data = await exportMyDataAction({ expectedUserId });
    return Response.json(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Permanently delete the authenticated user's account and all their data. */
export async function DELETE() {
  try {
    const expectedUserId = await requireUserId();
    const result = await deleteAccountAction({ expectedUserId });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
