import { deleteAccountAction, exportMyDataAction } from '@/lib/actions/account';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

/** Full data export for the authenticated user (mobile "Export my data"). */
export async function GET() {
  try {
    const data = await exportMyDataAction();
    return Response.json(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Permanently delete the authenticated user's account and all their data. */
export async function DELETE() {
  try {
    const result = await deleteAccountAction();
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
