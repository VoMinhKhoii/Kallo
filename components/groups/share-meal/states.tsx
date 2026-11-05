'use client';

import { ShareMealDialogSkeleton } from '@/components/groups/share-meal/add-lane';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { Button } from '@/components/ui/button';
import { CIRCLE_CAST } from '@/lib/brand/illustrations/casts/circle';

/**
 * The dialog's async surfaces.
 *
 * Both go through `SurfaceState`, the web twin of the app's one state surface.
 * The share flow was the only feature that never adopted it and hand-rolled
 * bare prose instead — including a literal "Đang tải…" where every other
 * surface shows a skeleton.
 *
 * The retry is the ink button, not a destructive one: a retry is not a
 * destruction, so there is no red on either of these.
 */
export function ShareMealDialogStates({
  isPending,
  isError,
  hasFriends,
  onRetry,
  errorTitle,
  errorBody,
  retryLabel,
  emptyTitle,
  emptyBody,
}: {
  isPending: boolean;
  isError: boolean;
  hasFriends: boolean;
  onRetry: () => void;
  errorTitle: string;
  errorBody: string;
  retryLabel: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  if (isPending) {
    return <ShareMealDialogSkeleton />;
  }
  if (isError) {
    return (
      <div className="py-2">
        <SurfaceState
          action={
            <Button onClick={onRetry} size="sm" variant="ink">
              {retryLabel}
            </Button>
          }
          cast={CIRCLE_CAST}
          compact
          kind="error"
          subtitle={errorBody}
          title={errorTitle}
        />
      </div>
    );
  }
  if (!hasFriends) {
    return (
      <div className="py-2">
        <SurfaceState
          cast={CIRCLE_CAST}
          compact
          kind="empty"
          subtitle={emptyBody}
          title={emptyTitle}
        />
      </div>
    );
  }
  return null;
}
