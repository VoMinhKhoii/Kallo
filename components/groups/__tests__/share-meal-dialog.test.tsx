import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/hooks/social/circle/use-friends', () => ({
  useFriends: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/hooks/social/sharing/use-share-meal-with-friends', () => ({
  useShareMealWithFriends: () => ({ isPending: false, mutate: vi.fn() }),
  useUndoMealShare: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('@/components/shared/surface-state/surface-state', () => ({
  SurfaceState: ({ title }: { title: string }) => <p>{title}</p>,
}));

import { ShareMealDialog } from '@/components/groups/share-meal-dialog';

describe('ShareMealDialog', () => {
  it('mounts closed without throwing', () => {
    // Regression: the even-split check ran `evenParts(seated.length + 1)` in a
    // render-time memo, and with nobody seated that is `evenParts(1)`, which
    // throws by contract. The dialog mounts with its trigger on EVERY meal
    // card, so this crashed the whole logging feed without anyone opening it.
    expect(() =>
      render(
        <ShareMealDialog
          mealId="meal-1"
          mealName="Bánh mì thịt nướng"
          totalKcal={1040}
          trigger={<button type="button">Share</button>}
        />
      )
    ).not.toThrow();

    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });
});
